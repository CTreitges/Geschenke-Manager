// Reine Abstimmungs-Logik, geteilt von Frontend (Alias "@shared") und Cloud
// Functions. Keine Imports aus firebase / firebase-admin / firebase-functions.
// Die Uhrzeit kommt immer als Parameter `now` (ms epoch) herein, nie Date.now().

export type PollStatus = "none" | "active" | "closed";
export type PollCloseReason = "manual" | "timeout" | "gift-confirmed" | "gift-received" | "orphan";
/** none = kein Doc · running = aktiv, Frist offen · expired = aktiv, Frist vorbei · closed. */
export type PollPhase = "none" | "running" | "expired" | "closed";

export interface PollDoc {
  status: PollStatus;
  /** Runden-Schlüssel: identifiziert die laufende Runde. */
  startedAt?: number;
  startedBy?: string;
  /** Ende (ms epoch). Gilt nur, wenn > startedAt – alte Clients lassen es beim Neustart stehen. */
  endsAt?: number;
  closedAt?: number;
  closedBy?: string;
  closedReason?: PollCloseReason;
  /** personId → suggestionId[] (Mehrfachwahl). */
  votes: Record<string, string[]>;
}

export interface GiftLike {
  personId: string;
  status: "open" | "confirmed" | "received";
  participantIds?: readonly string[];
}

export interface SuggestionLike {
  id: string;
  createdAt: number;
}

export interface RankedSuggestion {
  id: string;
  votes: number;
  voters: string[];
}

export type PollResult =
  | { kind: "empty" }
  | { kind: "winner"; id: string; votes: number }
  | { kind: "tie"; ids: string[]; votes: number };

export interface Lock {
  locked: boolean;
  reason?: string;
}

export interface GiftLocks {
  addIdea: Lock;
  adoptWish: Lock;
  editIdea: Lock;
  deleteIdea: Lock;
  decideOutsideResult: Lock;
}

export type PollTransition = "started" | "closed" | null;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ─── Dauer ──────────────────────────────────────────────

export type DurationPresetId = "24h" | "48h" | "72h" | "168h";

export interface DurationPreset {
  id: DurationPresetId;
  label: string;
  ms: number;
}

export const DURATION_PRESETS: readonly DurationPreset[] = [
  { id: "24h", label: "24 Std", ms: 24 * HOUR },
  { id: "48h", label: "48 Std", ms: 48 * HOUR },
  { id: "72h", label: "3 Tage", ms: 72 * HOUR },
  { id: "168h", label: "1 Woche", ms: 168 * HOUR },
];

export const DEFAULT_DURATION_PRESET: DurationPresetId = "48h";

// ─── Normalisierung ─────────────────────────────────────

const STATUSES: readonly PollStatus[] = ["none", "active", "closed"];
const CLOSE_REASONS: readonly PollCloseReason[] = [
  "manual",
  "timeout",
  "gift-confirmed",
  "gift-received",
  "orphan",
];

/**
 * Konvertiert das Vote-Mapping in das Multi-Vote-Format. Alte Daten
 * (`{ personId: suggestionId }`) werden zur einelementigen Liste
 * (wie `normalizeVotes` in src/lib/storage.ts).
 */
export function normalizeVotes(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [pid, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      out[pid] = v.filter((x): x is string => typeof x === "string");
    } else if (typeof v === "string" && v) {
      out[pid] = [v];
    } else {
      out[pid] = [];
    }
  }
  return out;
}

function finiteNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function nonEmptyString(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

/** Liest ein rohes Poll-Doc (Firestore-Daten) typsicher; unbekannte Werte fallen weg. */
export function normalizePoll(raw: unknown): PollDoc {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const status = STATUSES.find((s) => s === r.status) ?? "none";
  const poll: PollDoc = { status, votes: normalizeVotes(r.votes) };
  const startedAt = finiteNumber(r.startedAt);
  const endsAt = finiteNumber(r.endsAt);
  const closedAt = finiteNumber(r.closedAt);
  const startedBy = nonEmptyString(r.startedBy);
  const closedBy = nonEmptyString(r.closedBy);
  const closedReason = CLOSE_REASONS.find((c) => c === r.closedReason);
  // Nur gesetzte Felder übernehmen: Firestore lehnt `undefined`-Werte ab.
  if (startedAt !== undefined) poll.startedAt = startedAt;
  if (startedBy !== undefined) poll.startedBy = startedBy;
  if (endsAt !== undefined) poll.endsAt = endsAt;
  if (closedAt !== undefined) poll.closedAt = closedAt;
  if (closedBy !== undefined) poll.closedBy = closedBy;
  if (closedReason !== undefined) poll.closedReason = closedReason;
  return poll;
}

// ─── Zustand ────────────────────────────────────────────

/** Wählerkreis: eingetragene Teilnehmer ohne die beschenkte Person, dedupliziert. */
export function eligibleVoters(gift: GiftLike): string[] {
  const out: string[] = [];
  for (const id of gift.participantIds ?? []) {
    if (id && id !== gift.personId && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Frist der Runde oder null (keine Frist, oder `endsAt` ≤ `startedAt` aus einer Vorrunde). */
export function effectiveEndsAt(
  poll: Pick<PollDoc, "startedAt" | "endsAt"> | null | undefined,
): number | null {
  const startedAt = finiteNumber(poll?.startedAt);
  const endsAt = finiteNumber(poll?.endsAt);
  if (startedAt === undefined || endsAt === undefined) return null;
  return endsAt > startedAt ? endsAt : null;
}

export function pollPhase(poll: PollDoc | null | undefined, now: number): PollPhase {
  if (!poll) return "none";
  if (poll.status === "closed") return "closed";
  if (poll.status !== "active") return "none";
  const end = effectiveEndsAt(poll);
  return end !== null && now >= end ? "expired" : "running";
}

export function canVote(
  gift: GiftLike,
  poll: PollDoc | null | undefined,
  myId: string | null | undefined,
  now: number,
): boolean {
  if (!myId || myId === gift.personId) return false;
  if (gift.status !== "open") return false;
  if (pollPhase(poll, now) !== "running") return false;
  return eligibleVoters(gift).includes(myId);
}

// ─── Auszählung ─────────────────────────────────────────

/** suggestionId → Wähler; nur existierende Ideen und nur Wahlberechtigte zählen. */
export function tally(
  poll: PollDoc | null | undefined,
  suggestionIds: readonly string[],
  eligible: readonly string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const valid = new Set(suggestionIds);
  for (const sid of valid) out[sid] = [];
  if (!poll) return out;
  for (const pid of new Set(eligible)) {
    const mine = poll.votes?.[pid];
    if (!Array.isArray(mine)) continue;
    for (const sid of new Set(mine)) {
      if (valid.has(sid)) out[sid].push(pid);
    }
  }
  return out;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Stimmen absteigend, dann ältere Idee zuerst, dann ID – unabhängig von der Eingabe-Reihenfolge. */
export function ranking(
  suggestions: readonly SuggestionLike[],
  counts: Record<string, string[]>,
): RankedSuggestion[] {
  return suggestions
    .map((s) => ({ s, voters: counts[s.id] ?? [] }))
    .sort(
      (a, b) =>
        b.voters.length - a.voters.length ||
        (a.s.createdAt ?? 0) - (b.s.createdAt ?? 0) ||
        compareIds(a.s.id, b.s.id),
    )
    .map(({ s, voters }) => ({ id: s.id, votes: voters.length, voters }));
}

/** 🏆 nur bei genau einem Spitzenreiter mit ≥ 1 Stimme. */
export function pollResult(ranked: readonly RankedSuggestion[]): PollResult {
  const top = Math.max(0, ...ranked.map((r) => r.votes));
  if (top === 0) return { kind: "empty" };
  const ids = ranked.filter((r) => r.votes === top).map((r) => r.id);
  return ids.length === 1
    ? { kind: "winner", id: ids[0], votes: top }
    : { kind: "tie", ids, votes: top };
}

/**
 * „x von y Personen“: y = Wahlberechtigte. Mit `suggestionIds` zählen nur
 * Stimmen für noch existierende Ideen.
 */
export function countVoters(
  poll: PollDoc | null | undefined,
  eligible: readonly string[],
  suggestionIds?: readonly string[],
): { voted: number; total: number; missing: string[] } {
  const valid = suggestionIds ? new Set(suggestionIds) : null;
  const unique = [...new Set(eligible)];
  const missing = unique.filter((pid) => {
    const mine = poll?.votes?.[pid];
    return !(Array.isArray(mine) && mine.some((sid) => !valid || valid.has(sid)));
  });
  return { voted: unique.length - missing.length, total: unique.length, missing };
}

// ─── Sperren ────────────────────────────────────────────

export const POLL_LOCK_REASON = "Pausiert, bis die Abstimmung endet";

/** Während einer laufenden Abstimmung (Geschenk offen) sind Ideen eingefroren. */
export function getGiftLocks(
  gift: GiftLike,
  poll: PollDoc | null | undefined,
  now: number,
): GiftLocks {
  const running = gift.status === "open" && pollPhase(poll, now) === "running";
  const lock = (): Lock => (running ? { locked: true, reason: POLL_LOCK_REASON } : { locked: false });
  return {
    addIdea: lock(),
    adoptWish: lock(),
    editIdea: lock(),
    deleteIdea: lock(),
    decideOutsideResult: lock(),
  };
}

// ─── Erinnerung (Ruhezeit Europe/Vienna) ────────────────

const REMINDER_ZONE = "Europe/Vienna";
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 8;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(ts: number, timeZone?: string): ZonedParts {
  const key = timeZone ?? "";
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(key, fmt);
  }
  const parts = fmt.formatToParts(ts);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Abstand Wandzeit − UTC in ms zum Zeitpunkt `ts`. */
function zoneOffset(ts: number, timeZone: string): number {
  const p = zonedParts(ts, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ts / 1000) * 1000;
}

/** Zeitpunkt einer Wandzeit in `timeZone`; `day` darf über-/unterlaufen (Date.UTC normalisiert). */
function zonedTime(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const first = wall - zoneOffset(wall, timeZone);
  return wall - zoneOffset(first, timeZone);
}

function isQuietHour(hour: number): boolean {
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/**
 * Zeitpunkt der einmaligen Erinnerung: `endsAt` − clamp(25 % der Dauer,
 * 30 Min, 12 Std). Fällt das in 22–8 Uhr (Europe/Vienna), wird auf 21:30
 * des Vorabends vorgezogen. Nie vor `startedAt` + 10 Min; ist dann nur noch
 * Ruhezeit übrig, erst um 8 Uhr. null, wenn es keine Frist gibt oder die
 * Erinnerung nicht mehr vor das Ende passt.
 */
export function reminderDueAt(poll: Pick<PollDoc, "startedAt" | "endsAt">): number | null {
  const end = effectiveEndsAt(poll);
  if (end === null) return null;
  const start = poll.startedAt as number;
  const lead = Math.min(Math.max((end - start) * 0.25, 30 * MINUTE), 12 * HOUR);
  let due = end - lead;

  const local = zonedParts(due, REMINDER_ZONE);
  if (isQuietHour(local.hour)) {
    const dayShift = local.hour >= QUIET_START_HOUR ? 0 : -1;
    due = zonedTime(REMINDER_ZONE, local.year, local.month, local.day + dayShift, 21, 30);
  }

  const earliest = start + 10 * MINUTE;
  if (due < earliest) {
    due = earliest;
    const p = zonedParts(due, REMINDER_ZONE);
    if (isQuietHour(p.hour)) {
      const dayShift = p.hour >= QUIET_START_HOUR ? 1 : 0;
      due = zonedTime(REMINDER_ZONE, p.year, p.month, p.day + dayShift, QUIET_END_HOUR, 0);
    }
  }
  return due < end ? due : null;
}

// ─── Übergänge (für den Firestore-Trigger) ──────────────

/**
 * started = neue Runde (anderes `startedAt`) im Status active ·
 * closed = active → closed in derselben Runde · sonst null
 * (Stimmen, Verlängern, Löschen, Legacy-„none“).
 */
export function classifyTransition(
  before: PollDoc | null | undefined,
  after: PollDoc | null | undefined,
): PollTransition {
  if (!after) return null;
  if (
    after.status === "active" &&
    typeof after.startedAt === "number" &&
    after.startedAt !== before?.startedAt
  ) {
    return "started";
  }
  if (before?.status === "active" && after.status === "closed" && before.startedAt === after.startedAt) {
    return "closed";
  }
  return null;
}

// ─── Texte ──────────────────────────────────────────────

/** „noch 1 T 4 Std“ · „noch 4 Std 12 Min“ · „noch 38 Min“ · „beendet“ (Minuten aufgerundet). */
export function formatRemaining(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "beendet";
  const totalMin = Math.ceil(ms / MINUTE);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return hours > 0 ? `noch ${days} T ${hours} Std` : `noch ${days} T`;
  if (hours > 0) return minutes > 0 ? `noch ${hours} Std ${minutes} Min` : `noch ${hours} Std`;
  return `noch ${minutes} Min`;
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * „endet Fr 18:30“ (innerhalb einer Woche), „endet heute/morgen 18:30“,
 * ab 7 Tagen mit Datum „endet Mi, 7.10., 12:00“; Vergangenes „beendet …“.
 * `timeZone` fehlt = Zeitzone des Geräts.
 */
export function formatEndsAt(ts: number, now: number, timeZone?: string): string {
  const end = zonedParts(ts, timeZone);
  const today = zonedParts(now, timeZone);
  const endDay = Date.UTC(end.year, end.month - 1, end.day);
  const diff = Math.round((endDay - Date.UTC(today.year, today.month - 1, today.day)) / DAY);
  const weekday = WEEKDAYS[new Date(endDay).getUTCDay()];
  let day: string;
  if (diff === 0) day = "heute";
  else if (diff === 1) day = "morgen";
  else if (diff === -1) day = "gestern";
  else if (Math.abs(diff) < 7) day = weekday;
  else day = `${weekday}, ${end.day}.${end.month}.,`;
  return `${ts > now ? "endet" : "beendet"} ${day} ${pad2(end.hour)}:${pad2(end.minute)}`;
}

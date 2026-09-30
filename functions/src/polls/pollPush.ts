// Abstimmungs-Pushes: Texte, Deeplink und Data-Payload. REIN (keine
// firebase-Imports), damit alles ohne Emulator testbar ist.
//
// Spec §1: nur `poll_started` und `poll_reminder`, kein Ergebnis-Push.
// Texte neutral: keine Ideen-Titel, keine Preise (Sperrbildschirm!).

import {
  formatEndsAt,
  formatRemaining,
  type GiftLike,
} from "../shared/poll";

export type PollPushKind = "poll_started" | "poll_reminder";

const ZONE = "Europe/Vienna";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY_SECONDS = 86_400;

/** Genitiv eines Vornamens: „Annas“, aber „Max'“, „Hans'“, „Fritz'“ (Endung s/ß/x/z/ce). */
export function genitive(name: string): string {
  const n = name.trim();
  if (!n) return "";
  return /(s|ß|x|z|ce)$/i.test(n) ? `${n}'` : `${n}s`;
}

/** „Annas Geschenk“ bzw. „das Geschenk“, wenn der Name fehlt. */
function giftOf(personName: string): string {
  const g = genitive(personName);
  return g ? `${g} Geschenk` : "das Geschenk";
}

/** Deeplink: öffnet das Geschenk samt VoteSheet (über ShareGift, wechselt ggf. die Gruppe). */
export function pollPushUrl(groupId: string, giftId: string): string {
  return `/g/${encodeURIComponent(groupId)}/gift/${encodeURIComponent(giftId)}?vote=1`;
}

/** Ein Tag pro Geschenk: auf dem Gerät steht immer nur die neueste Meldung zur Abstimmung. */
export function pollPushTag(groupId: string, giftId: string): string {
  return `gm-poll-${groupId}-${giftId}`;
}

/** Idempotenz-Marker unter groups/{gid}/_push: einmal pro Ereignis und Runde (`startedAt`). */
export function pollMarkerId(kind: PollPushKind, giftId: string, startedAt: number): string {
  return `${kind}-${giftId}-${startedAt}`;
}

/** TTL bis zum Ende der Runde (mind. 1 Min); ohne Frist 1 Tag. FCM kappt bei 4 Wochen. */
export function pollPushTtlSeconds(endsAt: number | null, now: number): number {
  if (endsAt === null) return DAY_SECONDS;
  return Math.max(60, Math.ceil((endsAt - now) / 1000));
}

/**
 * Restzeit für den Push-Titel runden: ab 1 Std auf volle Stunden („Noch
 * 12 Std“ statt „Noch 11 Std 57 Min“, der Sweep läuft nur alle 5 Min),
 * darunter auf 5 Minuten aufgerundet.
 */
export function roundRemaining(ms: number): number {
  if (ms >= HOUR) return Math.round(ms / HOUR) * HOUR;
  return Math.ceil(Math.max(ms, 1) / (5 * MINUTE)) * 5 * MINUTE;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface PollPushBase {
  groupId: string;
  giftId: string;
  /** Name der beschenkten Person (nur für den Genitiv im Text). */
  personName: string;
  now: number;
}

function common(kind: PollPushKind, i: PollPushBase, title: string, body: string): Record<string, string> {
  return {
    // `type` liest der Service Worker (wie beim Geburtstags-Push), `kind` ist
    // derselbe Wert unter dem Namen aus der Spezifikation.
    type: kind,
    kind,
    groupId: i.groupId,
    giftId: i.giftId,
    url: pollPushUrl(i.groupId, i.giftId),
    tag: pollPushTag(i.groupId, i.giftId),
    renotify: "1",
    title,
    body,
  };
}

/** „🗳️ Abstimmung für Annas Geschenk“ · „Ben hat 4 Ideen zur Wahl gestellt – endet Fr 18:30.“ */
export function pollStartedData(
  i: PollPushBase & { starterName?: string; ideaCount: number; endsAt: number | null },
): Record<string, string> {
  const ideas = i.ideaCount === 1 ? "1 Idee" : `${i.ideaCount} Ideen`;
  const starter = i.starterName?.trim();
  const lead = starter
    ? `${starter} hat ${ideas} zur Wahl gestellt`
    : `${ideas} ${i.ideaCount === 1 ? "steht" : "stehen"} zur Wahl`;
  const body = i.endsAt !== null ? `${lead} – ${formatEndsAt(i.endsAt, i.now, ZONE)}.` : `${lead}.`;
  return common("poll_started", i, `🗳️ Abstimmung für ${giftOf(i.personName)}`, body);
}

/** „⏱ Noch 3 Std zum Abstimmen“ · „Für Annas Geschenk fehlt noch deine Stimme.“ */
export function pollReminderData(i: PollPushBase & { endsAt: number }): Record<string, string> {
  const remaining = capitalize(formatRemaining(roundRemaining(i.endsAt - i.now)));
  return common(
    "poll_reminder",
    i,
    `⏱ ${remaining} zum Abstimmen`,
    `Für ${giftOf(i.personName)} fehlt noch deine Stimme.`,
  );
}

/**
 * Liest ein rohes Gift-Doc für den Push. null, wenn es fehlt oder keine
 * gültige beschenkte Person/keinen gültigen Status hat (fail-closed: ohne
 * `personId` ließe sich die beschenkte Person nicht ausschließen).
 */
export function readGift(raw: unknown): GiftLike | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.personId !== "string" || !r.personId) return null;
  if (r.status !== "open" && r.status !== "confirmed" && r.status !== "received") return null;
  const participantIds = Array.isArray(r.participantIds)
    ? r.participantIds.filter((x): x is string => typeof x === "string")
    : [];
  return { personId: r.personId, status: r.status, participantIds };
}

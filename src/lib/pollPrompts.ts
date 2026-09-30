import { canVote, countVoters, eligibleVoters, pollPhase, type GiftLike, type PollDoc } from "@shared/poll";
import type { PushState } from "./pushState";

// Wann öffnet sich ein Abstimmungs-Sheet von selbst, und wann fragt die App
// nach Push? Keys mit Gruppe + Geschenk + Runde (startedAt). Jeder Storage-
// Zugriff in try/catch; wirft der Storage, merkt sich das Modul die Werte
// für diesen App-Start im Speicher (kein Dauer-Aufpoppen).

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const DAY = 86_400_000;
export const PUSH_ASK_INTERVAL_MS = 30 * DAY;

export const votePromptKey = (gid: string, giftId: string, startedAt: number) =>
  `gm:vote-prompted:${gid}:${giftId}:${startedAt}`;
export const resultPromptKey = (gid: string, giftId: string, startedAt: number) =>
  `gm:result-prompted:${gid}:${giftId}:${startedAt}`;
export const pushAskKey = (gid: string) => `gm:push-ask:${gid}`;

const memory = new Map<string, string>();

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(key: string, storage: StorageLike | null): string | null {
  try {
    const v = storage?.getItem(key);
    if (v != null) return v;
  } catch {
    /* Speicher-Fallback */
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string, storage: StorageLike | null): void {
  memory.set(key, value);
  try {
    storage?.setItem(key, value);
  } catch {
    /* nur für diesen App-Start gemerkt */
  }
}

export function wasPrompted(key: string, storage: StorageLike | null = defaultStorage()): boolean {
  return read(key, storage) !== null;
}

export function markPrompted(key: string, storage: StorageLike | null = defaultStorage()): void {
  write(key, "1", storage);
}

/** Soft-Ask nur, wenn Push auf diesem Gerät aus ist und höchstens 1× pro Gruppe in 30 Tagen. */
export function shouldAskPush(
  gid: string,
  pushState: PushState | null,
  now: number,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (pushState !== "off") return false;
  const last = Number(read(pushAskKey(gid), storage));
  return !Number.isFinite(last) || last <= 0 || now - last >= PUSH_ASK_INTERVAL_MS;
}

export function markPushAsked(gid: string, now: number, storage: StorageLike | null = defaultStorage()): void {
  write(pushAskKey(gid), String(now), storage);
}

export type PollSheetKind = "vote" | "decision";

interface SheetContext {
  gift: GiftLike;
  poll: PollDoc | null | undefined;
  myId: string | null | undefined;
  now: number;
}

/**
 * Ziel eines Deeplinks `?vote=1` (Push, Home-Chip): nie für die beschenkte
 * Person, ohne Identität, für Nicht-Wahlberechtigte oder wenn das Geschenk
 * nicht mehr offen ist. Läuft die Wahl → VoteSheet, ist sie vorbei → Ergebnis.
 */
export function linkedPollSheet({ gift, poll, myId, now }: SheetContext): PollSheetKind | null {
  if (!myId || myId === gift.personId || gift.status !== "open") return null;
  if (!eligibleVoters(gift).includes(myId)) return null;
  const phase = pollPhase(poll, now);
  if (phase === "running") return "vote";
  if (phase === "expired" || phase === "closed") return "decision";
  return null;
}

/**
 * Automatisch einmal pro Runde: das VoteSheet, wenn ich abstimmen darf und
 * noch keine Stimme habe; das Ergebnis, sobald die Runde vorbei ist.
 */
export function autoPollSheet(
  ctx: SheetContext & { ideaIds: readonly string[]; votePrompted: boolean; resultPrompted: boolean },
): PollSheetKind | null {
  const target = linkedPollSheet(ctx);
  if (target === "vote") {
    if (ctx.votePrompted || !canVote(ctx.gift, ctx.poll, ctx.myId, ctx.now)) return null;
    const { missing } = countVoters(ctx.poll, eligibleVoters(ctx.gift), ctx.ideaIds);
    return missing.includes(ctx.myId as string) ? "vote" : null;
  }
  if (target === "decision") return ctx.resultPrompted ? null : "decision";
  return null;
}

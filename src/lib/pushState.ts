// Reine Helfer für den Push-Zustand eines Geräts (ohne Firebase-Imports,
// damit testbar). Die Hooks/SDK-Aufrufe liegen in messaging.ts.

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export interface PushPrefs {
  /** Geburtstage (30-Tage-Stack) — members.notifyStack */
  stack: boolean;
  /** Abstimmungen — members.notifyPolls, erbt notifyStack solange nie gesetzt */
  polls: boolean;
}

/** localStorage-Eintrag: welcher FCM-Token für welche UID registriert ist. */
export interface StoredPushToken {
  token: string;
  uid: string;
  syncedAt: number;
}

export const PUSH_TOKEN_KEY = "gm:push-token";
/** Token-Sync beim App-Start höchstens einmal pro Tag. */
export const PUSH_SYNC_INTERVAL_MS = 86_400_000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function parseStoredToken(raw: string | null): StoredPushToken | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredPushToken>;
    if (typeof v.token !== "string" || !v.token || typeof v.uid !== "string" || !v.uid) return null;
    return { token: v.token, uid: v.uid, syncedAt: typeof v.syncedAt === "number" ? v.syncedAt : 0 };
  } catch {
    return null;
  }
}

export function readStoredToken(storage: StorageLike | null = defaultStorage()): StoredPushToken | null {
  try {
    return parseStoredToken(storage?.getItem(PUSH_TOKEN_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeStoredToken(value: StoredPushToken, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(PUSH_TOKEN_KEY, JSON.stringify(value));
  } catch {
    /* privater Modus o. ä.: dann eben ohne Merker */
  }
}

export function clearStoredToken(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(PUSH_TOKEN_KEY);
  } catch {
    /* ignorieren */
  }
}

/** Muss der Token neu geholt/geschrieben werden (neue UID oder älter als ein Tag)? */
export function needsTokenSync(stored: StoredPushToken | null, uid: string, now: number): boolean {
  if (!stored || stored.uid !== uid) return true;
  return now - stored.syncedAt >= PUSH_SYNC_INTERVAL_MS || now < stored.syncedAt;
}

/** iPhone/iPad (iPadOS meldet sich als „MacIntel“ mit Touch). */
export function isIosDevice(ua: string, platform = "", maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export type PushPlatform = "ios" | "android" | "desktop";

export function pushPlatform(ua: string, platform = "", maxTouchPoints = 0): PushPlatform {
  if (isIosDevice(ua, platform, maxTouchPoints)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function derivePushState(env: {
  supported: boolean;
  ios: boolean;
  standalone: boolean;
  permission: NotificationPermission | null;
  /** Für die aktuelle UID ist auf diesem Gerät ein Token registriert. */
  registered: boolean;
}): PushState {
  // iPhone im Safari-Tab: Push gibt es nur als Home-Bildschirm-App.
  if (env.ios && !env.standalone) return "needs-install";
  if (!env.supported || env.permission === null) return "unsupported";
  if (env.permission === "denied") return "denied";
  if (env.permission === "granted" && env.registered) return "on";
  return "off";
}

export function effectivePushPrefs(member?: { notifyStack?: boolean; notifyPolls?: boolean } | null): PushPrefs {
  const stack = member?.notifyStack === true;
  return { stack, polls: member?.notifyPolls ?? stack };
}

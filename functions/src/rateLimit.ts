import type { Firestore } from "firebase-admin/firestore";

// Rate-Limit für joinGroup (Security Tier 2). Gezählt wird je Aufrufer –
// nie je Gruppe allein, sonst könnte ein Dritter mit falschen Passwörtern
// alle echten Mitglieder einer Gruppe aussperren.
//  - uid: enge Grenze; reicht gegen einen einzelnen Client.
//  - ip:  weitere Grenze, weil anonyme UIDs nichts kosten (neues Konto je
//         5 Versuche). Hoch genug für mehrere Leute im selben WLAN/NAT.
// Feste Fenster ab dem ersten Versuch; danach beginnt die Zählung neu.

export const JOIN_WINDOW_MS = 15 * 60 * 1000;
export const JOIN_MAX_ATTEMPTS_PER_UID = 5;
export const JOIN_MAX_ATTEMPTS_PER_IP = 20;

/** Zähler-Sammlung; in firestore.rules für Clients komplett gesperrt. */
export const RATE_LIMIT_COLLECTION = "_rateLimits";

export type LimitScope = "uid" | "ip";

interface Counter {
  count: number;
  windowStart: number;
}

/**
 * Client-IP für den Zähler. Der rechte X-Forwarded-For-Eintrag stammt vom
 * Google Front End; alles links davon kann der Client selbst setzen (sonst
 * ließe sich die IP-Grenze umgehen oder eine fremde IP aussperren).
 * rawRequest.ip ist mit `trust proxy` der linke Eintrag – nur Fallback.
 */
export function clientIp(req: { headers?: Record<string, string | string[] | undefined>; ip?: string } | undefined): string | undefined {
  const header = req?.headers?.["x-forwarded-for"];
  const raw = Array.isArray(header) ? header.join(",") : header;
  const last = raw?.split(",").map((s) => s.trim()).filter(Boolean).pop();
  return last || req?.ip || undefined;
}

/** Für eine Firestore-TTL-Policy auf `_rateLimits.expireAt` (DEPLOY-Hinweis). */
function expireAt(windowStart: number): Date {
  return new Date(windowStart + 2 * JOIN_WINDOW_MS);
}

export interface JoinCaller {
  uid: string;
  /** Client-IP laut rawRequest; fehlt sie, zählt nur die UID. */
  ip?: string;
}

function counterPath(scope: LimitScope, key: string): string {
  // IPv6 enthält ":" – in Doc-IDs erlaubt, "/" nicht.
  return `${RATE_LIMIT_COLLECTION}/join_${scope}_${key.replace(/\//g, "_")}`;
}

function scopesOf(caller: JoinCaller): { scope: LimitScope; key: string; max: number }[] {
  const scopes: { scope: LimitScope; key: string; max: number }[] = [
    { scope: "uid", key: caller.uid, max: JOIN_MAX_ATTEMPTS_PER_UID },
  ];
  if (caller.ip) scopes.push({ scope: "ip", key: caller.ip, max: JOIN_MAX_ATTEMPTS_PER_IP });
  return scopes;
}

function current(data: Partial<Counter> | undefined, now: number): Counter {
  if (!data || typeof data.count !== "number" || typeof data.windowStart !== "number") {
    return { count: 0, windowStart: now };
  }
  if (now - data.windowStart >= JOIN_WINDOW_MS) return { count: 0, windowStart: now };
  return { count: data.count, windowStart: data.windowStart };
}

/**
 * Reserviert einen Versuch in einer Transaktion, *bevor* das Passwort
 * geprüft wird – sonst kämen parallele Anfragen alle an der Grenze vorbei.
 * Liefert den gesperrten Scope oder null (Versuch gezählt).
 */
export async function reserveJoinAttempt(
  db: Firestore,
  caller: JoinCaller,
  now: number,
): Promise<LimitScope | null> {
  const scopes = scopesOf(caller);
  return db.runTransaction(async (tx) => {
    const refs = scopes.map((s) => db.doc(counterPath(s.scope, s.key)));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    const counters = snaps.map((s) => current(s.data() as Partial<Counter> | undefined, now));
    const blocked = scopes.find((s, i) => counters[i].count >= s.max);
    if (blocked) return blocked.scope;
    refs.forEach((ref, i) => {
      const c = counters[i];
      tx.set(ref, { count: c.count + 1, windowStart: c.windowStart, expireAt: expireAt(c.windowStart) });
    });
    return null;
  });
}

/**
 * Nach erfolgreichem Beitritt nur den eigenen Versuch zurückgeben – nicht
 * den Zähler löschen: Sonst setzt ein Beitritt zur selbst angelegten Gruppe
 * die Fehlversuche gegen eine fremde Gruppe zurück. Echte Beitritte aus
 * einem WLAN verbrauchen so keine IP-Versuche.
 */
export async function releaseJoinAttempt(db: Firestore, caller: JoinCaller, now: number): Promise<void> {
  const scopes = scopesOf(caller);
  await db.runTransaction(async (tx) => {
    const refs = scopes.map((s) => db.doc(counterPath(s.scope, s.key)));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    refs.forEach((ref, i) => {
      if (!snaps[i].exists) return;
      const c = current(snaps[i].data() as Partial<Counter> | undefined, now);
      if (c.count > 0) tx.set(ref, { count: c.count - 1, windowStart: c.windowStart, expireAt: expireAt(c.windowStart) });
    });
  });
}

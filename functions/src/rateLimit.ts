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
      tx.set(ref, { count: counters[i].count + 1, windowStart: counters[i].windowStart });
    });
    return null;
  });
}

/**
 * Nach erfolgreichem Beitritt: UID-Zähler löschen, den reservierten
 * IP-Versuch zurückgeben (sonst sperren viele echte Beitritte aus einem
 * WLAN die IP).
 */
export async function releaseJoinAttempt(db: Firestore, caller: JoinCaller, now: number): Promise<void> {
  await db.runTransaction(async (tx) => {
    const uidRef = db.doc(counterPath("uid", caller.uid));
    const ipRef = caller.ip ? db.doc(counterPath("ip", caller.ip)) : null;
    const ipSnap = ipRef ? await tx.get(ipRef) : null;
    tx.delete(uidRef);
    if (ipRef && ipSnap?.exists) {
      const c = current(ipSnap.data() as Partial<Counter> | undefined, now);
      if (c.count > 0) tx.set(ipRef, { count: c.count - 1, windowStart: c.windowStart });
    }
  });
}

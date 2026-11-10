// Versand von Web-Push über FCM (Admin-SDK) plus Aufräumen ungültiger Tokens.
// Context7: firebase-admin-node messaging (sendEachForMulticast,
// MulticastMessage, WebpushConfig.headers, BatchResponse).
//
// Nachrichten sind IMMER Data-only (kein `notification`-Block): Anzeige macht
// ausschließlich unser Service Worker (public/firebase-messaging-sw.js) —
// sonst zeigt ein SDK-Worker die Meldung doppelt an.

import {
  FieldPath,
  FieldValue,
  type Firestore,
} from "firebase-admin/firestore";
import {
  getMessaging,
  type BatchResponse,
  type MulticastMessage,
} from "firebase-admin/messaging";

export type Urgency = "very-low" | "low" | "normal" | "high";

/** Versand-Funktion; injizierbar für Tests und den Emulator. */
export type Transport = (message: MulticastMessage) => Promise<BatchResponse>;

/** FCM erlaubt höchstens 500 Tokens pro sendEachForMulticast. */
export const MAX_TOKENS_PER_CALL = 500;

/** Maximale TTL, die FCM für Web-Push akzeptiert (4 Wochen). */
export const MAX_TTL_SECONDS = 2_419_200;

export interface SendInput {
  groupId: string;
  tokens: string[];
  /** Zuordnung Token → UID(s) für das Aufräumen ungültiger Tokens. */
  tokensByUid: Record<string, string[]>;
  data: Record<string, string | number | boolean | undefined | null>;
  urgency?: Urgency;
  ttlSeconds?: number;
}

export interface SendResult {
  sent: number;
  failed: number;
  removed: number;
}

/** FCM-Data-Werte müssen Strings sein; leere Werte fallen weg. */
export function toDataStrings(
  data: SendInput["data"],
): Record<string, string> {
  const out: Record<string, string> = { v: "1" };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
}

/** Baut die Multicast-Nachrichten (je höchstens 500 Tokens). */
export function buildMessages(
  tokens: string[],
  data: SendInput["data"],
  urgency: Urgency = "normal",
  ttlSeconds = 86_400,
): MulticastMessage[] {
  const unique = [...new Set(tokens)];
  const ttl = Math.max(0, Math.min(MAX_TTL_SECONDS, Math.round(ttlSeconds)));
  const payload = toDataStrings(data);
  const messages: MulticastMessage[] = [];
  for (let i = 0; i < unique.length; i += MAX_TOKENS_PER_CALL) {
    messages.push({
      tokens: unique.slice(i, i + MAX_TOKENS_PER_CALL),
      data: payload,
      webpush: { headers: { Urgency: urgency, TTL: String(ttl) } },
    });
  }
  return messages;
}

export function isInvalidTokenError(code: string | undefined): boolean {
  return (
    code === "messaging/invalid-registration-token" ||
    code === "messaging/registration-token-not-registered"
  );
}

/** Tokens, die FCM als ungültig/abgemeldet gemeldet hat (Reihenfolge wie `tokens`). */
export function invalidTokens(tokens: string[], response: BatchResponse): string[] {
  const out: string[] = [];
  response.responses.forEach((r, i) => {
    if (!r.success && isInvalidTokenError(r.error?.code) && tokens[i]) out.push(tokens[i]);
  });
  return out;
}

/** Im Emulator: statt zu senden nach groups/{gid}/_debugPush schreiben. */
export function emulatorTransport(db: Firestore, groupId: string): Transport {
  return async (message) => {
    await db.collection(`groups/${groupId}/_debugPush`).add({
      at: FieldValue.serverTimestamp(),
      tokens: message.tokens,
      data: message.data ?? {},
      webpush: message.webpush ?? {},
    });
    return {
      successCount: message.tokens.length,
      failureCount: 0,
      responses: message.tokens.map(() => ({ success: true, messageId: "emulator" })),
    };
  };
}

export function defaultTransport(db: Firestore, groupId: string): Transport {
  if (process.env.FUNCTIONS_EMULATOR === "true") return emulatorTransport(db, groupId);
  return (message) => getMessaging().sendEachForMulticast(message);
}

/**
 * Sendet Data-only an `tokens` und entfernt Tokens, die FCM als ungültig
 * meldet, aus pushTokens/{uid} (bei allen UIDs, unter denen sie liegen).
 */
export async function sendAndCleanup(
  db: Firestore,
  input: SendInput,
  transport: Transport = defaultTransport(db, input.groupId),
): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, removed: 0 };
  const messages = buildMessages(input.tokens, input.data, input.urgency, input.ttlSeconds);
  const stale = new Set<string>();
  for (const message of messages) {
    const res = await transport(message);
    result.sent += res.successCount;
    result.failed += res.failureCount;
    invalidTokens(message.tokens, res).forEach((t) => stale.add(t));
  }
  if (stale.size === 0) return result;

  const cleanups: Promise<unknown>[] = [];
  for (const [uid, tokens] of Object.entries(input.tokensByUid)) {
    for (const token of tokens) {
      if (!stale.has(token)) continue;
      result.removed += 1;
      cleanups.push(
        db
          .doc(`pushTokens/${uid}`)
          .update(new FieldPath(token), FieldValue.delete())
          .catch(() => undefined), // Doc inzwischen weg: egal
      );
    }
  }
  await Promise.all(cleanups);
  return result;
}

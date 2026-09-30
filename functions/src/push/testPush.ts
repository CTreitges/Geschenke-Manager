import type { Firestore } from "firebase-admin/firestore";
import { sendAndCleanup, type Transport } from "./send";
import { loadTokensByUid } from "./tokens";

/** Inhalt der Test-Meldung aus Einstellungen → Mitteilungen. */
export function testPushData(groupId: string): Record<string, string> {
  return {
    type: "test",
    groupId,
    title: "🔔 Test-Push",
    body: "Mitteilungen kommen auf diesem Gerät an.",
    url: "/settings",
    tag: "gm-test",
    renotify: "1",
  };
}

/**
 * Schickt eine Test-Meldung an alle Geräte-Tokens von `uid`. Auth- und
 * Mitgliedschafts-Prüfung macht die Callable (index.ts sendTestPush).
 */
export async function runTestPush(
  db: Firestore,
  uid: string,
  groupId: string,
  transport?: Transport,
): Promise<{ sent: number; failed: number }> {
  const tokensByUid = await loadTokensByUid(db, [uid]);
  const tokens = tokensByUid[uid] ?? [];
  if (tokens.length === 0) return { sent: 0, failed: 0 };
  const res = await sendAndCleanup(
    db,
    {
      groupId,
      tokens,
      tokensByUid,
      data: testPushData(groupId),
      urgency: "high",
      ttlSeconds: 600,
    },
    transport,
  );
  return { sent: res.sent, failed: res.failed };
}

import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
import { GROUP_ID, getDb } from "../emu-seed.mjs";

// archiveGroupDocChange im Functions-Emulator: Ändern und Löschen legen den
// Vorher-Stand unter groups/{gid}/_archive ab. Regression: im Emulator war
// admin.firestore.FieldValue undefined (der Emulator bindet admin.firestore,
// statische Member gehen dabei verloren) → der Trigger warf, es entstand nie
// ein Archiv-Eintrag. Geschrieben wird per Admin-SDK auf einen eigenen Wunsch
// mit Zufalls-ID (der Seed löscht und archiviert asynchron mit); der Trigger
// feuert trotzdem.

async function archiveEntries(docId: string) {
  const snap = await getDb().collection(`groups/${GROUP_ID}/_archive`).where("docId", "==", docId).get();
  return snap.docs.map((d) => d.data());
}

test("Ändern und Löschen eines Wunschs landen im Archiv", async () => {
  const id = `w-archive-${crypto.randomUUID()}`;
  const ref = getDb().doc(`groups/${GROUP_ID}/wishlist/${id}`);
  await ref.set({ personId: "anna", title: "Moleskine, dunkelgrün", createdAt: Date.now() });

  await ref.update({ title: "Moleskine, schwarz" });
  await expect
    .poll(async () => (await archiveEntries(id)).map((e) => e.op), { timeout: 30_000 })
    .toEqual(["update"]);
  const [updated] = await archiveEntries(id);
  expect(updated).toMatchObject({
    collection: "wishlist",
    docId: id,
    data: { title: "Moleskine, dunkelgrün", personId: "anna" },
  });
  // serverTimestamp() ist aufgelöst (vorher: FieldValue undefined → Trigger warf).
  expect(typeof updated.archivedAt?.toMillis).toBe("function");

  await ref.delete();
  await expect
    .poll(async () => (await archiveEntries(id)).map((e) => e.op).sort(), { timeout: 30_000 })
    .toEqual(["delete", "update"]);
});

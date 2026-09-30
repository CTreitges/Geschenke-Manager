// Firestore-Rules-Tests gegen den lokalen Emulator (Projekt demo-geschenke).
// Aufruf: `npm run test:rules` — firebase emulators:exec startet den
// Firestore-Emulator und setzt FIRESTORE_EMULATOR_HOST; ohne diese Variable
// bricht initializeTestEnvironment ab (kein Zugriff auf Produktion möglich).

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  setDoc,
  setLogLevel,
  updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "demo-geschenke";
const G = "g1";

let env: RulesTestEnvironment;

/** Firestore-Client als angemeldeter (anonymer) User mit dieser UID. */
const dbAs = (uid: string) => env.authenticatedContext(uid).firestore();

beforeAll(async () => {
  // Erwartete PERMISSION_DENIED-Warnungen des SDK nicht ins Log kippen.
  setLogLevel("error");
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `groups/${G}`), { defaultBudget: 20 });
    await setDoc(doc(db, `groups/${G}/members/alice`), { uid: "alice", joinedAt: 1 });
    await setDoc(doc(db, `groups/${G}/members/carol`), { uid: "carol", joinedAt: 2 });
    await setDoc(doc(db, `groups/${G}/gifts/gift1`), { personId: "p1", status: "open" });
    await setDoc(doc(db, `groups/${G}/_meta/auth`), { salt: "s", hash: "h", version: 1 });
  });
});

describe("groups/{g}/gifts", () => {
  it("Mitglied darf einzelne Geschenke und die Liste lesen", async () => {
    const db = dbAs("alice");
    await assertSucceeds(getDoc(doc(db, `groups/${G}/gifts/gift1`)));
    await assertSucceeds(getDocs(collection(db, `groups/${G}/gifts`)));
  });

  it("Nicht-Mitglied darf nichts lesen", async () => {
    const db = dbAs("bob");
    await assertFails(getDoc(doc(db, `groups/${G}/gifts/gift1`)));
    await assertFails(getDocs(collection(db, `groups/${G}/gifts`)));
  });

  it("Unangemeldete dürfen nichts lesen", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `groups/${G}/gifts/gift1`)));
  });
});

describe("groups/{g}/members/{uid}", () => {
  it("eigener Eintrag: notifyStack und identityPersonId dürfen geändert werden", async () => {
    const ref = doc(dbAs("alice"), `groups/${G}/members/alice`);
    await assertSucceeds(updateDoc(ref, { notifyStack: true }));
    await assertSucceeds(updateDoc(ref, { identityPersonId: "p1" }));
  });

  it("eigener Eintrag: joinedAt und uid bleiben unveränderlich", async () => {
    const ref = doc(dbAs("alice"), `groups/${G}/members/alice`);
    await assertFails(updateDoc(ref, { joinedAt: 999 }));
    await assertFails(updateDoc(ref, { uid: "mallory" }));
    await assertFails(updateDoc(ref, { notifyStack: true, joinedAt: 999 }));
  });

  it("fremder Eintrag darf nicht geändert werden", async () => {
    await assertFails(
      updateDoc(doc(dbAs("alice"), `groups/${G}/members/carol`), { notifyStack: true }),
    );
  });

  it("Beitritt am Server vorbei (eigenen Member-Eintrag anlegen) ist verboten", async () => {
    await assertFails(
      setDoc(doc(dbAs("bob"), `groups/${G}/members/bob`), { uid: "bob", joinedAt: 3 }),
    );
  });

  it("eigener Eintrag: notifyPolls darf geändert werden, auch zusammen mit notifyStack", async () => {
    const ref = doc(dbAs("alice"), `groups/${G}/members/alice`);
    await assertSucceeds(updateDoc(ref, { notifyPolls: false }));
    await assertSucceeds(updateDoc(ref, { notifyStack: true, notifyPolls: true }));
    await assertSucceeds(setDoc(ref, { identityPersonId: "p1", notifyPolls: true }, { merge: true }));
  });

  it("eigener Eintrag: fremde Felder bleiben verboten, auch neben notifyPolls", async () => {
    const ref = doc(dbAs("alice"), `groups/${G}/members/alice`);
    await assertFails(updateDoc(ref, { notifyPolls: true, viaMagicLink: true }));
    await assertFails(updateDoc(ref, { notifyPollsX: true }));
    await assertFails(updateDoc(ref, { role: "admin" }));
  });

  it("fremder Eintrag: notifyPolls darf nicht geändert werden", async () => {
    await assertFails(
      updateDoc(doc(dbAs("alice"), `groups/${G}/members/carol`), { notifyPolls: false }),
    );
  });
});

describe("pushTokens/{uid}", () => {
  const TOKEN = "fcm:APA91b-test_token";

  it("eigenes Token-Doc: Upsert eines Tokens und Löschen per Feldpfad", async () => {
    const db = dbAs("alice");
    const ref = doc(db, "pushTokens/alice");
    await assertSucceeds(setDoc(ref, { [TOKEN]: { ua: "x", addedAt: 1 } }, { merge: true }));
    await assertSucceeds(updateDoc(ref, new FieldPath(TOKEN), deleteField()));
    await assertSucceeds(getDoc(ref));
  });

  it("fremdes Token-Doc ist weder lesbar noch schreibbar", async () => {
    const ref = doc(dbAs("alice"), "pushTokens/carol");
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { [TOKEN]: { ua: "x" } }, { merge: true }));
  });
});

describe("groups/{g}/_push und _debugPush", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `groups/${G}/_push/birthday-p1-2026`), { kind: "birthday", at: 1 });
      await setDoc(doc(db, `groups/${G}/_debugPush/d1`), { tokens: ["t"] });
    });
  });

  it("Mitglieder dürfen Push-Marker weder lesen, anlegen, ändern noch löschen", async () => {
    const db = dbAs("alice");
    const marker = doc(db, `groups/${G}/_push/birthday-p1-2026`);
    await assertFails(getDoc(marker));
    await assertFails(getDocs(collection(db, `groups/${G}/_push`)));
    await assertFails(setDoc(doc(db, `groups/${G}/_push/poll_started-x`), { kind: "poll" }));
    await assertFails(updateDoc(marker, { at: 2 }));
    await assertFails(deleteDoc(marker));
  });

  it("Emulator-Versandprotokoll ist für Clients gesperrt", async () => {
    const db = dbAs("alice");
    await assertFails(getDoc(doc(db, `groups/${G}/_debugPush/d1`)));
    await assertFails(setDoc(doc(db, `groups/${G}/_debugPush/d2`), { tokens: [] }));
  });
});

describe("groups/{g}/_meta", () => {
  it("Passwort-Hash ist auch für Mitglieder weder lesbar noch schreibbar", async () => {
    const ref = doc(dbAs("alice"), `groups/${G}/_meta/auth`);
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { salt: "x", hash: "y", version: 1 }));
  });
});

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
  arrayUnion,
  setDoc,
  setLogLevel,
  updateDoc,
  writeBatch,
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

describe("groups/{g}/suggestions – Sperre während der Abstimmung", () => {
  const HOUR = 3_600_000;
  const idea = { giftId: "gift1", title: "Buch", suggestedBy: "p2", createdAt: 1 };
  const addIdea = (uid = "alice", data: Record<string, unknown> = idea) =>
    setDoc(doc(dbAs(uid), `groups/${G}/suggestions/new-idea`), data);

  async function seedPoll(data: Record<string, unknown>, giftId = "gift1") {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `groups/${G}/polls/${giftId}`), { votes: {}, ...data });
    });
  }

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `groups/${G}/gifts/gift2`), { personId: "p3", status: "open" });
      await setDoc(doc(db, `groups/${G}/suggestions/s1`), { ...idea, title: "Alt" });
    });
  });

  it("ohne Abstimmung darf eine Idee angelegt werden", async () => {
    await assertSucceeds(addIdea());
  });

  it("laufende Abstimmung (Frist in der Zukunft) sperrt neue Ideen", async () => {
    const now = Date.now();
    await seedPoll({ status: "active", startedAt: now - HOUR, endsAt: now + HOUR });
    await assertFails(addIdea());
  });

  it("Alt-Abstimmung ohne endsAt läuft 48 Std ab Start (KOR-03)", async () => {
    await seedPoll({ status: "active", startedAt: Date.now() - HOUR });
    await assertFails(addIdea());
  });

  it("Alt-Abstimmung ohne endsAt ist nach 48 Std vorbei und gibt Ideen frei (KOR-03)", async () => {
    await seedPoll({ status: "active", startedAt: Date.now() - 49 * HOUR });
    await assertSucceeds(addIdea());
  });

  it("endsAt ≤ startedAt (Rest einer Vorrunde) → Frist startedAt + 48 Std (KOR-03)", async () => {
    const now = Date.now();
    await seedPoll({ status: "active", startedAt: now - HOUR, endsAt: now - 2 * HOUR });
    await assertFails(addIdea());
    await seedPoll({ status: "active", startedAt: now - 49 * HOUR, endsAt: now - 50 * HOUR });
    await assertSucceeds(addIdea());
  });

  it("aktive Runde ohne startedAt gilt als abgelaufen und sperrt nicht (KOR-03)", async () => {
    await seedPoll({ status: "active", endsAt: Date.now() + HOUR });
    await assertSucceeds(addIdea());
  });

  it("abgelaufene Frist gibt Ideen frei, auch bevor der Server schließt", async () => {
    const now = Date.now();
    await seedPoll({ status: "active", startedAt: now - 3 * HOUR, endsAt: now - HOUR });
    await assertSucceeds(addIdea());
  });

  it("beendete Abstimmung sperrt nicht", async () => {
    const now = Date.now();
    await seedPoll({ status: "closed", startedAt: now - HOUR, endsAt: now + HOUR, closedAt: now });
    await assertSucceeds(addIdea());
  });

  it("die Abstimmung eines anderen Geschenks sperrt nicht", async () => {
    await seedPoll({ status: "active", startedAt: Date.now() - HOUR }, "gift2");
    await assertSucceeds(addIdea());
  });

  it("nur Anlegen ist gesperrt: Ändern und Löschen bleiben erlaubt", async () => {
    await seedPoll({ status: "active", startedAt: Date.now() - HOUR });
    const ref = doc(dbAs("alice"), `groups/${G}/suggestions/s1`);
    await assertSucceeds(updateDoc(ref, { paidBy: "p2" }));
    await assertSucceeds(deleteDoc(ref));
  });

  it("Geschenk löschen (Batch aus Geschenk, Ideen und Poll) geht auch während der Wahl", async () => {
    await seedPoll({ status: "active", startedAt: Date.now() - HOUR });
    const db = dbAs("alice");
    const batch = writeBatch(db);
    batch.delete(doc(db, `groups/${G}/gifts/gift1`));
    batch.delete(doc(db, `groups/${G}/suggestions/s1`));
    batch.delete(doc(db, `groups/${G}/polls/gift1`));
    await assertSucceeds(batch.commit());
  });

  it("Nicht-Mitglieder dürfen auch ohne Abstimmung nichts anlegen", async () => {
    await assertFails(addIdea("bob"));
  });
});

describe("groups/{g}/polls – Validierung", () => {
  const pollRef = (uid = "alice") => doc(dbAs(uid), `groups/${G}/polls/gift1`);
  const now = Date.now();
  const fresh = { giftId: "gift1", status: "active", startedAt: now, startedBy: "p2", endsAt: now + 3_600_000, votes: {} };

  it("neue Runde mit ganzzahliger Frist ist erlaubt", async () => {
    await assertSucceeds(setDoc(pollRef(), fresh));
  });

  it("Status außerhalb von active/closed/none ist verboten", async () => {
    await assertFails(setDoc(pollRef(), { ...fresh, status: "paused" }));
    await assertFails(setDoc(pollRef(), { ...fresh, status: 1 }));
  });

  it("alter Client verwirft per merge mit status none (KOR-02)", async () => {
    await assertSucceeds(setDoc(pollRef(), fresh));
    await assertSucceeds(setDoc(pollRef(), { status: "none" }, { merge: true }));
  });

  it("endsAt muss eine ganze Zahl sein", async () => {
    await assertFails(setDoc(pollRef(), { ...fresh, endsAt: "morgen" }));
    await assertFails(setDoc(pollRef(), { ...fresh, endsAt: 1.5 }));
  });

  it("Stimme setzen, beenden und löschen", async () => {
    await assertSucceeds(setDoc(pollRef(), fresh));
    await assertSucceeds(updateDoc(pollRef(), new FieldPath("votes", "p2"), arrayUnion("s1")));
    await assertSucceeds(updateDoc(pollRef(), new FieldPath("votes", "p2"), deleteField()));
    await assertSucceeds(updateDoc(pollRef(), { status: "closed", closedAt: now, closedReason: "manual" }));
    await assertSucceeds(deleteDoc(pollRef()));
  });

  it("Nicht-Mitglieder dürfen keine Abstimmung starten", async () => {
    await assertFails(setDoc(pollRef("bob"), fresh));
  });
});

describe("groups/{g}/polls – Stimmen nur in der laufenden Runde (KOR-10)", () => {
  const HOUR = 3_600_000;
  const pollRef = () => doc(dbAs("alice"), `groups/${G}/polls/gift1`);
  const vote = () => updateDoc(pollRef(), new FieldPath("votes", "p2"), arrayUnion("s1"));
  const unvote = () => updateDoc(pollRef(), new FieldPath("votes", "p2"), deleteField());

  async function seedPoll(data: Record<string, unknown>) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `groups/${G}/polls/gift1`), {
        giftId: "gift1",
        votes: { p2: ["s0"] },
        ...data,
      });
    });
  }

  it("laufende Runde: Stimme setzen und zurücknehmen", async () => {
    const now = Date.now();
    await seedPoll({ status: "active", startedAt: now - HOUR, endsAt: now + HOUR });
    await assertSucceeds(vote());
    await assertSucceeds(unvote());
  });

  it("Frist abgelaufen, Server hat noch nicht geschlossen: keine Stimmen mehr", async () => {
    const now = Date.now();
    await seedPoll({ status: "active", startedAt: now - 3 * HOUR, endsAt: now - HOUR });
    await assertFails(vote());
    await assertFails(unvote());
  });

  it("beendete Runde: Stimmen bleiben, wie sie sind", async () => {
    const now = Date.now();
    await seedPoll({ status: "closed", startedAt: now - HOUR, endsAt: now + HOUR, closedAt: now });
    await assertFails(vote());
    await assertFails(unvote());
  });

  it("Alt-Runde ohne gültige Frist: 48 Std ab Start abstimmbar, danach nicht", async () => {
    const now = Date.now();
    await seedPoll({ status: "active", startedAt: now - HOUR, endsAt: now - 2 * HOUR });
    await assertSucceeds(vote());
    await seedPoll({ status: "active", startedAt: now - 49 * HOUR });
    await assertFails(vote());
  });

  it("Beenden und Verlängern einer abgelaufenen Runde bleiben erlaubt", async () => {
    const now = Date.now();
    await seedPoll({ status: "active", startedAt: now - 3 * HOUR, endsAt: now - HOUR });
    await assertSucceeds(updateDoc(pollRef(), { endsAt: now + HOUR }));
    await seedPoll({ status: "active", startedAt: now - 3 * HOUR, endsAt: now - HOUR });
    await assertSucceeds(updateDoc(pollRef(), { status: "closed", closedAt: now - HOUR, closedReason: "timeout" }));
  });
});

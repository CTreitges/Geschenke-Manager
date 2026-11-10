import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import type { Firestore } from "firebase-admin/firestore";
import { GROUP_ID, getDb, seed } from "../emu-seed.mjs";
import { loginAs } from "./helpers";

// Abstimmungs-Pushes gegen die Emulatoren. Im Functions-Emulator schickt
// sendAndCleanup nichts an FCM, sondern schreibt jede Multicast-Nachricht nach
// groups/{gid}/_debugPush (functions/src/push/send.ts, emulatorTransport).
// Geprüft wird, WER einen Push bekäme: poll_started nur an Wahlberechtigte
// ohne Starter, die Erinnerung nur an Wahlberechtigte ohne Stimme – nie an
// Geräte der beschenkten Person (auch nicht über ein geteiltes Gerät), nie an
// Mitglieder ohne Identität oder Nicht-Teilnehmer, jedes Ereignis einmal.
//
// sweepPolls ist ein Scheduler-Job; der Emulator startet ihn ohne
// Pub/Sub-Emulator nie. Deshalb ruft der Test den exportierten Kern
// runPollSweep aus functions/lib (von `pree2e` gebaut) mit eigener Uhrzeit
// gegen denselben Firestore-Emulator auf – mit explizitem Emulator-Transport,
// damit dieser Prozess nie FCM erreicht.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Transport = (message: unknown) => Promise<unknown>;
interface PollDeps {
  db: Firestore;
  transportFor: (groupId: string) => Transport;
}
interface SweepStats {
  closed: Record<string, number>;
  reminded: number;
  sent: number;
  errors: number;
}
type PollDocLike = { startedAt?: number; endsAt?: number };

const requireFunctions = createRequire(new URL("../../functions/package.json", import.meta.url));
const { runPollSweep } = requireFunctions("./lib/polls/sweepPolls.js") as {
  runPollSweep: (deps: PollDeps, now: number) => Promise<SweepStats>;
};
const { handlePollWrite } = requireFunctions("./lib/polls/onPollWritten.js") as {
  handlePollWrite: (
    deps: PollDeps,
    input: { groupId: string; giftId: string; before: unknown; after: unknown; now: number },
  ) => Promise<{ sent: number; skipped?: string }>;
};
const { emulatorTransport } = requireFunctions("./lib/push/send.js") as {
  emulatorTransport: (db: Firestore, groupId: string) => Transport;
};
const { reminderDueAt, isQuietTime } = requireFunctions("./lib/shared/poll.js") as {
  reminderDueAt: (poll: PollDocLike) => number | null;
  isQuietTime: (ts: number) => boolean;
};

const deps = (): PollDeps => ({ db: getDb(), transportFor: (gid) => emulatorTransport(getDb(), gid) });

/**
 * Geräte in der Demo-Gruppe: UID → Identität, Opt-ins, Tokens. Das
 * Familien-Tablet liegt unter Ben (beschenkt) UND Lena (wahlberechtigt).
 */
const DEVICES = [
  { uid: "demo-uid-lena", identity: "lena", notifyStack: true, tokens: ["tok-lena", "tok-familien-tablet"] },
  { uid: "demo-uid-ben", identity: "ben", notifyStack: true, tokens: ["tok-ben", "tok-familien-tablet"] },
  { uid: "demo-uid-sophie", identity: "sophie", notifyStack: false, notifyPolls: true, tokens: ["tok-sophie"] },
  { uid: "demo-uid-sophie-2", identity: "sophie", notifyStack: true, notifyPolls: false, tokens: ["tok-sophie-aus"] },
  { uid: "demo-uid-anna-tablet", identity: "anna", notifyStack: true, tokens: ["tok-anna-tablet"] },
  { uid: "demo-uid-christof", identity: "christof", notifyStack: true, tokens: ["tok-christof"] },
  { uid: "demo-uid-max", identity: "max", notifyStack: true, tokens: ["tok-max"] },
  { uid: "demo-uid-ohne-identitaet", identity: "", notifyStack: true, notifyPolls: true, tokens: ["tok-ohne-identitaet"] },
] as const;

/** Alle Tokens der Geräte mit dieser Identität (auch geteilte). */
const tokensOf = (identity: string): Set<string> =>
  new Set(DEVICES.filter((d) => d.identity === identity).flatMap((d) => [...d.tokens]));

async function seedDevices() {
  const db = getDb();
  const batch = db.batch();
  for (const d of DEVICES) {
    batch.set(db.doc(`groups/${GROUP_ID}/members/${d.uid}`), {
      uid: d.uid,
      joinedAt: Date.now() - 30 * DAY,
      identityPersonId: d.identity,
      notifyStack: d.notifyStack,
      ...("notifyPolls" in d ? { notifyPolls: d.notifyPolls } : {}),
    });
    batch.set(
      db.doc(`pushTokens/${d.uid}`),
      Object.fromEntries(d.tokens.map((t) => [t, { ua: "e2e", addedAt: Date.now() }])),
    );
  }
  await batch.commit();
}

interface DebugPush {
  tokens: string[];
  data: Record<string, string>;
}

async function debugPushes(): Promise<DebugPush[]> {
  const snap = await getDb().collection(`groups/${GROUP_ID}/_debugPush`).get();
  return snap.docs.map((d) => d.data() as DebugPush);
}

async function pushesFor(giftId: string, kind: string): Promise<DebugPush[]> {
  return (await debugPushes()).filter((p) => p.data.giftId === giftId && p.data.kind === kind);
}

const sorted = (tokens: Iterable<string>) => [...tokens].sort();

let giftIds: Record<string, string>;

test.beforeEach(async () => {
  ({ giftIds } = await seed());
  await seedDevices();
});

test.afterAll(async () => {
  const db = getDb();
  await Promise.all(DEVICES.map((d) => db.doc(`pushTokens/${d.uid}`).delete()));
  await seed(); // Sweep hat Annas Abstimmung geschlossen → frischer Stand für die nächste Datei
});

test("Abstimmungs-Pushes erreichen nie die beschenkte Person und kommen je Ereignis einmal", async ({ page }) => {
  const db = getDb();
  const giftId = giftIds.ben; // beschenkt: Ben · wahlberechtigt: Anna, Lena, Sophie
  const pollRef = db.doc(`groups/${GROUP_ID}/polls/${giftId}`);
  await db.doc(`groups/${GROUP_ID}/suggestions/s-ben-2`).set({
    giftId,
    title: "10er-Karte Kletterhalle",
    price: 120,
    suggestedBy: "lena",
    createdAt: Date.now() - DAY,
  });

  // 1) Anna startet die Abstimmung über die UI.
  await loginAs(page, "Anna");
  await page.goto(`/gift/${giftId}`);
  const nowCard = page.getByRole("region", { name: "Jetzt" });
  await expect(nowCard).toContainText("2 Ideen gesammelt");
  await nowCard.getByRole("button", { name: "Abstimmung starten" }).click();
  const start = page.getByRole("dialog", { name: "Abstimmung starten" });
  await start.getByRole("button", { name: "Abstimmung starten" }).click();
  await expect(page.getByRole("dialog", { name: "Abstimmung · für Ben" })).toBeVisible();

  // poll_started: Lena und Sophie (nur deren Opt-in-Geräte). Nicht: Anna
  // (Starterin, auch ihr Tablet), Ben + Familien-Tablet, Sophies Gerät ohne
  // Abstimmungs-Opt-in, Mitglied ohne Identität, Nicht-Teilnehmer Max/Christof.
  await expect.poll(async () => (await pushesFor(giftId, "poll_started")).length, { timeout: 30_000 }).toBe(1);
  const [started] = await pushesFor(giftId, "poll_started");
  expect(sorted(started.tokens)).toEqual(["tok-lena", "tok-sophie"]);
  expect(started.data).toMatchObject({
    type: "poll_started",
    title: "🗳️ Abstimmung für Bens Geschenk",
    url: `/g/${GROUP_ID}/gift/${giftId}?vote=1`,
  });
  expect(started.data.body).toMatch(/^Anna hat 2 Ideen zur Wahl gestellt – endet /);
  // Neutraler Text: keine Ideen-Titel, keine Preise auf dem Sperrbildschirm.
  expect(`${started.data.title} ${started.data.body}`).not.toMatch(/Espresso|Kletterhalle|€|\b35\b|\b120\b/);

  // 2) Idempotenz: doppelt zugestellter Trigger (at-least-once) und erneutes
  // Schreiben ohne neue Runde (Stimme, identischer Stand) schicken nichts.
  const poll = (await pollRef.get()).data()!;
  const again = await handlePollWrite(deps(), { groupId: GROUP_ID, giftId, before: undefined, after: poll, now: Date.now() });
  expect(again).toEqual({ sent: 0, skipped: "duplicate" });
  await pollRef.update({ "votes.lena": ["s-ben-1"] });
  await pollRef.set({ ...poll, votes: { lena: ["s-ben-1"] } });

  // 3) Erinnerung über den Sweep-Kern: vor der Fälligkeit nichts, dann genau
  // einmal an die Wahlberechtigten ohne Stimme (Anna, Sophie) – Lena hat gewählt.
  const due = reminderDueAt(poll)!;
  expect(due).toBeGreaterThan(poll.startedAt);
  expect(isQuietTime(due)).toBe(false);
  await runPollSweep(deps(), due - 60_000);
  expect(await pushesFor(giftId, "poll_reminder")).toHaveLength(0);

  const first = await runPollSweep(deps(), due);
  expect(first.errors).toBe(0);
  const reminders = await pushesFor(giftId, "poll_reminder");
  expect(reminders).toHaveLength(1);
  expect(sorted(reminders[0].tokens)).toEqual(["tok-anna-tablet", "tok-sophie"]);
  expect(reminders[0].data.body).toBe("Für Bens Geschenk fehlt noch deine Stimme.");
  await runPollSweep(deps(), due + 5 * 60_000);
  expect(await pushesFor(giftId, "poll_reminder")).toHaveLength(1);

  // 4) Ablauf: der Sweep schließt mit Grund „timeout“ zum echten Ende, ohne Push.
  const closing = await runPollSweep(deps(), poll.endsAt + 60_000);
  expect(closing.closed.timeout).toBeGreaterThanOrEqual(1);
  expect((await pollRef.get()).data()).toMatchObject({ status: "closed", closedReason: "timeout", closedAt: poll.endsAt });

  // 5) Gegenprobe mit einem zweiten Geschenk (beschenkt: Christof, Start durch
  // Max): Bens Geräte sind hier erlaubt, Christofs Gerät nicht. Kommt dieser
  // Push an, sind die Trigger der Schritte 2 und 4 längst durch.
  const now = Date.now();
  await db.doc(`groups/${GROUP_ID}/polls/${giftIds.christof}`).set({
    giftId: giftIds.christof,
    status: "active",
    startedAt: now,
    startedBy: "max",
    endsAt: now + 48 * HOUR,
    votes: {},
  });
  await expect
    .poll(async () => (await pushesFor(giftIds.christof, "poll_started")).length, { timeout: 30_000 })
    .toBe(1);
  const [control] = await pushesFor(giftIds.christof, "poll_started");
  expect(sorted(control.tokens)).toEqual(["tok-anna-tablet", "tok-ben", "tok-familien-tablet", "tok-sophie"]);

  expect(await pushesFor(giftId, "poll_started")).toHaveLength(1);
  expect(await pushesFor(giftId, "poll_reminder")).toHaveLength(1);

  // Invariante über ALLE Einträge (auch Annas Seed-Abstimmung): nie ein Gerät
  // der jeweils beschenkten Person, nie ein Mitglied ohne Identität.
  const giftOwner = new Map(Object.entries(giftIds).map(([person, id]) => [id, person.replace(/Past$/, "")]));
  const all = await debugPushes();
  expect(all.length).toBeGreaterThanOrEqual(3);
  for (const p of all) {
    const owner = giftOwner.get(p.data.giftId);
    expect(owner, `unbekanntes Geschenk ${p.data.giftId}`).toBeTruthy();
    const forbidden = new Set([...tokensOf(owner!), ...tokensOf("")]);
    expect(p.tokens.filter((t) => forbidden.has(t)), `${p.data.kind} für ${owner}`).toEqual([]);
  }
});

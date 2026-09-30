// Befüllt den LOKALEN Firestore-Emulator (Projekt demo-geschenke) mit einer
// Demo-Gruppe "demo" / Passwort "demo1234". Berührt niemals Produktion:
// Projekt-ID ist fest demo-geschenke, FIRESTORE_EMULATOR_HOST ist Pflicht.
//
// Standalone: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node e2e/emu-seed.mjs
// (normalerweise via `npm run emu:shots` → e2e/emu-run.mjs)

import { createRequire } from "node:module";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

export const PROJECT_ID = "demo-geschenke";
export const GROUP_ID = "demo";
export const GROUP_PASSWORD = "demo1234";

// firebase-admin liegt nur in functions/node_modules.
const require = createRequire(new URL("../functions/package.json", import.meta.url));

let dbInstance = null;

/** Admin-Firestore gegen den Emulator — bricht ab, wenn kein Emulator gesetzt ist. */
export function getDb() {
  if (dbInstance) return dbInstance;
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
  process.env.GCLOUD_PROJECT = PROJECT_ID;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
    throw new Error(
      `FIRESTORE_EMULATOR_HOST zeigt nicht auf localhost: ${process.env.FIRESTORE_EMULATOR_HOST}`,
    );
  }
  const { initializeApp, getApps } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  if (app.options.projectId !== PROJECT_ID) {
    throw new Error(`Falsche Projekt-ID: ${app.options.projectId}`);
  }
  dbInstance = getFirestore(app);
  return dbInstance;
}

// Identisch zu hashPassword/randomSalt in functions/src/index.ts.
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 210_000, 32, "sha256").toString("hex");
}
function randomSalt() {
  return crypto.randomBytes(16).toString("hex");
}

const pad = (n) => String(n).padStart(2, "0");
const DAY = 86_400_000;

/** Datum `n` Tage ab heute (lokale Mitternacht). */
function inDays(n) {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + n);
}
const mmdd = (d) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function setDarkMode(on) {
  await getDb().doc(`groups/${GROUP_ID}`).set({ darkMode: on }, { merge: true });
}

export async function seed() {
  const db = getDb();
  const now = Date.now();
  const groupRef = db.doc(`groups/${GROUP_ID}`);

  // Frischer Stand bei wiederholtem Lauf gegen denselben Emulator.
  await db.recursiveDelete(groupRef);

  const bd = {
    christof: inDays(8),
    anna: inDays(15),
    ben: inDays(20),
    lena: inDays(25),
    max: inDays(45),
    sophie: inDays(200),
  };
  // Farben aus src/lib/colors.ts (PALETTE)
  const persons = {
    christof: { name: "Christof", color: "#4F46E5", email: "christof@example.com" },
    anna: { name: "Anna", color: "#DB2777", email: "anna@example.com" },
    ben: { name: "Ben", color: "#0891B2" },
    lena: { name: "Lena", color: "#16A34A" },
    max: { name: "Max", color: "#D97706" },
    sophie: { name: "Sophie", color: "#7C3AED" },
  };
  const participants = {
    christof: ["anna", "ben", "max", "sophie"],
    anna: ["christof", "ben", "lena", "max"],
    ben: ["anna", "lena", "sophie"],
    lena: ["anna", "ben", "christof"],
  };
  const year = (id) => bd[id].getFullYear();
  const giftId = (id, y = year(id)) => `${id}_${y}`;

  const batch = db.batch();
  const salt = randomSalt();
  batch.set(groupRef, { defaultBudget: 20, darkMode: true, createdAt: now - 120 * DAY });
  batch.set(db.doc(`groups/${GROUP_ID}/_meta/auth`), {
    salt,
    hash: hashPassword(GROUP_PASSWORD, salt),
    version: 1,
  });

  // Andere Gruppenmitglieder mit gesetzter „Wer bin ich?"-Identität.
  for (const pid of ["lena", "max", "sophie"]) {
    const uid = `demo-uid-${pid}`;
    batch.set(db.doc(`groups/${GROUP_ID}/members/${uid}`), {
      uid,
      joinedAt: now - 60 * DAY,
      identityPersonId: pid,
    });
  }

  let order = 0;
  for (const [id, p] of Object.entries(persons)) {
    batch.set(db.doc(`groups/${GROUP_ID}/persons/${id}`), {
      name: p.name,
      birthday: mmdd(bd[id]),
      color: p.color,
      ...(p.email ? { email: p.email } : {}),
      ...(participants[id] ? { defaultParticipantIds: participants[id] } : {}),
      createdAt: now - (100 - order++) * DAY,
    });
  }

  // ── Wunschlisten ─────────────────────────────────────
  const wishlist = [
    ["w-anna-1", "anna", "Keramik-Workshop Gutschein", 45, "https://example.com/keramik"],
    ["w-anna-2", "anna", "Moleskine Notizbuch A5, dunkelgrün", 22],
    ["w-ben-1", "ben", "Bluetooth-Lautsprecher JBL Flip 6", 99, "https://example.com/jbl-flip-6"],
    ["w-ben-2", "ben", "Kochbuch „Simple“ von Ottolenghi", 28],
    ["w-ben-3", "ben", "10er-Karte Kletterhalle", 120],
    ["w-christof-1", "christof", "Noise-Cancelling-Kopfhörer", 249, "https://example.com/kopfhoerer"],
    ["w-christof-2", "christof", "Bialetti Moka Express (6 Tassen)", 32],
    ["w-christof-3", "christof", "Buch „Der Überläufer“ – Siegfried Lenz", 14],
    ["w-christof-4", "christof", "LEGO Icons Schreibmaschine", 199, "https://example.com/lego"],
  ];
  wishlist.forEach(([id, personId, title, price, url], i) => {
    batch.set(db.doc(`groups/${GROUP_ID}/wishlist/${id}`), {
      personId,
      title,
      price,
      ...(url ? { url } : {}),
      createdAt: now - (40 - i) * DAY,
    });
  });

  // ── Geschenke ────────────────────────────────────────
  const gift = (id, extra) =>
    batch.set(db.doc(`groups/${GROUP_ID}/gifts/${extra.id ?? giftId(id)}`), {
      personId: id,
      year: extra.year ?? year(id),
      status: extra.status ?? "open",
      budgetPerPerson: 20,
      manuallyAdded: false,
      stackOrder: extra.stackOrder,
      enteredStackAt: extra.enteredStackAt ?? now - 5 * DAY,
      participantIds: extra.participantIds ?? participants[id],
      ...(extra.selectedSuggestionIds ? { selectedSuggestionIds: extra.selectedSuggestionIds } : {}),
      ...(extra.receivedAt ? { receivedAt: extra.receivedAt } : {}),
      ...(extra.whatsappLink ? { whatsappLink: extra.whatsappLink } : {}),
    });
  gift("christof", { stackOrder: 1, enteredStackAt: now - 22 * DAY });
  gift("anna", { stackOrder: 2, enteredStackAt: now - 15 * DAY });
  gift("ben", { stackOrder: 3, enteredStackAt: now - 10 * DAY });
  gift("lena", {
    stackOrder: 4,
    enteredStackAt: now - 5 * DAY,
    status: "confirmed",
    selectedSuggestionIds: ["s-lena-1", "s-lena-2"],
    whatsappLink: "https://chat.whatsapp.com/DemoLenaGeschenk",
  });
  const maxLastYear = year("max") - 1;
  const maxBdLastYear = new Date(maxLastYear, bd.max.getMonth(), bd.max.getDate(), 19);
  gift("max", {
    id: giftId("max", maxLastYear),
    year: maxLastYear,
    status: "received",
    stackOrder: 0,
    enteredStackAt: maxBdLastYear.getTime() - 30 * DAY,
    receivedAt: maxBdLastYear.getTime(),
    participantIds: ["christof", "anna", "sophie"],
    selectedSuggestionIds: ["s-max-1", "s-max-2"],
  });

  // ── Vorschläge ───────────────────────────────────────
  // [id, gift-person, title, price, suggestedBy, extra]
  const suggestions = [
    ["s-anna-1", "anna", "Keramik-Workshop Gutschein", 45, "christof", { fromWishItemId: "w-anna-1", url: "https://example.com/keramik" }],
    ["s-anna-2", "anna", "Picknickdecke mit Kühlfach", 39, "lena", { url: "https://example.com/picknick" }],
    ["s-anna-3", "anna", "2 Konzertkarten AnnenMayKantereit", 78, "max"],
    ["s-anna-4", "anna", "Pflanzen-Abo (3 Monate)", 36, "ben"],
    ["s-ben-1", "ben", "Retro-Espressokocher", 35, "anna", { url: "https://example.com/espresso" }],
    ["s-christof-1", "christof", "Plattenspieler Audio-Technica LP60X", 149, "anna", { url: "https://example.com/plattenspieler" }],
    ["s-christof-2", "christof", "Whisky-Tasting für zwei", 70, "ben"],
    ["s-christof-3", "christof", "Fahrrad-Werkzeugset", 55, "max"],
    ["s-lena-1", "lena", "Yogamatte Manduka PRO", 85, "anna", { paidBy: "ben" }],
    ["s-lena-2", "lena", "Tee-Adventskalender", 30, "christof", { paidBy: "ben" }],
    ["s-lena-3", "lena", "Polaroid-Kamera Now+", 110, "ben"],
    ["s-max-1", "max", "Siebträger-Tamper-Set", 40, "christof", { paidBy: "christof" }],
    ["s-max-2", "max", "Kaffeebohnen-Abo (2 Monate)", 45, "sophie", { paidBy: "anna" }],
  ];
  suggestions.forEach(([id, pid, title, price, suggestedBy, extra = {}], i) => {
    const gid = pid === "max" ? giftId("max", maxLastYear) : giftId(pid);
    const createdAt = pid === "max" ? maxBdLastYear.getTime() - (20 - i) * DAY : now - (9 - (i % 8)) * DAY;
    batch.set(db.doc(`groups/${GROUP_ID}/suggestions/${id}`), {
      giftId: gid,
      title,
      price,
      suggestedBy,
      createdAt,
      ...extra,
    });
  });

  // ── Abstimmungen (poll-doc-id = giftId, siehe storage.setPollStatus) ──
  batch.set(db.doc(`groups/${GROUP_ID}/polls/${giftId("anna")}`), {
    status: "active",
    startedAt: now - 26 * 3_600_000,
    votes: {
      christof: ["s-anna-1"],
      lena: ["s-anna-1", "s-anna-3"],
      max: ["s-anna-3"],
    },
  });
  batch.set(db.doc(`groups/${GROUP_ID}/polls/${giftId("christof")}`), {
    status: "closed",
    startedAt: now - 4 * DAY,
    closedAt: now - 1 * DAY,
    votes: {
      anna: ["s-christof-1"],
      ben: ["s-christof-1", "s-christof-2"],
      max: ["s-christof-3"],
      sophie: ["s-christof-1"],
    },
  });

  await batch.commit();
  return {
    giftIds: {
      christof: giftId("christof"),
      anna: giftId("anna"),
      ben: giftId("ben"),
      lena: giftId("lena"),
      maxPast: giftId("max", maxLastYear),
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed()
    .then((r) => {
      console.log("[emu-seed] fertig:", r.giftIds);
      process.exit(0);
    })
    .catch((e) => {
      console.error("[emu-seed] Fehler:", e);
      process.exit(1);
    });
}

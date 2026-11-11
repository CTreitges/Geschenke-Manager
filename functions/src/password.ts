import * as crypto from "crypto";
import { promisify } from "util";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

// Parameter NICHT ändern: Bestehende Hashes unter groups/{id}/_meta/auth
// (version 1) sind damit erzeugt.
export const PBKDF2_ITERATIONS = 210_000;
export const PBKDF2_KEYLEN = 32;
export const PBKDF2_DIGEST = "sha256";

const pbkdf2 = promisify(crypto.pbkdf2);

/**
 * PBKDF2 asynchron im libuv-Threadpool – pbkdf2Sync blockierte die
 * Event-Loop der Instanz (~100 ms je Aufruf) für alle parallelen Requests.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return key.toString("hex");
}

export function randomSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

function legacySha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/** Vergleich in konstanter Zeit (Hex-Strings gleicher Länge). */
function sameHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

interface AuthMeta {
  salt: string;
  hash: string;
  version: number;
}

async function readAuthMeta(db: Firestore, groupId: string): Promise<AuthMeta | null> {
  const snap = await db.doc(`groups/${groupId}/_meta/auth`).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<AuthMeta>;
  if (typeof data.salt !== "string" || typeof data.hash !== "string" || typeof data.version !== "number") {
    return null;
  }
  return data as AuthMeta;
}

/**
 * Look at the legacy `passwordHash` field on the group root doc (old
 * SHA-256-without-salt format) and, if it matches the supplied password,
 * upgrade in place to a salted PBKDF2 entry under `_meta/auth`. The legacy
 * field is then deleted. Returns true on successful upgrade, false otherwise.
 */
async function migrateLegacyHash(db: Firestore, groupId: string, password: string): Promise<boolean> {
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists) return false;
  const legacyHash = (groupSnap.data() as Record<string, unknown>)?.passwordHash;
  if (typeof legacyHash !== "string") return false;
  if (!sameHex(legacySha256(password), legacyHash)) return false;
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  const batch = db.batch();
  batch.set(db.doc(`groups/${groupId}/_meta/auth`), { salt, hash, version: 1 });
  batch.update(db.doc(`groups/${groupId}`), { passwordHash: FieldValue.delete() });
  await batch.commit();
  return true;
}

/** Wirft permission-denied bei falschem Passwort. */
export async function verifyPassword(db: Firestore, groupId: string, password: string): Promise<void> {
  const meta = await readAuthMeta(db, groupId);
  if (!meta) {
    // Maybe the group still uses the old top-level passwordHash field — try
    // to migrate on the fly.
    if (!(await migrateLegacyHash(db, groupId, password))) {
      throw new HttpsError("permission-denied", "Wrong password");
    }
    if (!(await readAuthMeta(db, groupId))) {
      throw new HttpsError("internal", "Auth meta lost after migration");
    }
    return;
  }
  if (!sameHex(await hashPassword(password, meta.salt), meta.hash)) {
    throw new HttpsError("permission-denied", "Wrong password");
  }
}

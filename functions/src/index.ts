import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

const REGION = "europe-west1";
const GROUP_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/;
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
}

function randomSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

function legacySha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function requireAuth(auth: { uid?: string } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "Anonymous sign-in required");
  }
  return auth.uid;
}

function requireGroupId(value: unknown): string {
  if (typeof value !== "string" || !GROUP_ID_PATTERN.test(value)) {
    throw new HttpsError(
      "invalid-argument",
      "Group id must match ^[A-Za-z0-9][A-Za-z0-9-]{2,29}$",
    );
  }
  return value;
}

function requirePassword(value: unknown, field = "password"): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpsError("invalid-argument", `${field} required`);
  }
  return value;
}

interface AuthMeta {
  salt: string;
  hash: string;
  version: number;
}

async function readAuthMeta(groupId: string): Promise<AuthMeta | null> {
  const snap = await db.doc(`groups/${groupId}/_meta/auth`).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<AuthMeta>;
  if (
    typeof data.salt !== "string" ||
    typeof data.hash !== "string" ||
    typeof data.version !== "number"
  ) {
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
async function migrateLegacyHash(
  groupId: string,
  password: string,
): Promise<boolean> {
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists) return false;
  const legacyHash = (groupSnap.data() as Record<string, unknown>)?.passwordHash;
  if (typeof legacyHash !== "string") return false;
  if (legacySha256(password) !== legacyHash) return false;
  const salt = randomSalt();
  const hash = hashPassword(password, salt);
  const batch = db.batch();
  batch.set(db.doc(`groups/${groupId}/_meta/auth`), {
    salt,
    hash,
    version: 1,
  });
  batch.update(db.doc(`groups/${groupId}`), {
    passwordHash: admin.firestore.FieldValue.delete(),
  });
  await batch.commit();
  return true;
}

async function verifyPassword(
  groupId: string,
  password: string,
): Promise<void> {
  let meta = await readAuthMeta(groupId);
  if (!meta) {
    // Maybe the group still uses the old top-level passwordHash field — try
    // to migrate on the fly.
    const migrated = await migrateLegacyHash(groupId, password);
    if (!migrated) {
      throw new HttpsError("permission-denied", "Wrong password");
    }
    meta = await readAuthMeta(groupId);
    if (!meta) {
      throw new HttpsError("internal", "Auth meta lost after migration");
    }
    return;
  }
  if (hashPassword(password, meta.salt) !== meta.hash) {
    throw new HttpsError("permission-denied", "Wrong password");
  }
}

async function requireMember(groupId: string, uid: string): Promise<void> {
  const member = await db.doc(`groups/${groupId}/members/${uid}`).get();
  if (!member.exists) {
    throw new HttpsError("permission-denied", "Not a member");
  }
}

// ─── createGroup ────────────────────────────────────────
export const createGroup = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const groupId = requireGroupId((request.data as { groupId?: unknown })?.groupId);
  const password = requirePassword((request.data as { password?: unknown })?.password);

  const groupRef = db.doc(`groups/${groupId}`);
  const existing = await groupRef.get();
  if (existing.exists) {
    throw new HttpsError("already-exists", "Group already exists");
  }

  const salt = randomSalt();
  const hash = hashPassword(password, salt);

  const batch = db.batch();
  batch.set(groupRef, {
    defaultBudget: 10,
    darkMode: true,
    createdAt: Date.now(),
  });
  batch.set(db.doc(`groups/${groupId}/_meta/auth`), {
    salt,
    hash,
    version: 1,
  });
  batch.set(db.doc(`groups/${groupId}/members/${uid}`), {
    joinedAt: Date.now(),
    uid,
  });
  await batch.commit();

  return { ok: true };
});

// ─── joinGroup ──────────────────────────────────────────
export const joinGroup = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const groupId = requireGroupId((request.data as { groupId?: unknown })?.groupId);
  const password = requirePassword((request.data as { password?: unknown })?.password);

  const groupRef = db.doc(`groups/${groupId}`);
  const groupSnap = await groupRef.get();
  if (!groupSnap.exists) {
    throw new HttpsError("not-found", "Group not found");
  }

  await verifyPassword(groupId, password);

  await db
    .doc(`groups/${groupId}/members/${uid}`)
    .set({ joinedAt: Date.now(), uid }, { merge: true });

  return { ok: true };
});

// ─── listMyGroups ───────────────────────────────────────
// Returns every groupId the caller is a member of. Uses a collectionGroup
// query over members docs where the `uid` field equals the caller's uid.
// Requires a single-field collection-group index on members.uid (defined
// in firestore.indexes.json).
export const listMyGroups = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const snap = await db
    .collectionGroup("members")
    .where("uid", "==", uid)
    .get();
  const groupIds = snap.docs
    .map((d) => d.ref.parent.parent?.id)
    .filter((x): x is string => !!x);
  return { groupIds };
});

// ─── changePassword ─────────────────────────────────────
export const changePassword = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const groupId = requireGroupId((request.data as { groupId?: unknown })?.groupId);
  const oldPassword = requirePassword(
    (request.data as { oldPassword?: unknown })?.oldPassword,
    "oldPassword",
  );
  const newPassword = requirePassword(
    (request.data as { newPassword?: unknown })?.newPassword,
    "newPassword",
  );

  await requireMember(groupId, uid);
  await verifyPassword(groupId, oldPassword);

  const newSalt = randomSalt();
  const newHash = hashPassword(newPassword, newSalt);
  await db.doc(`groups/${groupId}/_meta/auth`).set({
    salt: newSalt,
    hash: newHash,
    version: 1,
  });

  return { ok: true };
});

// ─── deleteGroup ────────────────────────────────────────
export const deleteGroup = onCall({ region: REGION }, async (request) => {
  const uid = requireAuth(request.auth);
  const groupId = requireGroupId((request.data as { groupId?: unknown })?.groupId);
  const password = requirePassword((request.data as { password?: unknown })?.password);

  await requireMember(groupId, uid);
  await verifyPassword(groupId, password);

  // Recursive delete handles all subcollections (persons, gifts,
  // suggestions, wishlist, polls, members, _meta) plus the group doc.
  await db.recursiveDelete(db.doc(`groups/${groupId}`));

  return { ok: true };
});

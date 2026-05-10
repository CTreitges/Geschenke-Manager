import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { createGroup, groupExists } from "./storage";
import { sha256 } from "./auth";

/** Collections that lived at the Firestore root before multi-group landed. */
const LEGACY_COLLECTIONS = [
  "persons",
  "gifts",
  "suggestions",
  "wishlist",
  "polls",
  "feedback",
] as const;

export interface MigrationResult {
  moved: Record<string, number>;
  /** True if we did the work; false if there was nothing to migrate. */
  ran: boolean;
}

/**
 * Copies all top-level legacy docs (`/persons`, `/gifts`, ...) into the
 * group-scoped path `/groups/{groupId}/...`, preserving doc-ids (important
 * for `gifts/{personId}_{year}` and `polls/{giftId}`).
 *
 * The group root doc must already exist before calling this — use
 * `createGroup(...)` first. We do NOT overwrite the password hash that
 * `createGroup` wrote; legacy `settings/global.passwordHash` is ignored.
 *
 * Legacy root docs are NOT deleted as a safety net.
 */
export async function migrateLegacyToGroup(groupId: string): Promise<MigrationResult> {
  const moved: Record<string, number> = {};
  let anything = false;

  // Pull the legacy settings doc — we copy defaultBudget if present, but
  // NEVER overwrite passwordHash on the new group doc.
  const legacySettingsSnap = await getDoc(doc(db, "settings", "global"));
  if (legacySettingsSnap.exists()) {
    anything = true;
    const data = legacySettingsSnap.data() as { defaultBudget?: number; darkMode?: boolean };
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    const groupCurrent = (groupSnap.data() as Record<string, unknown> | undefined) ?? {};
    await setDoc(
      doc(db, "groups", groupId),
      {
        ...groupCurrent,
        defaultBudget: data.defaultBudget ?? groupCurrent.defaultBudget ?? 10,
        darkMode: groupCurrent.darkMode ?? data.darkMode ?? true,
      },
      { merge: true },
    );
  }

  for (const name of LEGACY_COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    if (snap.empty) {
      moved[name] = 0;
      continue;
    }
    anything = true;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.set(doc(db, "groups", groupId, name, d.id), d.data());
    });
    await batch.commit();
    moved[name] = snap.size;
  }

  return { moved, ran: anything };
}

const AUTO_MIGRATION_FLAG = "gm:legacy-migration:v1";
const AUTO_MIGRATION_GROUP = "Jeg";
const AUTO_MIGRATION_PASSWORD = "Jeg";

/**
 * Runs once per browser: if the legacy `/settings/global` doc still exists
 * and the auto-target group `Jeg` does not, create it (hash("Jeg")) and
 * copy everything across. Stamps localStorage so subsequent loads no-op.
 */
export async function autoMigrateLegacyIfNeeded(): Promise<MigrationResult | null> {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(AUTO_MIGRATION_FLAG) === "done") return null;

  const legacySettings = await getDoc(doc(db, "settings", "global"));
  if (!legacySettings.exists()) {
    // Nothing to migrate.
    localStorage.setItem(AUTO_MIGRATION_FLAG, "done");
    return null;
  }

  if (await groupExists(AUTO_MIGRATION_GROUP)) {
    // Someone else already migrated, or a fresh group named "Jeg" exists.
    localStorage.setItem(AUTO_MIGRATION_FLAG, "done");
    return null;
  }

  const passwordHash = await sha256(AUTO_MIGRATION_PASSWORD);
  await createGroup(AUTO_MIGRATION_GROUP, passwordHash);
  const result = await migrateLegacyToGroup(AUTO_MIGRATION_GROUP);
  localStorage.setItem(AUTO_MIGRATION_FLAG, "done");
  return result;
}

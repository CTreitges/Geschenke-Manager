import type { ID, Member, Person } from "./types";

// „Wer bin ich?“ – reine Bausteine rund um das IdentitySheet: der
// Sitzungs-Ausweg „nur ansehen“, wer schon vergeben ist und der einmalige
// Cloud-Restore. Storage-Zugriffe in try/catch mit Speicher-Fallback.

const skipped = new Set<string>();

export const identitySkipKey = (groupId: string) => `gm:identity-skip:${groupId}`;

/** „Ich bin nicht dabei, nur ansehen“ gilt bis zum Ende der Sitzung. */
export function isIdentitySkipped(groupId: string | null): boolean {
  if (!groupId) return false;
  if (skipped.has(groupId)) return true;
  try {
    return globalThis.sessionStorage?.getItem(identitySkipKey(groupId)) === "1";
  } catch {
    return false;
  }
}

export function skipIdentity(groupId: string | null): void {
  if (!groupId) return;
  skipped.add(groupId);
  try {
    globalThis.sessionStorage?.setItem(identitySkipKey(groupId), "1");
  } catch {
    /* nur für diesen App-Start gemerkt */
  }
}

/** Personen, die jemand auf einem ANDEREN Gerät/Konto schon als „Wer bin ich?“ gewählt hat. */
export function claimedPersonIds(
  members: readonly Pick<Member, "uid" | "identityPersonId">[],
  myUid?: string | null,
): Set<ID> {
  return new Set(
    members.filter((m) => m.uid !== myUid && !!m.identityPersonId).map((m) => m.identityPersonId as ID),
  );
}

/**
 * Cloud-Restore: lokal ist keine Identität gesetzt, das eigene Member-Doc
 * kennt aber noch eine existierende Person → diese einmal übernehmen.
 */
export function identityToRestore(c: {
  localId: ID | null;
  uid: string | null | undefined;
  members: readonly Pick<Member, "uid" | "identityPersonId">[];
  persons: readonly Pick<Person, "id">[];
}): ID | null {
  if (c.localId || !c.uid) return null;
  const cloud = c.members.find((m) => m.uid === c.uid)?.identityPersonId;
  return cloud && c.persons.some((p) => p.id === cloud) ? cloud : null;
}

import type { User } from "firebase/auth";

/**
 * UID of the single feedback owner — the account that gets to see ALL
 * feedback across groups. Everyone else only sees feedback they themselves
 * submitted (matched via byUid). Keep in sync with firestore.rules.
 */
export const FEEDBACK_OWNER_UID = "t7DmIhxGu9ZniAnmeGVmgEGnW4F2";

export function isFeedbackOwner(user: User | null): boolean {
  return user?.uid === FEEDBACK_OWNER_UID;
}

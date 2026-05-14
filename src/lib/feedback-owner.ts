import type { User } from "firebase/auth";

/**
 * Email of the single feedback owner — the account that gets to see ALL
 * feedback across groups. Everyone else only sees feedback they themselves
 * submitted (matched via byUid).
 *
 * Comparison is case-insensitive; both this constant and the user's email
 * are lower-cased before comparison.
 */
export const FEEDBACK_OWNER_EMAIL = "christof.treitges@gmail.com";

export function isFeedbackOwner(user: User | null): boolean {
  const email = user?.email?.toLowerCase();
  return !!email && email === FEEDBACK_OWNER_EMAIL;
}

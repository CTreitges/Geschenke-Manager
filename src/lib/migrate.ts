// Legacy migrations from earlier multi-group rollouts. After the Tier-1
// security tightening (members-only Firestore Rules, password verification
// via Cloud Functions), the client can no longer read the old top-level
// collections, so client-side migration is impossible — these helpers are
// kept as no-ops to avoid disturbing existing call sites.

export interface MigrationResult {
  moved: Record<string, number>;
  ran: boolean;
}

export async function autoMigrateLegacyIfNeeded(): Promise<MigrationResult | null> {
  return null;
}

export async function consolidateFeedbackOnce(_groupIds: string[]): Promise<number> {
  return 0;
}

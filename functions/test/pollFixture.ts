// Gemeinsame Testdaten für onPollWritten/sweepPolls: Anna ist die beschenkte
// Person (auch Teilnehmerin eingetragen — darf trotzdem nie etwas bekommen),
// Ben/Christof/Lea sind Teilnehmer, Max ist Mitglied aber kein Teilnehmer,
// u-anon hat keine Identität. Annas Gerät „t-shared“ liegt auch unter
// Christofs UID (gleiches Gerät, zwei Identitäten) → muss gesperrt bleiben.

export const MIN = 60_000;
export const HOUR = 60 * MIN;
/** Mi, 30.09.2026 10:00 Wien. Mit 48 Std endet die Runde Fr, 02.10. 10:00. */
export const T0 = Date.parse("2026-09-30T10:00:00+02:00");

export function activePoll(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { status: "active", startedAt: T0, startedBy: "ben", endsAt: T0 + 48 * HOUR, votes: {}, ...extra };
}

export function pollSeed(extra: Record<string, Record<string, unknown>> = {}): Record<string, Record<string, unknown>> {
  return {
    "groups/g1": { name: "familie" },
    "groups/g1/persons/anna": { name: "Anna" },
    "groups/g1/persons/ben": { name: "Ben" },
    "groups/g1/persons/christof": { name: "Christof" },
    "groups/g1/persons/lea": { name: "Lea" },
    "groups/g1/persons/max": { name: "Max" },
    "groups/g1/gifts/gift1": {
      personId: "anna",
      status: "open",
      participantIds: ["anna", "ben", "christof", "lea"],
    },
    "groups/g1/suggestions/s1": { giftId: "gift1", title: "Plattenspieler", price: 129 },
    "groups/g1/suggestions/s2": { giftId: "gift1", title: "Kochkurs", price: 80 },
    "groups/g1/suggestions/s9": { giftId: "other", title: "Buch" },
    "groups/g1/members/u-anna": { identityPersonId: "anna", notifyStack: true },
    "groups/g1/members/u-ben": { identityPersonId: "ben", notifyPolls: true },
    "groups/g1/members/u-christof": { identityPersonId: "christof", notifyStack: true },
    "groups/g1/members/u-lea": { identityPersonId: "lea", notifyStack: true },
    "groups/g1/members/u-max": { identityPersonId: "max", notifyStack: true },
    "groups/g1/members/u-anon": { notifyStack: true },
    "pushTokens/u-anna": { "t-anna": {}, "t-shared": {} },
    "pushTokens/u-ben": { "t-ben": {} },
    "pushTokens/u-christof": { "t-christof": {}, "t-shared": {} },
    "pushTokens/u-lea": { "t-lea": {} },
    "pushTokens/u-max": { "t-max": {} },
    "pushTokens/u-anon": { "t-anon": {} },
    ...extra,
  };
}

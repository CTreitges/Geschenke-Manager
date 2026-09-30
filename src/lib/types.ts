export type ID = string;

export interface Person {
  id: ID;
  name: string;
  birthday: string; // "MM-DD" or "YYYY-MM-DD" (year ignored for birthday calc)
  email?: string;
  /** false = explicitly unsubscribed via the email link. undefined/true = receives reminders. */
  emailOptIn?: boolean;
  /** Per-stage-per-year markers, e.g. "reminder-60d-2026": <timestamp>. Prevents double-send. */
  notificationsSent?: Record<string, number>;
  /** Globale Default-Teilnehmer: Personen aus dieser Liste werden bei jedem
   *  neuen Geschenk für diese Person automatisch als Teilnehmer übernommen.
   *  Gesteuert via Settings → "Wo mache ich mit?". */
  defaultParticipantIds?: ID[];
  color: string; // avatar background, hex
  createdAt: number;
}

/**
 * Lifecycle: open → confirmed → received.
 * - "open": Vorschläge sammeln, abstimmen, ggf. Auswahl treffen.
 * - "confirmed": Auswahl ist festgenagelt — Wunschliste + "Idee teilen"
 *   verschwinden, "Gesamtsumme" statt "theoretisch", Bezahler-Summe wird
 *   sichtbar. Lässt sich rückgängig machen.
 * - "received": Geschenk ist überreicht — final.
 */
export type GiftStatus = "open" | "confirmed" | "received";

export interface Gift {
  id: ID;
  personId: ID;
  year: number;
  status: GiftStatus;
  budgetPerPerson: number;
  manuallyAdded: boolean;
  stackOrder: number;
  enteredStackAt: number;
  receivedAt?: number;
  participantIds: ID[];
  /** Suggestions the group has decided to actually buy. Editable after a poll closes. */
  selectedSuggestionIds?: ID[];
  /** Description / event type, e.g. "Geburtstag", "Reise", "Hochzeit". Default "Geburtstag" if absent. */
  occasion?: string;
  /** Optional custom date "YYYY-MM-DD" — overrides person's birthday for stack-sorting + display. */
  customDate?: string;
  /** Shared WhatsApp / chat group invite link for participants of this gift. */
  whatsappLink?: string;
}

export interface Suggestion {
  id: ID;
  giftId: ID;
  title: string;
  url?: string;
  price?: number;
  suggestedBy: ID;
  createdAt: number;
  /** Set if this suggestion was adopted from a wishlist item — links back to it. */
  fromWishItemId?: ID;
  /** Person who paid for this suggestion (only meaningful after gift.status === "received"). */
  paidBy?: ID;
}

export interface WishlistItem {
  id: ID;
  personId: ID;
  title: string;
  url?: string;
  price?: number;
  createdAt: number;
}

export type PollStatus = "none" | "active" | "closed";

export interface Poll {
  giftId: ID;
  status: PollStatus;
  startedAt?: number;
  closedAt?: number;
  /** Mehrfach-Stimmen pro Person: personId → suggestionId[].
   *  (Frühere Version war Record<ID, ID> — wird beim Lesen normalisiert.) */
  votes: Record<ID, ID[]>;
}

export interface Feedback {
  id: ID;
  text: string;
  by?: ID;        // identity (personId in some group) that submitted it
  /** Firebase auth UID of the submitter. Required for new entries — used by
   *  firestore rules to gate read/update/delete to the author. */
  byUid?: string;
  /** Best-effort email of the submitter (Google-account, if linked). Used
   *  for the owner-can-see-all check in the UI. */
  byEmail?: string;
  createdAt: number;
  resolved?: boolean;
}

export interface Settings {
  defaultBudget: number;
  passwordHash: string; // SHA-256
  darkMode: boolean;
}

/** Member-Doc unter /groups/{gid}/members/{uid}. UID ist die Firebase-
 *  Auth-UID, die einer konkreten Person der Gruppe entspricht (Identity-
 *  Sync). Wird verwendet, um zu zeigen, welche Personen aktiv genutzt
 *  werden. */
export interface Member {
  uid: ID;
  joinedAt?: number;
  notifyStack?: boolean;
  /** Abstimmungs-Pushes. Effektiv: notifyPolls ?? (notifyStack === true). */
  notifyPolls?: boolean;
  /** Welche Person dieser User in der Gruppe als „Wer bin ich" gesetzt
   *  hat. Wird vom Client synchronisiert (siehe storage.setMyIdentityCloud). */
  identityPersonId?: ID;
}

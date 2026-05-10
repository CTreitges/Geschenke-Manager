export type ID = string;

export interface Person {
  id: ID;
  name: string;
  birthday: string; // "MM-DD" or "YYYY-MM-DD" (year ignored for birthday calc)
  email?: string;
  color: string; // avatar background, hex
  createdAt: number;
}

export type GiftStatus = "open" | "received";

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
  // votes: personId -> suggestionId
  votes: Record<ID, ID>;
}

export interface Feedback {
  id: ID;
  text: string;
  by?: ID;        // identity that submitted it
  createdAt: number;
  resolved?: boolean;
}

export interface Settings {
  defaultBudget: number;
  passwordHash: string; // SHA-256
  darkMode: boolean;
}

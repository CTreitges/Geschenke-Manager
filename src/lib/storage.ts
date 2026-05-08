import type { Person, Gift, Suggestion, WishlistItem, Poll, Settings, ID } from "./types";

const KEY = "gm:state:v1";

interface State {
  persons: Person[];
  gifts: Gift[];
  suggestions: Suggestion[];
  wishlist: WishlistItem[];
  polls: Poll[];
  settings: Settings;
}

const DEFAULT_SETTINGS: Settings = {
  defaultBudget: 10,
  passwordHash: "",
  darkMode: false,
};

const EMPTY_STATE: State = {
  persons: [],
  gifts: [],
  suggestions: [],
  wishlist: [],
  polls: [],
  settings: DEFAULT_SETTINGS,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY_STATE);
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      persons: parsed.persons ?? [],
      gifts: parsed.gifts ?? [],
      suggestions: parsed.suggestions ?? [],
      wishlist: parsed.wishlist ?? [],
      polls: parsed.polls ?? [],
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    };
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

let state: State = load();

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getSnapshot(): State {
  return state;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ─── Persons ────────────────────────────────────────────
export function addPerson(p: Omit<Person, "id" | "createdAt">): Person {
  const person: Person = { ...p, id: uid(), createdAt: Date.now() };
  state = { ...state, persons: [...state.persons, person] };
  save();
  return person;
}

export function updatePerson(id: ID, patch: Partial<Person>) {
  state = {
    ...state,
    persons: state.persons.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
  save();
}

export function deletePerson(id: ID) {
  state = {
    ...state,
    persons: state.persons.filter((p) => p.id !== id),
    gifts: state.gifts.filter((g) => g.personId !== id),
    wishlist: state.wishlist.filter((w) => w.personId !== id),
  };
  save();
}

// ─── Gifts ──────────────────────────────────────────────
export function addGift(g: Omit<Gift, "id" | "enteredStackAt" | "stackOrder" | "participantIds">): Gift {
  const maxOrder = state.gifts.reduce((m, g) => Math.max(m, g.stackOrder), 0);
  const gift: Gift = {
    ...g,
    id: uid(),
    enteredStackAt: Date.now(),
    stackOrder: maxOrder + 1,
    participantIds: [],
  };
  state = { ...state, gifts: [...state.gifts, gift] };
  save();
  return gift;
}

export function updateGift(id: ID, patch: Partial<Gift>) {
  state = {
    ...state,
    gifts: state.gifts.map((g) => (g.id === id ? { ...g, ...patch } : g)),
  };
  save();
}

export function reorderGifts(orderedIds: ID[]) {
  const orderMap = Object.fromEntries(orderedIds.map((id, i) => [id, i + 1]));
  state = {
    ...state,
    gifts: state.gifts.map((g) =>
      orderMap[g.id] != null ? { ...g, stackOrder: orderMap[g.id] } : g,
    ),
  };
  save();
}

export function toggleParticipant(giftId: ID, personId: ID) {
  state = {
    ...state,
    gifts: state.gifts.map((g) => {
      if (g.id !== giftId) return g;
      const has = g.participantIds.includes(personId);
      return {
        ...g,
        participantIds: has
          ? g.participantIds.filter((p) => p !== personId)
          : [...g.participantIds, personId],
      };
    }),
  };
  save();
}

export function markReceived(giftId: ID) {
  updateGift(giftId, { status: "received", receivedAt: Date.now() });
}

// ─── Suggestions ────────────────────────────────────────
export function addSuggestion(s: Omit<Suggestion, "id" | "createdAt">): Suggestion {
  const sug: Suggestion = { ...s, id: uid(), createdAt: Date.now() };
  state = { ...state, suggestions: [...state.suggestions, sug] };
  save();
  return sug;
}

export function deleteSuggestion(id: ID) {
  state = {
    ...state,
    suggestions: state.suggestions.filter((s) => s.id !== id),
  };
  save();
}

// ─── Wishlist ───────────────────────────────────────────
export function addWishItem(w: Omit<WishlistItem, "id" | "createdAt">): WishlistItem {
  const item: WishlistItem = { ...w, id: uid(), createdAt: Date.now() };
  state = { ...state, wishlist: [...state.wishlist, item] };
  save();
  return item;
}

export function deleteWishItem(id: ID) {
  state = { ...state, wishlist: state.wishlist.filter((w) => w.id !== id) };
  save();
}

// ─── Polls ──────────────────────────────────────────────
function getOrCreatePoll(giftId: ID): Poll {
  const existing = state.polls.find((p) => p.giftId === giftId);
  if (existing) return existing;
  const fresh: Poll = { giftId, status: "none", votes: {} };
  state = { ...state, polls: [...state.polls, fresh] };
  return fresh;
}

export function setPollStatus(giftId: ID, status: Poll["status"]) {
  getOrCreatePoll(giftId);
  const now = Date.now();
  state = {
    ...state,
    polls: state.polls.map((p) =>
      p.giftId === giftId
        ? {
            ...p,
            status,
            startedAt: status === "active" ? now : p.startedAt,
            closedAt: status === "closed" ? now : p.closedAt,
          }
        : p,
    ),
  };
  save();
}

export function castVote(giftId: ID, personId: ID, suggestionId: ID) {
  getOrCreatePoll(giftId);
  state = {
    ...state,
    polls: state.polls.map((p) =>
      p.giftId === giftId
        ? { ...p, votes: { ...p.votes, [personId]: suggestionId } }
        : p,
    ),
  };
  save();
}

// ─── Settings ───────────────────────────────────────────
export function updateSettings(patch: Partial<Settings>) {
  state = { ...state, settings: { ...state.settings, ...patch } };
  save();
}

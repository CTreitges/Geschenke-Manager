import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Person, Gift, Suggestion, WishlistItem, Poll, Settings, ID } from "./types";

interface State {
  persons: Person[];
  gifts: Gift[];
  suggestions: Suggestion[];
  wishlist: WishlistItem[];
  polls: Poll[];
  settings: Settings;
  loaded: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  defaultBudget: 10,
  passwordHash: "",
  darkMode: false,
};

let state: State = {
  persons: [],
  gifts: [],
  suggestions: [],
  wishlist: [],
  polls: [],
  settings: DEFAULT_SETTINGS,
  loaded: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();
let initialized = false;

function notify() {
  state = { ...state }; // new ref so React picks up
  listeners.forEach((l) => l());
}

function init() {
  if (initialized) return;
  initialized = true;

  onSnapshot(collection(db, "persons"), (snap) => {
    state.persons = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Person, "id">) }));
    notify();
  });
  onSnapshot(collection(db, "gifts"), (snap) => {
    state.gifts = snap.docs.map((d) => {
      const data = d.data() as Omit<Gift, "id">;
      return { id: d.id, ...data, participantIds: data.participantIds ?? [] };
    });
    notify();
  });
  onSnapshot(collection(db, "suggestions"), (snap) => {
    state.suggestions = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Suggestion, "id">) }));
    notify();
  });
  onSnapshot(collection(db, "wishlist"), (snap) => {
    state.wishlist = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WishlistItem, "id">) }));
    notify();
  });
  onSnapshot(collection(db, "polls"), (snap) => {
    state.polls = snap.docs.map((d) => {
      const data = d.data() as Omit<Poll, "giftId">;
      return { giftId: d.id, ...data, votes: data.votes ?? {} };
    });
    notify();
  });
  onSnapshot(doc(db, "settings", "global"), (snap) => {
    state.settings = { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings> | undefined) };
    state.loaded = true;
    notify();
  });
}

export function subscribe(l: Listener): () => void {
  init();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getSnapshot(): State {
  return state;
}

// Strip undefined values — Firestore rejects them.
function clean<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const k in obj) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

// ─── Persons ────────────────────────────────────────────
export async function addPerson(p: Omit<Person, "id" | "createdAt">) {
  await addDoc(collection(db, "persons"), clean({ ...p, createdAt: Date.now() }));
}

export async function updatePerson(id: ID, patch: Partial<Person>) {
  await updateDoc(doc(db, "persons", id), clean(patch as Record<string, unknown>));
}

export async function deletePerson(id: ID) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "persons", id));
  state.gifts.filter((g) => g.personId === id).forEach((g) => batch.delete(doc(db, "gifts", g.id)));
  state.wishlist.filter((w) => w.personId === id).forEach((w) => batch.delete(doc(db, "wishlist", w.id)));
  await batch.commit();
}

// ─── Gifts ──────────────────────────────────────────────
export async function addGift(g: Omit<Gift, "id" | "enteredStackAt" | "stackOrder" | "participantIds">) {
  const maxOrder = state.gifts.reduce((m, x) => Math.max(m, x.stackOrder), 0);
  await addDoc(
    collection(db, "gifts"),
    clean({
      ...g,
      enteredStackAt: Date.now(),
      stackOrder: maxOrder + 1,
      participantIds: [],
    }),
  );
}

export async function updateGift(id: ID, patch: Partial<Gift>) {
  await updateDoc(doc(db, "gifts", id), clean(patch as Record<string, unknown>));
}

export async function reorderGifts(orderedIds: ID[]) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => {
    batch.update(doc(db, "gifts", id), { stackOrder: i + 1 });
  });
  await batch.commit();
}

export async function toggleParticipant(giftId: ID, personId: ID) {
  const gift = state.gifts.find((g) => g.id === giftId);
  if (!gift) return;
  const has = gift.participantIds.includes(personId);
  await updateDoc(doc(db, "gifts", giftId), {
    participantIds: has ? arrayRemove(personId) : arrayUnion(personId),
  });
}

export async function markReceived(giftId: ID) {
  await updateGift(giftId, { status: "received", receivedAt: Date.now() });
}

export async function setGiftSelections(giftId: ID, ids: ID[]) {
  await updateDoc(doc(db, "gifts", giftId), { selectedSuggestionIds: ids });
}

export async function setAllParticipants(giftId: ID, personIds: ID[]) {
  await updateDoc(doc(db, "gifts", giftId), { participantIds: personIds });
}

export async function deleteGift(giftId: ID) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "gifts", giftId));
  state.suggestions
    .filter((s) => s.giftId === giftId)
    .forEach((s) => batch.delete(doc(db, "suggestions", s.id)));
  batch.delete(doc(db, "polls", giftId));
  await batch.commit();
}

// ─── Suggestions ────────────────────────────────────────
export async function addSuggestion(s: Omit<Suggestion, "id" | "createdAt">) {
  await addDoc(collection(db, "suggestions"), clean({ ...s, createdAt: Date.now() }));
}

export async function deleteSuggestion(id: ID) {
  await deleteDoc(doc(db, "suggestions", id));
}

// ─── Wishlist ───────────────────────────────────────────
export async function addWishItem(w: Omit<WishlistItem, "id" | "createdAt">) {
  await addDoc(collection(db, "wishlist"), clean({ ...w, createdAt: Date.now() }));
}

export async function deleteWishItem(id: ID) {
  await deleteDoc(doc(db, "wishlist", id));
}

// ─── Polls ──────────────────────────────────────────────
export async function setPollStatus(giftId: ID, status: Poll["status"]) {
  const ref = doc(db, "polls", giftId);
  const now = Date.now();
  const existing = state.polls.find((p) => p.giftId === giftId);
  await setDoc(
    ref,
    clean({
      status,
      votes: existing?.votes ?? {},
      startedAt: status === "active" ? now : existing?.startedAt,
      closedAt: status === "closed" ? now : existing?.closedAt,
    }),
    { merge: true },
  );
}

export async function castVote(giftId: ID, personId: ID, suggestionId: ID) {
  const ref = doc(db, "polls", giftId);
  await setDoc(
    ref,
    {
      [`votes.${personId}`]: suggestionId,
    },
    { merge: true },
  );
}

// ─── Settings ───────────────────────────────────────────
export async function updateSettings(patch: Partial<Settings>) {
  await setDoc(doc(db, "settings", "global"), clean(patch as Record<string, unknown>), { merge: true });
}

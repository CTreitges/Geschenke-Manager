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
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Person, Gift, Suggestion, WishlistItem, Poll, Settings, Feedback, ID } from "./types";

interface State {
  persons: Person[];
  gifts: Gift[];
  suggestions: Suggestion[];
  wishlist: WishlistItem[];
  polls: Poll[];
  feedback: Feedback[];
  settings: Settings;
  /** Group doc has arrived — used by Login to wait for password hash. */
  loaded: boolean;
  /** First gifts snapshot has been received — used by Home to avoid
   *  auto-creating duplicate stack entries before initial data arrives. */
  giftsHydrated: boolean;
  /** First persons snapshot has been received. */
  personsHydrated: boolean;
  /** Currently active group id (null when not in any group). */
  activeGroupId: string | null;
}

const DEFAULT_SETTINGS: Settings = {
  defaultBudget: 10,
  passwordHash: "",
  darkMode: true,
};

const emptyState = (): State => ({
  persons: [],
  gifts: [],
  suggestions: [],
  wishlist: [],
  polls: [],
  feedback: [],
  settings: DEFAULT_SETTINGS,
  loaded: false,
  giftsHydrated: false,
  personsHydrated: false,
  activeGroupId: null,
});

let state: State = emptyState();

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  state = { ...state }; // new ref so React picks up
  listeners.forEach((l) => l());
}

// ─── Path helpers ───────────────────────────────────────
function gcol(name: string) {
  if (!state.activeGroupId) throw new Error("No active group");
  return collection(db, "groups", state.activeGroupId, name);
}

function gdoc(name: string, id: string) {
  if (!state.activeGroupId) throw new Error("No active group");
  return doc(db, "groups", state.activeGroupId, name, id);
}

function groupRootDoc() {
  if (!state.activeGroupId) throw new Error("No active group");
  return doc(db, "groups", state.activeGroupId);
}

// ─── Group lifecycle ────────────────────────────────────
let unsubscribers: Array<() => void> = [];

/**
 * Switch the active group. Tears down all existing Firestore listeners,
 * resets all in-memory collections, and (if `groupId` is non-null) starts
 * fresh listeners against `groups/{groupId}/...`.
 */
export function setActiveGroup(groupId: string | null) {
  // Teardown
  unsubscribers.forEach((u) => {
    try {
      u();
    } catch {
      /* ignore */
    }
  });
  unsubscribers = [];

  // Reset state
  state = { ...emptyState(), activeGroupId: groupId };
  notify();

  if (!groupId) return;

  // Subscribe — Firestore subscriptions for the new group
  unsubscribers.push(
    onSnapshot(collection(db, "groups", groupId, "persons"), (snap) => {
      state.persons = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Person, "id">) }));
      state.personsHydrated = true;
      notify();
    }),
  );
  unsubscribers.push(
    onSnapshot(collection(db, "groups", groupId, "gifts"), (snap) => {
      state.gifts = snap.docs.map((d) => {
        const data = d.data() as Omit<Gift, "id">;
        return { id: d.id, ...data, participantIds: data.participantIds ?? [] };
      });
      state.giftsHydrated = true;
      notify();
    }),
  );
  unsubscribers.push(
    onSnapshot(collection(db, "groups", groupId, "suggestions"), (snap) => {
      state.suggestions = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Suggestion, "id">) }));
      notify();
    }),
  );
  unsubscribers.push(
    onSnapshot(collection(db, "groups", groupId, "wishlist"), (snap) => {
      state.wishlist = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WishlistItem, "id">) }));
      notify();
    }),
  );
  unsubscribers.push(
    onSnapshot(collection(db, "groups", groupId, "polls"), (snap) => {
      state.polls = snap.docs.map((d) => {
        const data = d.data() as Omit<Poll, "giftId">;
        return { giftId: d.id, ...data, votes: data.votes ?? {} };
      });
      notify();
    }),
  );
  unsubscribers.push(
    onSnapshot(collection(db, "groups", groupId, "feedback"), (snap) => {
      state.feedback = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Feedback, "id">) }));
      notify();
    }),
  );
  // Group root doc holds the Settings slice (passwordHash, defaultBudget, darkMode).
  unsubscribers.push(
    onSnapshot(doc(db, "groups", groupId), (snap) => {
      state.settings = { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings> | undefined) };
      state.loaded = true;
      notify();
    }),
  );
}

export function subscribe(l: Listener): () => void {
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

// ─── Group registry (top-level /groups collection) ──────
export async function groupExists(groupId: ID): Promise<boolean> {
  const snap = await getDoc(doc(db, "groups", groupId));
  return snap.exists();
}

export async function fetchGroupHash(groupId: ID): Promise<string | null> {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<Settings>;
  return data.passwordHash ?? null;
}

export async function createGroup(
  groupId: ID,
  passwordHash: string,
  defaultBudget = 10,
): Promise<void> {
  await setDoc(doc(db, "groups", groupId), {
    passwordHash,
    defaultBudget,
    darkMode: true,
    createdAt: Date.now(),
  });
}

// ─── Persons ────────────────────────────────────────────
export async function addPerson(p: Omit<Person, "id" | "createdAt">) {
  await addDoc(gcol("persons"), clean({ ...p, createdAt: Date.now() }));
}

export async function updatePerson(id: ID, patch: Partial<Person>) {
  await updateDoc(gdoc("persons", id), clean(patch as Record<string, unknown>));
}

export async function deletePerson(id: ID) {
  if (!state.activeGroupId) throw new Error("No active group");
  const batch = writeBatch(db);
  batch.delete(gdoc("persons", id));
  state.gifts.filter((g) => g.personId === id).forEach((g) => batch.delete(gdoc("gifts", g.id)));
  state.wishlist.filter((w) => w.personId === id).forEach((w) => batch.delete(gdoc("wishlist", w.id)));
  await batch.commit();
}

/**
 * Deduplicate open gifts: if multiple `open` gifts exist for the same
 * (personId, year), keep the one with the richest data (most
 * participants, then most selections, then earliest enteredStackAt) and
 * delete the rest.
 */
let dedupRunning = false;
export async function deduplicateOpenGifts(): Promise<number> {
  if (dedupRunning) return 0;
  dedupRunning = true;
  try {
    const groups = new Map<string, Gift[]>();
    state.gifts
      .filter((g) => g.status === "open")
      .forEach((g) => {
        const key = `${g.personId}:${g.year}`;
        const arr = groups.get(key);
        if (arr) arr.push(g);
        else groups.set(key, [g]);
      });
    const toDelete: string[] = [];
    for (const arr of groups.values()) {
      if (arr.length < 2) continue;
      arr.sort((a, b) => {
        const da = a.participantIds.length + (a.selectedSuggestionIds?.length ?? 0) * 0.5;
        const db = b.participantIds.length + (b.selectedSuggestionIds?.length ?? 0) * 0.5;
        if (db !== da) return db - da;
        return a.enteredStackAt - b.enteredStackAt;
      });
      toDelete.push(...arr.slice(1).map((g) => g.id));
    }
    if (toDelete.length === 0) return 0;
    const batch = writeBatch(db);
    toDelete.forEach((id) => batch.delete(gdoc("gifts", id)));
    await batch.commit();
    return toDelete.length;
  } finally {
    dedupRunning = false;
  }
}

// ─── Gifts ──────────────────────────────────────────────
export async function addGift(g: Omit<Gift, "id" | "enteredStackAt" | "stackOrder" | "participantIds">) {
  const maxOrder = state.gifts.reduce((m, x) => Math.max(m, x.stackOrder), 0);
  await addDoc(
    gcol("gifts"),
    clean({
      ...g,
      enteredStackAt: Date.now(),
      stackOrder: maxOrder + 1,
      participantIds: [],
    }),
  );
}

/**
 * Auto-create a gift for (personId, year) IF none exists yet. See the
 * legacy commit for rationale; the race-safe Firestore query stays the
 * same, just scoped under the active group.
 */
export async function ensureAutoGift(
  personId: ID,
  year: number,
  budgetPerPerson: number,
): Promise<void> {
  const q = query(
    gcol("gifts"),
    where("personId", "==", personId),
    where("year", "==", year),
    where("status", "==", "open"),
    limit(1),
  );
  const found = await getDocs(q);
  if (!found.empty) return;

  const ref = gdoc("gifts", `${personId}_${year}`);
  const maxOrder = state.gifts.reduce((m, x) => Math.max(m, x.stackOrder), 0);
  await setDoc(
    ref,
    clean({
      personId,
      year,
      status: "open" as const,
      budgetPerPerson,
      manuallyAdded: false,
      enteredStackAt: Date.now(),
      stackOrder: maxOrder + 1,
      participantIds: [] as string[],
    }),
  );
}

export async function updateGift(id: ID, patch: Partial<Gift>) {
  await updateDoc(gdoc("gifts", id), clean(patch as Record<string, unknown>));
}

export async function reorderGifts(orderedIds: ID[]) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => {
    batch.update(gdoc("gifts", id), { stackOrder: i + 1 });
  });
  await batch.commit();
}

export async function toggleParticipant(giftId: ID, personId: ID) {
  const gift = state.gifts.find((g) => g.id === giftId);
  if (!gift) return;
  const has = gift.participantIds.includes(personId);
  await updateDoc(gdoc("gifts", giftId), {
    participantIds: has ? arrayRemove(personId) : arrayUnion(personId),
  });
}

export async function markReceived(giftId: ID) {
  await updateGift(giftId, { status: "received", receivedAt: Date.now() });
}

export async function setGiftSelections(giftId: ID, ids: ID[]) {
  await updateDoc(gdoc("gifts", giftId), { selectedSuggestionIds: ids });
}

export async function setAllParticipants(giftId: ID, personIds: ID[]) {
  await updateDoc(gdoc("gifts", giftId), { participantIds: personIds });
}

export async function deleteGift(giftId: ID) {
  const batch = writeBatch(db);
  batch.delete(gdoc("gifts", giftId));
  state.suggestions
    .filter((s) => s.giftId === giftId)
    .forEach((s) => batch.delete(gdoc("suggestions", s.id)));
  batch.delete(gdoc("polls", giftId));
  await batch.commit();
}

// ─── Suggestions ────────────────────────────────────────
export async function addSuggestion(s: Omit<Suggestion, "id" | "createdAt">) {
  await addDoc(gcol("suggestions"), clean({ ...s, createdAt: Date.now() }));
}

export async function deleteSuggestion(id: ID) {
  await deleteDoc(gdoc("suggestions", id));
}

export async function updateSuggestion(id: ID, patch: Partial<Suggestion>) {
  await updateDoc(gdoc("suggestions", id), clean(patch as Record<string, unknown>));
}

// ─── Wishlist ───────────────────────────────────────────
export async function addWishItem(w: Omit<WishlistItem, "id" | "createdAt">) {
  await addDoc(gcol("wishlist"), clean({ ...w, createdAt: Date.now() }));
}

export async function deleteWishItem(id: ID) {
  await deleteDoc(gdoc("wishlist", id));
}

// ─── Polls ──────────────────────────────────────────────
export async function setPollStatus(giftId: ID, status: Poll["status"]) {
  const ref = gdoc("polls", giftId);
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
  const ref = gdoc("polls", giftId);
  await setDoc(ref, { votes: { [personId]: suggestionId } }, { merge: true });
}

export async function removeVote(giftId: ID, personId: ID) {
  const existing = state.polls.find((p) => p.giftId === giftId);
  if (!existing) return;
  const next: Record<ID, ID> = { ...existing.votes };
  delete next[personId];
  await updateDoc(gdoc("polls", giftId), { votes: next });
}

// ─── Feedback ───────────────────────────────────────────
export async function addFeedback(f: Omit<Feedback, "id" | "createdAt">) {
  await addDoc(gcol("feedback"), clean({ ...f, createdAt: Date.now() }));
}

export async function updateFeedback(id: ID, patch: Partial<Feedback>) {
  await updateDoc(gdoc("feedback", id), clean(patch as Record<string, unknown>));
}

export async function deleteFeedback(id: ID) {
  await deleteDoc(gdoc("feedback", id));
}

// ─── Settings (= group root doc) ────────────────────────
export async function updateSettings(patch: Partial<Settings>) {
  await setDoc(groupRootDoc(), clean(patch as Record<string, unknown>), { merge: true });
}

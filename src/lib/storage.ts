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
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, authReady, db, functions } from "./firebase";
import type {
  Feedback,
  Gift,
  ID,
  Person,
  Poll,
  Settings,
  Suggestion,
  WishlistItem,
} from "./types";

interface State {
  persons: Person[];
  gifts: Gift[];
  suggestions: Suggestion[];
  wishlist: WishlistItem[];
  polls: Poll[];
  feedback: Feedback[];
  settings: Settings;
  /** Group doc has arrived. */
  loaded: boolean;
  /** First gifts snapshot has been received. */
  giftsHydrated: boolean;
  /** First persons snapshot has been received. */
  personsHydrated: boolean;
  /** Currently active group id (null when not in any group). */
  activeGroupId: string | null;
  /** Set when group reads come back permission-denied (e.g. lost membership). */
  permissionError: boolean;
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
  permissionError: false,
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

// ─── Cross-group feedback subscription ──────────────────
let feedbackUnsub: (() => void) | null = null;
function ensureFeedbackSubscription() {
  if (feedbackUnsub) return;
  authReady
    .then(() => {
      if (feedbackUnsub) return;
      feedbackUnsub = onSnapshot(
        collection(db, "feedback"),
        (snap) => {
          state.feedback = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Feedback, "id">),
          }));
          notify();
        },
        (err) => {
          console.warn("feedback subscription error:", err);
        },
      );
    })
    .catch(() => {
      /* anon auth failure — surface via permissionError, see setActiveGroup */
    });
}

// ─── Group lifecycle ────────────────────────────────────
let unsubscribers: Array<() => void> = [];

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

  // Reset, preserve cross-group feedback (already running).
  const preservedFeedback = feedbackUnsub ? state.feedback : [];
  state = {
    ...emptyState(),
    activeGroupId: groupId,
    feedback: preservedFeedback,
  };
  notify();

  ensureFeedbackSubscription();
  if (!groupId) return;

  // Defer subscriptions until anonymous auth is resolved — Firestore rules
  // require request.auth != null for group reads.
  authReady
    .then(() => {
      // Sanity: someone may have switched groups while we were waiting.
      if (state.activeGroupId !== groupId) return;

      const onErr = (label: string) => (err: unknown) => {
        const code =
          (err as { code?: string })?.code ??
          (err as { name?: string })?.name ??
          "unknown";
        console.warn(`${label} subscription error:`, code, err);
        if (code === "permission-denied") {
          state.permissionError = true;
          notify();
        }
      };

      unsubscribers.push(
        onSnapshot(
          collection(db, "groups", groupId, "persons"),
          (snap) => {
            state.persons = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Person, "id">),
            }));
            state.personsHydrated = true;
            notify();
          },
          onErr("persons"),
        ),
      );
      unsubscribers.push(
        onSnapshot(
          collection(db, "groups", groupId, "gifts"),
          (snap) => {
            state.gifts = snap.docs.map((d) => {
              const data = d.data() as Omit<Gift, "id">;
              return {
                id: d.id,
                ...data,
                participantIds: data.participantIds ?? [],
              };
            });
            state.giftsHydrated = true;
            notify();
          },
          onErr("gifts"),
        ),
      );
      unsubscribers.push(
        onSnapshot(
          collection(db, "groups", groupId, "suggestions"),
          (snap) => {
            state.suggestions = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Suggestion, "id">),
            }));
            notify();
          },
          onErr("suggestions"),
        ),
      );
      unsubscribers.push(
        onSnapshot(
          collection(db, "groups", groupId, "wishlist"),
          (snap) => {
            state.wishlist = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<WishlistItem, "id">),
            }));
            notify();
          },
          onErr("wishlist"),
        ),
      );
      unsubscribers.push(
        onSnapshot(
          collection(db, "groups", groupId, "polls"),
          (snap) => {
            state.polls = snap.docs.map((d) => {
              const data = d.data() as Omit<Poll, "giftId">;
              return { giftId: d.id, ...data, votes: data.votes ?? {} };
            });
            notify();
          },
          onErr("polls"),
        ),
      );
      // Group root doc holds defaultBudget, darkMode, createdAt. The
      // password hash + salt live under /_meta/auth and are not readable
      // by clients (rules enforce this).
      unsubscribers.push(
        onSnapshot(
          doc(db, "groups", groupId),
          (snap) => {
            state.settings = {
              ...DEFAULT_SETTINGS,
              ...(snap.data() as Partial<Settings> | undefined),
            };
            state.loaded = true;
            notify();
          },
          onErr("group-root"),
        ),
      );
    })
    .catch((err) => {
      console.error("auth failed in setActiveGroup:", err);
      state.permissionError = true;
      notify();
    });
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

// ─── Cloud Function callables ───────────────────────────
type CallableResult = { ok: boolean };
type JoinPayload = { groupId: ID; password: string };
type CreatePayload = { groupId: ID; password: string };
type ChangePwPayload = {
  groupId: ID;
  oldPassword: string;
  newPassword: string;
};
type DeletePayload = { groupId: ID; password: string };

const joinGroupCallable = httpsCallable<JoinPayload, CallableResult>(
  functions,
  "joinGroup",
);
const createGroupCallable = httpsCallable<CreatePayload, CallableResult>(
  functions,
  "createGroup",
);
const changePasswordCallable = httpsCallable<ChangePwPayload, CallableResult>(
  functions,
  "changePassword",
);
const deleteGroupCallable = httpsCallable<DeletePayload, CallableResult>(
  functions,
  "deleteGroup",
);
const listMyGroupsCallable = httpsCallable<
  Record<string, never>,
  { groupIds: ID[] }
>(functions, "listMyGroups");

const consumeMagicTokenCallable = httpsCallable<
  { token: string },
  { groupId: ID; personId: ID }
>(functions, "consumeMagicToken");

const sendTestMailCallable = httpsCallable<
  { groupId: ID; personId: ID },
  { ok: boolean }
>(functions, "sendTestMail");

export async function joinGroupCF(groupId: ID, password: string): Promise<void> {
  await authReady;
  await joinGroupCallable({ groupId, password });
}

export async function createGroupCF(
  groupId: ID,
  password: string,
): Promise<void> {
  await authReady;
  await createGroupCallable({ groupId, password });
}

export async function changePasswordCF(
  groupId: ID,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  await authReady;
  await changePasswordCallable({ groupId, oldPassword, newPassword });
}

export async function deleteGroupCF(
  groupId: ID,
  password: string,
): Promise<void> {
  await authReady;
  await deleteGroupCallable({ groupId, password });
}

export async function listMyGroupsCF(): Promise<ID[]> {
  await authReady;
  const result = await listMyGroupsCallable({});
  return result.data.groupIds ?? [];
}

export async function consumeMagicTokenCF(
  token: string,
): Promise<{ groupId: ID; personId: ID }> {
  await authReady;
  const result = await consumeMagicTokenCallable({ token });
  return result.data;
}

export async function sendTestMailCF(personId: ID): Promise<void> {
  await authReady;
  if (!state.activeGroupId) throw new Error("No active group");
  await sendTestMailCallable({ groupId: state.activeGroupId, personId });
}

// ─── Membership ─────────────────────────────────────────
/** Leaves a group by deleting the caller's own member doc (rules allow
 *  self-delete). Does NOT touch the group's data — other members can
 *  continue to use it. */
export async function leaveGroup(groupId: ID): Promise<void> {
  const uid = await authReady;
  await deleteDoc(doc(db, "groups", groupId, "members", uid));
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
  state.gifts
    .filter((g) => g.personId === id)
    .forEach((g) => batch.delete(gdoc("gifts", g.id)));
  state.wishlist
    .filter((w) => w.personId === id)
    .forEach((w) => batch.delete(gdoc("wishlist", w.id)));
  await batch.commit();
}

/**
 * Deduplicate open gifts: same (personId, year) → keep richest, drop rest.
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
        const da =
          a.participantIds.length + (a.selectedSuggestionIds?.length ?? 0) * 0.5;
        const db =
          b.participantIds.length + (b.selectedSuggestionIds?.length ?? 0) * 0.5;
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
export async function addGift(
  g: Omit<Gift, "id" | "enteredStackAt" | "stackOrder" | "participantIds">,
) {
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

// ─── Feedback (cross-group, top-level) ──────────────────
export async function addFeedback(f: Omit<Feedback, "id" | "createdAt">) {
  await addDoc(collection(db, "feedback"), clean({ ...f, createdAt: Date.now() }));
}

export async function updateFeedback(id: ID, patch: Partial<Feedback>) {
  await updateDoc(doc(db, "feedback", id), clean(patch as Record<string, unknown>));
}

export async function deleteFeedback(id: ID) {
  await deleteDoc(doc(db, "feedback", id));
}

// ─── Settings (= group root doc) ────────────────────────
export async function updateSettings(patch: Partial<Settings>) {
  // Strip passwordHash if anyone tries to write it from the client — the
  // hash lives in /_meta/auth and is only writable by Cloud Functions.
  const { passwordHash: _strip, ...safe } = patch;
  void _strip;
  await setDoc(
    groupRootDoc(),
    clean(safe as Record<string, unknown>),
    { merge: true },
  );
}

// Re-export `auth` for callers that want the current user (e.g. for logout).
export { auth };

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
  deleteField,
  FieldPath,
  runTransaction,
  writeBatch,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { getGiftLocks, normalizePoll, pollPhase, type PollCloseReason } from "@shared/poll";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { getIdentity } from "./auth";
import { auth, authReady, db, functions } from "./firebase";
import { dedupPlan, personDeletion } from "./cascade";
import { isFeedbackOwner } from "./feedback-owner";
import { toUpdate } from "./patch";
import { assertNotRecipient } from "./spoiler";
import { adoptedSuggestionId, fulfilledWishIds } from "./wishlist";
import {
  assertCanStartPoll,
  closeFields,
  extendedEndsAt,
  isPaidByOnlyPatch,
  legacyVoterIds,
  newPollDoc,
  PollLockedError,
  startPollBlocker,
  toggledVotes,
  type LockedAction,
} from "./pollOps";
import type {
  Feedback,
  Gift,
  ID,
  Member,
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
  members: Member[];
  settings: Settings;
  /** Group doc has arrived. */
  loaded: boolean;
  /** First gifts snapshot has been received. */
  giftsHydrated: boolean;
  /** First persons snapshot has been received. */
  personsHydrated: boolean;
  /** First suggestions snapshot has been received. */
  suggestionsHydrated: boolean;
  /** First polls snapshot has been received. */
  pollsHydrated: boolean;
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
  members: [],
  settings: DEFAULT_SETTINGS,
  loaded: false,
  giftsHydrated: false,
  personsHydrated: false,
  suggestionsHydrated: false,
  pollsHydrated: false,
  activeGroupId: null,
  permissionError: false,
});

let state: State = emptyState();

/** giftId → Personen, deren Stimme im Doc noch als String steht (siehe setMyVote). */
let legacyVoters = new Map<ID, Set<ID>>();

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
// Re-subscribes whenever the Firebase auth user changes (anonymous →
// Google, sign-out, account switch). The query is owner-aware:
// - The owner account (see feedback-owner.ts) subscribes to ALL feedback.
// - Everyone else subscribes only to their own (where byUid == myUid),
//   which is exactly what firestore.rules permits.
let feedbackUnsub: (() => void) | null = null;
let feedbackUidWatching: string | null = null;
let feedbackOwnerWatching: boolean | null = null;
let feedbackAuthUnsub: (() => void) | null = null;

function teardownFeedbackData() {
  if (feedbackUnsub) {
    feedbackUnsub();
    feedbackUnsub = null;
  }
  feedbackUidWatching = null;
  feedbackOwnerWatching = null;
  state.feedback = [];
}

function applyFeedbackSubscription() {
  const user = auth.currentUser;
  if (!user) {
    teardownFeedbackData();
    notify();
    return;
  }
  const owner = isFeedbackOwner(user);
  const uid = user.uid;
  // Avoid resubscribing if nothing relevant changed.
  if (
    feedbackUnsub &&
    feedbackUidWatching === uid &&
    feedbackOwnerWatching === owner
  ) {
    return;
  }
  if (feedbackUnsub) {
    feedbackUnsub();
    feedbackUnsub = null;
  }
  feedbackUidWatching = uid;
  feedbackOwnerWatching = owner;

  const ref = owner
    ? collection(db, "feedback")
    : query(collection(db, "feedback"), where("byUid", "==", uid));

  feedbackUnsub = onSnapshot(
    ref,
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
}

function ensureFeedbackSubscription() {
  if (feedbackAuthUnsub) {
    applyFeedbackSubscription();
    return;
  }
  feedbackAuthUnsub = onAuthStateChanged(auth, () => {
    applyFeedbackSubscription();
  });
  authReady
    .then(() => {
      applyFeedbackSubscription();
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
            state.suggestionsHydrated = true;
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
          collection(db, "groups", groupId, "members"),
          (snap) => {
            state.members = snap.docs.map((d) => {
              const data = d.data() as Omit<Member, "uid">;
              return { uid: d.id, ...data };
            });
            notify();
          },
          onErr("members"),
        ),
      );
      unsubscribers.push(
        onSnapshot(
          collection(db, "groups", groupId, "polls"),
          (snap) => {
            // Doc-ID = giftId; normalizePoll liest auch Alt-Formate (Stimme als String).
            state.polls = snap.docs.map((d) => ({ ...normalizePoll(d.data()), giftId: d.id }));
            legacyVoters = new Map(snap.docs.map((d) => [d.id, new Set(legacyVoterIds(d.data().votes))]));
            state.pollsHydrated = true;
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

/** Synchronisiert die lokale "Wer bin ich?"-Auswahl mit der Cloud
 *  (members/{uid}.identityPersonId). Damit andere User sehen, welche
 *  Personen schon aktiv genutzt werden. Best-effort, fire-and-forget. */
export async function setMyIdentityCloud(personId: ID | null): Promise<void> {
  if (!state.activeGroupId) {
    console.info("[identity-sync] skipped: no active group");
    return;
  }
  try {
    await authReady;
    const user = auth.currentUser;
    if (!user) {
      console.warn("[identity-sync] skipped: not authenticated");
      return;
    }
    const ref = doc(db, "groups", state.activeGroupId, "members", user.uid);
    // setDoc + merge ist robuster als updateDoc — falls das identityPersonId-
    // Feld zum ersten Mal gesetzt wird, schreibt es einfach das Feld dazu.
    await setDoc(ref, { identityPersonId: personId ?? "" }, { merge: true });
    console.info("[identity-sync] wrote", {
      groupId: state.activeGroupId,
      uid: user.uid,
      personId,
    });
  } catch (err) {
    console.warn("[identity-sync] failed", err);
  }
}

// ─── Persons ────────────────────────────────────────────
/** Legt eine Person an und liefert ihre neue ID (z. B. „Ich bin noch nicht dabei“). */
export async function addPerson(p: Omit<Person, "id" | "createdAt">): Promise<ID> {
  const ref = await addDoc(gcol("persons"), clean({ ...p, createdAt: Date.now() }));
  return ref.id;
}

export async function updatePerson(id: ID, patch: Partial<Person>) {
  await updateDoc(gdoc("persons", id), clean(patch as Record<string, unknown>));
}

/** Löscht die Person samt ihrer Geschenke, deren Ideen und Abstimmungen und ihrer Wünsche (B30). */
export async function deletePerson(id: ID) {
  if (!state.activeGroupId) throw new Error("No active group");
  const plan = personDeletion(id, state);
  const batch = writeBatch(db);
  batch.delete(gdoc("persons", id));
  plan.gifts.forEach((gid) => batch.delete(gdoc("gifts", gid)));
  plan.suggestions.forEach((sid) => batch.delete(gdoc("suggestions", sid)));
  plan.polls.forEach((pid) => batch.delete(gdoc("polls", pid)));
  plan.wishlist.forEach((wid) => batch.delete(gdoc("wishlist", wid)));
  await batch.commit();
}

/**
 * Deduplicate open gifts: same (personId, year) → keep richest, drop rest.
 * Ideen der Doppel wandern zum behaltenen Geschenk, ihre Polls fallen weg (B30).
 */
let dedupRunning = false;
export async function deduplicateOpenGifts(): Promise<number> {
  if (dedupRunning) return 0;
  dedupRunning = true;
  try {
    const plan = dedupPlan(state.gifts, state.suggestions);
    if (plan.gifts.length === 0) return 0;
    const batch = writeBatch(db);
    plan.gifts.forEach((id) => {
      batch.delete(gdoc("gifts", id));
      batch.delete(gdoc("polls", id));
    });
    plan.moves.forEach((m) => batch.update(gdoc("suggestions", m.id), { giftId: m.giftId }));
    await batch.commit();
    return plan.gifts.length;
  } finally {
    dedupRunning = false;
  }
}

// ─── Gifts ──────────────────────────────────────────────
export async function addGift(
  g: Omit<Gift, "id" | "enteredStackAt" | "stackOrder" | "participantIds">,
) {
  const maxOrder = state.gifts.reduce((m, x) => Math.max(m, x.stackOrder), 0);
  // Default-Teilnehmer der beschenkten Person übernehmen (gesetzt via
  // Settings → „Wo mache ich mit?"). Fallback: leer.
  const host = state.persons.find((p) => p.id === g.personId);
  const initialParticipants = host?.defaultParticipantIds ?? [];
  await addDoc(
    gcol("gifts"),
    clean({
      ...g,
      enteredStackAt: Date.now(),
      stackOrder: maxOrder + 1,
      participantIds: initialParticipants,
    }),
  );
}

export async function ensureAutoGift(
  personId: ID,
  year: number,
  budgetPerPerson: number,
): Promise<void> {
  // WICHTIG: erst per getDoc auf die deterministische ID prüfen — sonst
  // überschreibt das setDoc unten ein bereits bestehendes Geschenk dieser
  // Person+Jahr-Kombination, das gerade nicht im "open"-Status ist
  // (confirmed, received). Bis v1.7.0 war hier nur ein query-Filter auf
  // status=="open" — das führte dazu, dass "Auswahl bestätigen" das Gift
  // beim nächsten Stack-Render mit leeren Feldern wieder überschrieb.
  const ref = gdoc("gifts", `${personId}_${year}`);
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  // Zusätzlich noch ein Query für manuell hinzugefügte Geschenke mit
  // random-IDs (legacy), damit bei mehreren offenen Karten keine
  // weitere automatisch hinzukommt.
  const q = query(
    gcol("gifts"),
    where("personId", "==", personId),
    where("year", "==", year),
    limit(1),
  );
  const found = await getDocs(q);
  if (!found.empty) return;

  // Default-Teilnehmer der beschenkten Person übernehmen.
  const host = state.persons.find((p) => p.id === personId);
  const initialParticipants = host?.defaultParticipantIds ?? [];

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
      participantIds: initialParticipants,
    }),
  );
}

/** Setzt den globalen Default „Person `participantId` nimmt bei den
 *  Geschenken für `hostPersonId` teil". Wendet die Änderung sofort auf
 *  alle offenen + bestätigten Geschenke dieser Person an. */
export async function setDefaultParticipation(
  hostPersonId: ID,
  participantId: ID,
  on: boolean,
): Promise<void> {
  const host = state.persons.find((p) => p.id === hostPersonId);
  if (!host) return;
  const currentDefaults = host.defaultParticipantIds ?? [];
  const has = currentDefaults.includes(participantId);
  if (on === has) {
    // Default ist schon korrekt — wir wenden die Änderung trotzdem auf
    // aktive Gifts an, damit der Toggle als „force apply" funktioniert.
  }
  const nextDefaults = on
    ? Array.from(new Set([...currentDefaults, participantId]))
    : currentDefaults.filter((x) => x !== participantId);

  const batch = writeBatch(db);
  batch.update(gdoc("persons", hostPersonId), {
    defaultParticipantIds: nextDefaults,
  });

  state.gifts
    .filter(
      (g) =>
        g.personId === hostPersonId &&
        (g.status === "open" || g.status === "confirmed"),
    )
    .forEach((g) => {
      const current = g.participantIds ?? [];
      const giftHas = current.includes(participantId);
      if (on && !giftHas) {
        batch.update(gdoc("gifts", g.id), {
          participantIds: [...current, participantId],
        });
      } else if (!on && giftHas) {
        batch.update(gdoc("gifts", g.id), {
          participantIds: current.filter((x) => x !== participantId),
        });
      }
    });

  await batch.commit();
}

export async function updateGift(id: ID, patch: Partial<Gift>) {
  await updateDoc(gdoc("gifts", id), clean(patch as Record<string, unknown>));
}

/** „Diesmal aussetzen“ (on) bzw. „Wieder aufnehmen“ (off). Das Dokument bleibt,
 *  damit ensureAutoGift für dieses Jahr kein neues, leeres anlegt. */
export async function setGiftSkipped(id: ID, on: boolean) {
  await updateDoc(gdoc("gifts", id), { skippedAt: on ? Date.now() : deleteField() });
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

/** Trägt eine Person als Teilnehmer ein (idempotent, z. B. „Mitmachen & abstimmen“). */
export async function addParticipant(giftId: ID, personId: ID) {
  await updateDoc(gdoc("gifts", giftId), { participantIds: arrayUnion(personId) });
}

/** Schließt einen aktiven Poll des Geschenks im selben Batch (Zustand aus dem lokalen Snapshot). */
function closeActivePollInBatch(
  batch: ReturnType<typeof writeBatch>,
  giftId: ID,
  by: { closedBy?: ID | null; reason: PollCloseReason },
  now: number,
) {
  const poll = state.polls.find((p) => p.giftId === giftId);
  if (poll?.status !== "active") return;
  batch.update(gdoc("polls", giftId), { ...closeFields(poll, by, now) });
}

/**
 * Geschenk erhalten; eine noch aktive Abstimmung endet im selben Batch.
 * Wünsche hinter ausgewählten Ideen gelten ab jetzt als bekommen.
 */
export async function markReceived(giftId: ID, closedBy?: ID | null) {
  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(gdoc("gifts", giftId), { status: "received", receivedAt: now });
  closeActivePollInBatch(batch, giftId, { closedBy, reason: "gift-received" }, now);
  const gift = state.gifts.find((g) => g.id === giftId);
  if (gift) {
    const wishIds = new Set(state.wishlist.map((w) => w.id));
    for (const wid of fulfilledWishIds(gift, state.suggestions, wishIds)) {
      batch.update(gdoc("wishlist", wid), { fulfilledAt: now, fulfilledGiftId: giftId });
    }
  }
  await batch.commit();
}

/** Auswahl festschnallen (Zwischen-Status vor "received"); schließt eine aktive Abstimmung mit. */
export async function markConfirmed(giftId: ID, closedBy?: ID | null) {
  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(gdoc("gifts", giftId), { status: "confirmed" });
  closeActivePollInBatch(batch, giftId, { closedBy, reason: "gift-confirmed" }, now);
  await batch.commit();
}

/**
 * „Entscheidung festlegen“: EIN Batch aus Poll schließen (falls aktiv),
 * Auswahl setzen und Status confirmed.
 */
export async function decideGift(giftId: ID, selectedIds: ID[], closedBy?: ID | null) {
  const now = Date.now();
  const batch = writeBatch(db);
  closeActivePollInBatch(batch, giftId, { closedBy, reason: "gift-confirmed" }, now);
  batch.update(gdoc("gifts", giftId), { selectedSuggestionIds: selectedIds, status: "confirmed" });
  await batch.commit();
}

/** Bestätigung wieder aufheben — zurück in den "open"-Zustand. */
export async function unconfirmGift(giftId: ID) {
  await updateGift(giftId, { status: "open" });
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
/** Wirft PollLockedError, solange die Abstimmung des Geschenks läuft (lokaler Snapshot). */
function assertUnlocked(giftId: ID | undefined, action: LockedAction) {
  const gift = state.gifts.find((g) => g.id === giftId);
  if (!gift) return;
  const poll = state.polls.find((p) => p.giftId === gift.id);
  if (getGiftLocks(gift, poll, Date.now())[action].locked) throw new PollLockedError(action);
}

/** Neue Idee bzw. Wunsch-Übernahme (mit fromWishItemId). */
export async function addSuggestion(s: Omit<Suggestion, "id" | "createdAt">) {
  assertNotRecipient(state.gifts.find((g) => g.id === s.giftId), s.suggestedBy);
  assertUnlocked(s.giftId, s.fromWishItemId ? "adoptWish" : "addIdea");
  await addDoc(gcol("suggestions"), clean({ ...s, createdAt: Date.now() }));
}

export async function deleteSuggestion(id: ID) {
  assertUnlocked(state.suggestions.find((s) => s.id === id)?.giftId, "deleteIdea");
  await deleteDoc(gdoc("suggestions", id));
}

export async function updateSuggestion(id: ID, patch: Partial<Suggestion>) {
  if (!isPaidByOnlyPatch(patch)) {
    assertUnlocked(state.suggestions.find((s) => s.id === id)?.giftId, "editIdea");
  }
  // Geleerte Felder (Link, Preis) wirklich löschen (B26).
  await updateDoc(gdoc("suggestions", id), toUpdate(patch as Record<string, unknown>, deleteField));
}

/** Rückgängig nach dem Löschen: gleiche ID, gleiche Felder (setDoc). */
export async function restoreSuggestion(s: Suggestion) {
  const { id, ...data } = s;
  await setDoc(gdoc("suggestions", id), clean(data as Record<string, unknown>));
}

/** „Bezahlt von“ setzen oder entfernen (null löscht das Feld). */
export async function setPaidBy(suggestionId: ID, personId: ID | null) {
  await updateDoc(gdoc("suggestions", suggestionId), { paidBy: personId ?? deleteField() });
}

// ─── Wishlist ───────────────────────────────────────────
/** Neuer Wunsch; addedBy = aktuelle Identität (falls gesetzt). Liefert die neue ID. */
export async function addWishItem(w: Omit<WishlistItem, "id" | "createdAt" | "addedBy">): Promise<ID> {
  const ref = await addDoc(gcol("wishlist"), clean({ ...w, addedBy: getIdentity() ?? undefined, createdAt: Date.now() }));
  return ref.id;
}

/** Bearbeiten bzw. „Noch aktuell ✓“: setzt updatedAt; undefined löscht ein Feld. */
export async function updateWishItem(id: ID, patch: Partial<Omit<WishlistItem, "id" | "personId" | "createdAt">>) {
  await updateDoc(gdoc("wishlist", id), toUpdate({ ...patch, updatedAt: Date.now() }, deleteField));
}

export async function deleteWishItem(id: ID) {
  await deleteDoc(gdoc("wishlist", id));
}

/** Rückgängig nach dem Löschen: gleiche ID, gleiche Felder (setDoc). */
export async function restoreWishItem(w: WishlistItem) {
  const { id, ...data } = w;
  await setDoc(gdoc("wishlist", id), clean(data as Record<string, unknown>));
}

/**
 * Wunsch als Idee ins Geschenk übernehmen. Deterministische ID
 * wish_{giftId}_{wishId} und Transaktion mit Existenzprüfung: Doppeltipp
 * oder zwei Leute gleichzeitig ergeben keine Duplikate und überschreiben
 * nichts (created = false, wenn schon übernommen). Wirft PollLockedError
 * während der Abstimmung; ohne Identität bzw. als beschenkte Person geht es nicht.
 */
export async function adoptWish(
  giftId: ID,
  wish: WishlistItem,
  by: ID | null | undefined,
): Promise<{ id: ID; created: boolean }> {
  if (!by) throw new Error("Wähle erst, wer du bist.");
  assertNotRecipient(state.gifts.find((g) => g.id === giftId), by);
  assertUnlocked(giftId, "adoptWish");
  const id = adoptedSuggestionId(giftId, wish.id);
  if (state.suggestions.some((s) => s.id === id)) return { id, created: false };
  const ref = gdoc("suggestions", id);
  return runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) return { id, created: false };
    tx.set(
      ref,
      clean({
        giftId,
        title: wish.title,
        url: wish.url,
        price: wish.price,
        suggestedBy: by,
        fromWishItemId: wish.id,
        createdAt: Date.now(),
      }),
    );
    return { id, created: true };
  });
}

// ─── Polls ──────────────────────────────────────────────
// Doc-Pfad: groups/{gid}/polls/{giftId}. Kein Doc = keine Abstimmung.

/**
 * Neue Runde: set OHNE merge (alte Stimmen und Ende-Felder sind weg) – in
 * einer Transaktion, die abbricht, wenn laut Server schon eine Runde läuft
 * (gleichzeitiger Start, veralteter Snapshot). Liefert startedAt = Runden-Schlüssel.
 */
export async function startPoll(
  giftId: ID,
  opts: { durationMs: number; startedBy: ID },
): Promise<number> {
  const gift = state.gifts.find((g) => g.id === giftId);
  if (gift) {
    const ideas = state.suggestions.filter((s) => s.giftId === giftId).length;
    const blocker = startPollBlocker(gift, ideas, opts.startedBy);
    if (blocker) throw new Error(blocker);
  }
  const ref = gdoc("polls", giftId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    assertCanStartPoll(snap.exists() ? normalizePoll(snap.data()) : null, now);
    tx.set(ref, newPollDoc(giftId, { now, ...opts }));
    return now;
  });
}

/**
 * Setzt genau eine eigene Stimme auf den gewünschten Zustand – atomar über
 * den Feldpfad votes.{personId}, fremde Stimmen bleiben unberührt; ein
 * Doppeltipp hebt sich nicht auf. Steht die eigene Stimme noch im Alt-Format
 * (String), wird die ganze normalisierte Liste geschrieben.
 */
export async function setMyVote(giftId: ID, personId: ID, suggestionId: ID, on: boolean) {
  assertNotRecipient(state.gifts.find((g) => g.id === giftId), personId);
  const poll = state.polls.find((p) => p.giftId === giftId);
  if (pollPhase(poll, Date.now()) !== "running") throw new Error("Die Abstimmung ist schon beendet.");
  const value = legacyVoters.get(giftId)?.has(personId)
    ? toggledVotes(poll?.votes?.[personId] ?? [], suggestionId, on)
    : on
      ? arrayUnion(suggestionId)
      : arrayRemove(suggestionId);
  await updateDoc(gdoc("polls", giftId), new FieldPath("votes", personId), value);
}

/** Nimmt alle eigenen Stimmen zurück (nur der eigene Eintrag). */
export async function clearMyVotes(giftId: ID, personId: ID) {
  await updateDoc(gdoc("polls", giftId), new FieldPath("votes", personId), deleteField());
}

/** Beendet eine aktive Runde; false, wenn sie schon beendet oder gelöscht war. */
export async function closePoll(
  giftId: ID,
  by: { closedBy?: ID | null; reason: PollCloseReason },
): Promise<boolean> {
  const ref = gdoc("polls", giftId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const poll = normalizePoll(snap.data());
    if (poll.status !== "active") return false;
    tx.update(ref, { ...closeFields(poll, by, Date.now()) });
    return true;
  });
}

/**
 * Verlängert um `addMs` (ab der alten Frist, mindestens ab jetzt). Eine
 * beendete Runde wird wieder aktiv, die Stimmen bleiben. Liefert die neue Frist.
 */
export async function extendPoll(giftId: ID, addMs: number): Promise<number> {
  const ref = gdoc("polls", giftId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Die Abstimmung gibt es nicht mehr.");
    const { endsAt, reopen } = extendedEndsAt(normalizePoll(snap.data()), addMs, Date.now());
    tx.update(
      ref,
      reopen
        ? {
            endsAt,
            status: "active",
            closedAt: deleteField(),
            closedBy: deleteField(),
            closedReason: deleteField(),
          }
        : { endsAt },
    );
    return endsAt;
  });
}

/** Verwerfen: Doc löschen – Stimmen sind wirklich weg (Archiv sichert im Hintergrund). */
export async function discardPoll(giftId: ID) {
  await deleteDoc(gdoc("polls", giftId));
}

// ─── Archive / History / Restore (Dev-Hilfsmittel) ──────
// Backed by Cloud-Function-Trigger archiveGroupDocChange: jede Update-
// oder Delete-Operation an gifts/persons/suggestions/wishlist/polls
// produziert einen Snapshot in groups/{gid}/_archive/{archId}. Diese
// API ist absichtlich NICHT in der App-UI sichtbar — sie ist als
// Safety-Net für Development-Fails gedacht. Wenn ein Bug Daten
// zerstört, kann man via Browser-Console
// `import("@/lib/storage").then(s => s.listTrash().then(console.log))`
// das verlorene Doc finden und mit `restoreFromArchive(entry)`
// wiederherstellen.

export type ArchivableCollection =
  | "gifts"
  | "persons"
  | "suggestions"
  | "wishlist"
  | "polls";

export interface ArchiveEntry {
  id: ID;
  collection: ArchivableCollection;
  docId: ID;
  op: "update" | "delete";
  data: Record<string, unknown>;
  archivedAt: number; // ms
}

function normalizeArchive(
  id: string,
  raw: Record<string, unknown>,
): ArchiveEntry | null {
  const collection = raw.collection as string | undefined;
  const docId = raw.docId as string | undefined;
  const op = raw.op as string | undefined;
  if (!collection || !docId || !op) return null;
  const ts = raw.archivedAt as { toMillis?: () => number } | number | undefined;
  const archivedAt =
    typeof ts === "number"
      ? ts
      : ts && typeof ts.toMillis === "function"
        ? ts.toMillis()
        : Date.now();
  return {
    id,
    collection: collection as ArchivableCollection,
    docId,
    op: op as "update" | "delete",
    data: (raw.data as Record<string, unknown>) ?? {},
    archivedAt,
  };
}

/** Listet die letzten Snapshots eines spezifischen Docs (neuste zuerst). */
export async function listDocHistory(
  collectionId: ArchivableCollection,
  docId: ID,
): Promise<ArchiveEntry[]> {
  if (!state.activeGroupId) return [];
  const q = query(
    collection(db, "groups", state.activeGroupId, "_archive"),
    where("collection", "==", collectionId),
    where("docId", "==", docId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => normalizeArchive(d.id, d.data() as Record<string, unknown>))
    .filter((x): x is ArchiveEntry => !!x)
    .sort((a, b) => b.archivedAt - a.archivedAt);
}

/** Listet alle Lösch-Snapshots der Gruppe — Papierkorb. */
export async function listTrash(): Promise<ArchiveEntry[]> {
  if (!state.activeGroupId) return [];
  const q = query(
    collection(db, "groups", state.activeGroupId, "_archive"),
    where("op", "==", "delete"),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => normalizeArchive(d.id, d.data() as Record<string, unknown>))
    .filter((x): x is ArchiveEntry => !!x)
    .sort((a, b) => b.archivedAt - a.archivedAt);
}

/** Stellt ein archiviertes Doc wieder her — schreibt die Snapshot-Felder
 *  zurück auf das Original. Für Gifts: anschließend werden auch alle
 *  verwaisten Suggestions wieder mit dem Gift verbunden (sind sowieso
 *  noch da, weil deleteGift sie zwar parallel löscht — aber das Archiv
 *  enthält sie ggf. nicht). Suggestions/Polls werden separat
 *  wiederhergestellt, wenn der User das möchte. */
export async function restoreFromArchive(entry: ArchiveEntry): Promise<void> {
  if (!state.activeGroupId) throw new Error("No active group");
  const ref = gdoc(entry.collection, entry.docId);
  // Snapshot enthält das vollständige Doc — wir schreiben es als
  // setDoc (ohne merge), damit auch Felder, die später gesetzt wurden,
  // wieder verschwinden. So entspricht das Ergebnis exakt dem
  // archivierten Zustand.
  await setDoc(ref, clean(entry.data as Record<string, unknown>));
}

/** Löscht einen einzelnen Archive-Eintrag (Member-only, kein Restore). */
export async function deleteArchiveEntry(archiveId: ID): Promise<void> {
  if (!state.activeGroupId) throw new Error("No active group");
  await deleteDoc(
    doc(db, "groups", state.activeGroupId, "_archive", archiveId),
  );
}

// ─── Feedback (cross-group, top-level) ──────────────────
export async function addFeedback(
  f: Omit<Feedback, "id" | "createdAt" | "byUid" | "byEmail">,
) {
  // WICHTIG: aktuellen User aus auth.currentUser nehmen, nicht aus
  // authReady. authReady resolvt nur EINMAL initial; bei späterem Google-
  // Login ändert sich die UID, aber authReady liefert weiterhin die alte.
  // Die firestore-rule prüft request.auth.uid (= aktuelle UID) gegen
  // byUid — wäre die UID veraltet, käme permission-denied beim Create.
  await authReady; // sicherstellen dass Auth überhaupt initialisiert ist
  const user = auth.currentUser;
  if (!user) throw new Error("Nicht angemeldet — Feedback konnte nicht gespeichert werden");
  const uid = user.uid;
  const email = user.email?.toLowerCase() ?? undefined;
  await addDoc(
    collection(db, "feedback"),
    clean({
      ...f,
      byUid: uid,
      byEmail: email,
      createdAt: Date.now(),
    }),
  );
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

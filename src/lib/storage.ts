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
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, authReady, db, functions } from "./firebase";
import { isFeedbackOwner } from "./feedback-owner";
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
            state.polls = snap.docs.map((d) => {
              const raw = d.data() as {
                status?: Poll["status"];
                startedAt?: number;
                closedAt?: number;
                votes?: Record<string, unknown>;
              };
              return {
                giftId: d.id,
                status: raw.status ?? "none",
                startedAt: raw.startedAt,
                closedAt: raw.closedAt,
                votes: normalizeVotes(raw.votes),
              };
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

/**
 * Konvertiert das Vote-Mapping in das aktuelle Multi-Vote-Format. Akzeptiert
 * sowohl alte String-Werte (`{ personId: suggestionId }`) als auch das neue
 * Array-Format (`{ personId: suggestionId[] }`) — alte Daten werden
 * transparent in die einlementige Liste hochgeschrieben.
 */
function normalizeVotes(raw: Record<string, unknown> | undefined): Record<ID, ID[]> {
  if (!raw) return {};
  const out: Record<ID, ID[]> = {};
  for (const [pid, v] of Object.entries(raw)) {
    if (Array.isArray(v)) {
      out[pid] = v.filter((x): x is string => typeof x === "string");
    } else if (typeof v === "string" && v) {
      out[pid] = [v];
    } else {
      out[pid] = [];
    }
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
  if (!state.activeGroupId) return;
  try {
    const uid = await authReady;
    const ref = doc(db, "groups", state.activeGroupId, "members", uid);
    await updateDoc(ref, { identityPersonId: personId ?? "" });
  } catch (err) {
    console.warn("identity cloud-sync failed", err);
  }
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

/** Auswahl festschnallen (Zwischen-Status vor "received"). */
export async function markConfirmed(giftId: ID) {
  await updateGift(giftId, { status: "confirmed" });
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

/** Toggelt die Stimme einer Person für genau einen Vorschlag. Mehrfach-Voten
 *  unterstützt: pro Person kann eine Liste von suggestionIds existieren. */
export async function castVote(giftId: ID, personId: ID, suggestionId: ID) {
  const existing = state.polls.find((p) => p.giftId === giftId);
  const current = existing?.votes[personId] ?? [];
  const next = current.includes(suggestionId)
    ? current.filter((x) => x !== suggestionId)
    : [...current, suggestionId];
  const ref = gdoc("polls", giftId);
  await setDoc(ref, { votes: { [personId]: next } }, { merge: true });
}

/** Entfernt eine spezifische Stimme einer Person. */
export async function removeVote(
  giftId: ID,
  personId: ID,
  suggestionId?: ID,
) {
  const existing = state.polls.find((p) => p.giftId === giftId);
  if (!existing) return;
  const next: Record<ID, ID[]> = { ...existing.votes };
  if (suggestionId) {
    const list = (next[personId] ?? []).filter((x) => x !== suggestionId);
    if (list.length > 0) next[personId] = list;
    else delete next[personId];
  } else {
    delete next[personId];
  }
  await updateDoc(gdoc("polls", giftId), { votes: next });
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

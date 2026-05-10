import { useSyncExternalStore } from "react";

const AUTH_KEY = "gm:auth:v1";
const GROUP_KEY = "gm:group:v1";
const KNOWN_GROUPS_KEY = "gm:groups:v1";
const GROUP_EVENT = "gm:group-change";
const KNOWN_GROUPS_EVENT = "gm:groups-change";
const IDENTITY_EVENT = "gm:identity-change";

export async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Auth ──────────────────────────────────────────────────────
export function isAuthed(): boolean {
  return localStorage.getItem(AUTH_KEY) === "yes";
}

export function setAuthed(yes: boolean) {
  if (yes) {
    localStorage.setItem(AUTH_KEY, "yes");
  } else {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(GROUP_KEY);
    localStorage.removeItem(KNOWN_GROUPS_KEY);
    window.dispatchEvent(new Event(GROUP_EVENT));
    window.dispatchEvent(new Event(KNOWN_GROUPS_EVENT));
  }
}

// ── Known groups (multi-group switcher) ──────────────────────
export function getKnownGroups(): string[] {
  try {
    const raw = localStorage.getItem(KNOWN_GROUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeKnownGroups(ids: string[]) {
  localStorage.setItem(KNOWN_GROUPS_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(KNOWN_GROUPS_EVENT));
}

export function addKnownGroup(id: string) {
  const ids = getKnownGroups();
  if (ids.includes(id)) return;
  writeKnownGroups([...ids, id]);
}

export function removeKnownGroup(id: string) {
  const ids = getKnownGroups();
  const next = ids.filter((x) => x !== id);
  if (next.length === ids.length) return;
  writeKnownGroups(next);
}

const KNOWN_GROUPS_SENTINEL: string[] = [];
let knownGroupsCache: string[] = KNOWN_GROUPS_SENTINEL;
let knownGroupsCacheRaw: string | null | undefined = undefined;

function getKnownGroupsStable(): string[] {
  // useSyncExternalStore requires getSnapshot to return the SAME reference
  // between renders when nothing changed. localStorage.getItem returns a
  // fresh string each call; we cache by raw value to keep the parsed array
  // referentially stable until a real change happens.
  const raw = localStorage.getItem(KNOWN_GROUPS_KEY);
  if (raw === knownGroupsCacheRaw) return knownGroupsCache;
  knownGroupsCacheRaw = raw;
  knownGroupsCache = getKnownGroups();
  return knownGroupsCache;
}

function subscribeKnownGroups(cb: () => void) {
  window.addEventListener(KNOWN_GROUPS_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(KNOWN_GROUPS_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useKnownGroups(): string[] {
  return useSyncExternalStore(
    subscribeKnownGroups,
    getKnownGroupsStable,
    () => KNOWN_GROUPS_SENTINEL,
  );
}

// ── Group ─────────────────────────────────────────────────────
export function getGroupId(): string | null {
  return localStorage.getItem(GROUP_KEY);
}

export function setGroupId(id: string | null) {
  if (id) localStorage.setItem(GROUP_KEY, id);
  else localStorage.removeItem(GROUP_KEY);
  window.dispatchEvent(new Event(GROUP_EVENT));
}

function subscribeGroup(cb: () => void) {
  window.addEventListener(GROUP_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(GROUP_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useGroupId(): string | null {
  return useSyncExternalStore(subscribeGroup, getGroupId, () => null);
}

// ── Identity (scoped per group) ───────────────────────────────
function identityKey(): string | null {
  const g = getGroupId();
  return g ? `gm:identity:v1:${g}` : null;
}

export function getIdentity(): string | null {
  const k = identityKey();
  return k ? localStorage.getItem(k) : null;
}

export function setIdentity(personId: string | null) {
  const k = identityKey();
  if (!k) return;
  if (personId) localStorage.setItem(k, personId);
  else localStorage.removeItem(k);
  window.dispatchEvent(new Event(IDENTITY_EVENT));
}

function subscribeIdentity(cb: () => void) {
  window.addEventListener(IDENTITY_EVENT, cb);
  window.addEventListener(GROUP_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(IDENTITY_EVENT, cb);
    window.removeEventListener(GROUP_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useIdentity(): string | null {
  return useSyncExternalStore(subscribeIdentity, getIdentity, () => null);
}

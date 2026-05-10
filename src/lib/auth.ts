import { useSyncExternalStore } from "react";

const AUTH_KEY = "gm:auth:v1";
const GROUP_KEY = "gm:group:v1";
const GROUP_EVENT = "gm:group-change";
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
    window.dispatchEvent(new Event(GROUP_EVENT));
  }
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

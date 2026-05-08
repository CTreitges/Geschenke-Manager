import { useSyncExternalStore } from "react";

const AUTH_KEY = "gm:auth:v1";
const IDENTITY_KEY = "gm:identity:v1";
const IDENTITY_EVENT = "gm:identity-change";

export async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isAuthed(): boolean {
  return localStorage.getItem(AUTH_KEY) === "yes";
}

export function setAuthed(yes: boolean) {
  if (yes) localStorage.setItem(AUTH_KEY, "yes");
  else localStorage.removeItem(AUTH_KEY);
}

export function getIdentity(): string | null {
  return localStorage.getItem(IDENTITY_KEY);
}

export function setIdentity(personId: string | null) {
  if (personId) localStorage.setItem(IDENTITY_KEY, personId);
  else localStorage.removeItem(IDENTITY_KEY);
  window.dispatchEvent(new Event(IDENTITY_EVENT));
}

function subscribeIdentity(cb: () => void) {
  window.addEventListener(IDENTITY_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(IDENTITY_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useIdentity(): string | null {
  return useSyncExternalStore(subscribeIdentity, getIdentity, () => null);
}

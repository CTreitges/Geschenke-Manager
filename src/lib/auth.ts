const AUTH_KEY = "gm:auth:v1";
const IDENTITY_KEY = "gm:identity:v1";

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
}

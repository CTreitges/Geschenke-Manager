export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone;
  return iosStandalone === true;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALLED_FLAG = "gm:pwa-installed-ever";

export function wasPwaInstalledEver(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(INSTALLED_FLAG) === "yes";
  } catch {
    return false;
  }
}

function markInstalled() {
  try {
    localStorage.setItem(INSTALLED_FLAG, "yes");
  } catch {
    /* ignore */
  }
}

// Chrome fires `beforeinstallprompt` once on page load — typically before
// any component that wants the event is mounted. We grab it module-level
// and let consumers ask for it.
let cachedPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

export function getCachedInstallPrompt(): BeforeInstallPromptEvent | null {
  return cachedPrompt;
}

export function onInstallPromptChange(cb: () => void): () => void {
  promptListeners.add(cb);
  return () => {
    promptListeners.delete(cb);
  };
}

export async function tryInstallPwa(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!cachedPrompt) return "unavailable";
  try {
    await cachedPrompt.prompt();
    const choice = await cachedPrompt.userChoice;
    if (choice.outcome === "accepted") markInstalled();
    cachedPrompt = null;
    promptListeners.forEach((cb) => cb());
    return choice.outcome;
  } catch (err) {
    console.warn("[pwa] prompt failed:", err);
    return "unavailable";
  }
}

if (typeof window !== "undefined") {
  if (isStandalonePWA()) markInstalled();
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    cachedPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((cb) => cb());
  });
  window.addEventListener("appinstalled", () => {
    markInstalled();
    cachedPrompt = null;
    promptListeners.forEach((cb) => cb());
  });
}

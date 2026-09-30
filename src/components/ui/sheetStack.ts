// Gemeinsame Verwaltung offener Sheets: Stapel (nur das oberste reagiert auf
// Esc/Tab), Scroll-Lock und Android-Zurück über einen eigenen History-Eintrag.
//
// Ablauf: Beim Öffnen legt jedes Sheet per pushState einen Eintrag mit der
// gleichen URL an. Die Zurück-Taste springt darauf zurück → popstate → das
// oberste Sheet schließt. Schließt das Sheet anders (✕, Esc, Backdrop, Code),
// räumt es seinen Eintrag mit history.back() ab; das dadurch ausgelöste
// popstate wird ignoriert. Weil history.back() asynchron ist, wartet ein neuer
// pushState (und useConfirm) mit whenHistorySettled(), bis es durch ist –
// sonst überholen sich Einträge bzw. ein navigate() direkt nach dem Schließen.

type Entry = { id: number; close: () => void; pushed: boolean; released: boolean };

const stack: Entry[] = [];
let seq = 0;
let pendingBacks = 0;
let waiters: Array<() => void> = [];
let listening = false;
let savedOverflow: string | null = null;

/** Sicherheitsnetz, falls ein erwartetes popstate nie eintrifft. */
const SETTLE_TIMEOUT_MS = 1000;

function flushWaiters() {
  const w = waiters;
  waiters = [];
  w.forEach((resolve) => resolve());
}

function onPopState() {
  if (pendingBacks > 0) {
    pendingBacks--;
    if (pendingBacks === 0) flushWaiters();
    return;
  }
  // Zurück-Taste: das zuletzt eingetragene Sheet schließen.
  for (let i = stack.length - 1; i >= 0; i--) {
    const e = stack[i];
    if (e.pushed) {
      e.pushed = false; // Eintrag ist schon weg → release() darf nicht zurückspringen
      e.close();
      return;
    }
  }
}

function sheetId(state: unknown): number | undefined {
  return state && typeof state === "object" ? (state as { gmSheet?: number }).gmSheet : undefined;
}

/** Löst auf, sobald alle von Sheets ausgelösten history.back() verarbeitet sind. */
export function whenHistorySettled(): Promise<void> {
  if (pendingBacks === 0) return Promise.resolve();
  return new Promise((resolve) => {
    waiters.push(resolve);
    setTimeout(() => {
      if (pendingBacks === 0) return;
      pendingBacks = 0;
      flushWaiters();
    }, SETTLE_TIMEOUT_MS);
  });
}

function lockScroll() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  savedOverflow = el.style.overflow;
  el.style.overflow = "hidden";
}

function unlockScroll() {
  if (typeof document === "undefined" || savedOverflow === null) return;
  document.documentElement.style.overflow = savedOverflow;
  savedOverflow = null;
}

export type SheetHandle = { isTop: () => boolean; release: () => void };

/** Meldet ein geöffnetes Sheet an. `close` wird bei Android-Zurück aufgerufen. */
export function registerSheet(close: () => void): SheetHandle {
  const entry: Entry = { id: ++seq, close, pushed: false, released: false };
  if (stack.length === 0) lockScroll();
  stack.push(entry);
  if (!listening) {
    window.addEventListener("popstate", onPopState);
    listening = true;
  }
  // Verzögert: StrictMode meldet in der Entwicklung sofort wieder ab, und ein
  // noch laufendes history.back() eines anderen Sheets muss erst durch sein.
  void whenHistorySettled().then(() => {
    if (entry.released) return;
    const state: unknown = history.state;
    const base = state && typeof state === "object" ? state : {};
    history.pushState({ ...base, gmSheet: entry.id }, "");
    entry.pushed = true;
  });

  return {
    isTop: () => stack[stack.length - 1] === entry,
    release: () => {
      if (entry.released) return;
      entry.released = true;
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) unlockScroll();
      // Nur zurückspringen, wenn wir noch auf dem eigenen Eintrag stehen.
      // Hat jemand inzwischen navigiert, bleibt der Eintrag liegen – ein
      // Zurückspringen würde sonst die Navigation rückgängig machen.
      if (entry.pushed && sheetId(history.state) === entry.id) {
        pendingBacks++;
        history.back();
      }
      entry.pushed = false;
    },
  };
}

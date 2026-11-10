// Reine Pager-Logik des Tutorials (ohne React/DOM), getestet in pager.test.ts.

export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(Math.round(index), 0), count - 1);
}

/** Aktive Seite aus der Scroll-Position des Scroll-Snap-Containers. */
export function indexFromScroll(scrollLeft: number, pageWidth: number, count: number): number {
  if (pageWidth <= 0) return 0;
  return clampIndex(scrollLeft / pageWidth, count);
}

/**
 * Während eines programmatischen Blätterns (Knopf, Punkt, Taste) bleibt die
 * Zielseite aktiv, bis der Scroll dort ankommt – sonst würden Punkte und
 * Ansage die überflogenen Seiten kurz anzeigen.
 */
export function settleIndex(scrolled: number, pending: number | null): { index: number; pending: number | null } {
  if (pending === null) return { index: scrolled, pending: null };
  return { index: pending, pending: scrolled === pending ? null : pending };
}

export type PagerAction = { kind: "goto"; index: number } | { kind: "skip" } | { kind: "finish" } | null;

/**
 * Tastatur: ←/→ blättern, Home/End springen, Esc = Überspringen,
 * Enter auf der letzten Seite = fertig. Unbekannte Tasten → null.
 */
export function keyAction(key: string, index: number, count: number): PagerAction {
  const last = count - 1;
  switch (key) {
    case "ArrowRight":
      return index < last ? { kind: "goto", index: index + 1 } : null;
    case "ArrowLeft":
      return index > 0 ? { kind: "goto", index: index - 1 } : null;
    case "Home":
      return index !== 0 ? { kind: "goto", index: 0 } : null;
    case "End":
      return index !== last ? { kind: "goto", index: last } : null;
    case "Escape":
      return { kind: "skip" };
    case "Enter":
      return index === last ? { kind: "finish" } : null;
    default:
      return null;
  }
}

/** Ansage für den Live-Bereich, z. B. „Seite 4 von 5: Gemeinsam abstimmen“. */
export function pageAnnouncement(index: number, count: number, title: string): string {
  return `Seite ${index + 1} von ${count}: ${title}`;
}

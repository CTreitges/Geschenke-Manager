import { describe, expect, it } from "vitest";
import { clampIndex, indexFromScroll, keyAction, pageAnnouncement, settleIndex } from "./pager";
import { tutorialPages } from "./pages";

describe("Pager-Logik", () => {
  it("clampIndex begrenzt auf 0…count-1 und rundet", () => {
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(2.4, 5)).toBe(2);
    expect(clampIndex(2.6, 5)).toBe(3);
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(3, 0)).toBe(0);
  });

  it("indexFromScroll rechnet Scroll-Position in Seiten um", () => {
    expect(indexFromScroll(0, 390, 5)).toBe(0);
    expect(indexFromScroll(390 * 3, 390, 5)).toBe(3);
    expect(indexFromScroll(390 * 1.49, 390, 5)).toBe(1);
    expect(indexFromScroll(390 * 1.51, 390, 5)).toBe(2);
    expect(indexFromScroll(99999, 390, 5)).toBe(4);
    // noch nicht gelayoutet (Breite 0) → erste Seite statt NaN
    expect(indexFromScroll(120, 0, 5)).toBe(0);
  });

  it("keyAction: Pfeile, Home/End, Esc, Enter", () => {
    expect(keyAction("ArrowRight", 0, 5)).toEqual({ kind: "goto", index: 1 });
    expect(keyAction("ArrowRight", 4, 5)).toBeNull();
    expect(keyAction("ArrowLeft", 0, 5)).toBeNull();
    expect(keyAction("ArrowLeft", 3, 5)).toEqual({ kind: "goto", index: 2 });
    expect(keyAction("Home", 3, 5)).toEqual({ kind: "goto", index: 0 });
    expect(keyAction("Home", 0, 5)).toBeNull();
    expect(keyAction("End", 1, 5)).toEqual({ kind: "goto", index: 4 });
    expect(keyAction("End", 4, 5)).toBeNull();
    expect(keyAction("Escape", 2, 5)).toEqual({ kind: "skip" });
    expect(keyAction("Enter", 2, 5)).toBeNull();
    expect(keyAction("Enter", 4, 5)).toEqual({ kind: "finish" });
    expect(keyAction("a", 2, 5)).toBeNull();
  });

  it("settleIndex hält die Zielseite, bis der Scroll ankommt", () => {
    expect(settleIndex(1, 3)).toEqual({ index: 3, pending: 3 });
    expect(settleIndex(2, 3)).toEqual({ index: 3, pending: 3 });
    expect(settleIndex(3, 3)).toEqual({ index: 3, pending: null });
    expect(settleIndex(2, null)).toEqual({ index: 2, pending: null });
  });

  it("pageAnnouncement für den Live-Bereich", () => {
    expect(pageAnnouncement(3, 5, "Gemeinsam abstimmen")).toBe("Seite 4 von 5: Gemeinsam abstimmen");
  });
});

describe("Tutorial-Seiten", () => {
  it("5 Seiten, Install-Seite 6 nur im Browser", () => {
    expect(tutorialPages({ showInstall: false, hasIdentity: true }).map((p) => p.id)).toEqual([
      "welcome",
      "birthdays",
      "wishes",
      "vote",
      "spoiler",
    ]);
    const withInstall = tutorialPages({ showInstall: true, hasIdentity: true });
    expect(withInstall).toHaveLength(6);
    expect(withInstall[5].id).toBe("install");
  });

  it("Seite 4 = Abstimmung mit Frist, Seite 5 = Spoiler-Schutz", () => {
    const pages = tutorialPages({ showInstall: false, hasIdentity: false });
    expect(pages[3].title).toBe("Gemeinsam abstimmen");
    expect(pages[3].body).toMatch(/Frist/);
    expect(pages[4].title).toBe("Keine Spoiler für dich");
  });

  it("Seite 5 bittet nur ohne Identität darum, sich auszuwählen", () => {
    const spoiler = (hasIdentity: boolean) =>
      tutorialPages({ showInstall: false, hasIdentity }).find((p) => p.id === "spoiler")!.body;
    expect(spoiler(false)).toMatch(/Sag uns gleich, wer du bist/);
    expect(spoiler(true)).not.toMatch(/wer du bist/);
  });

  it("Titel ≤ 5 Wörter, Text ≤ 2 Sätze, jede Seite mit Bildbeschreibung", () => {
    for (const p of tutorialPages({ showInstall: true, hasIdentity: false })) {
      expect(p.title.split(/\s+/).length, p.id).toBeLessThanOrEqual(5);
      expect(p.body.split(/[.!?](?=\s|$)/).filter((s) => s.trim()).length, p.id).toBeLessThanOrEqual(2);
      expect(p.alt.length, p.id).toBeGreaterThan(20);
    }
  });
});

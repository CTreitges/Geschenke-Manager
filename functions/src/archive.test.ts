import { describe, expect, it } from "vitest";
import { shouldArchive } from "./archive";

const poll = (status: string | undefined, votes: Record<string, string[]> = {}) =>
  status === undefined ? { votes } : { status, votes };

describe("shouldArchive", () => {
  it("ignoriert Collections außerhalb der Archiv-Liste", () => {
    expect(shouldArchive("members", { a: 1 }, { a: 2 })).toBe(false);
    expect(shouldArchive("_archive", { a: 1 }, undefined)).toBe(false);
  });

  it("archiviert Anlagen nicht (kein Vorher-Stand)", () => {
    expect(shouldArchive("gifts", undefined, { status: "open" })).toBe(false);
    expect(shouldArchive("polls", undefined, poll("active"))).toBe(false);
  });

  it("archiviert jede Änderung und Löschung normaler Collections", () => {
    expect(shouldArchive("gifts", { status: "open" }, { status: "open", budgetPerPerson: 30 })).toBe(true);
    expect(shouldArchive("wishlist", { title: "A" }, undefined)).toBe(true);
  });

  it("archiviert Polls bei Statuswechsel", () => {
    expect(shouldArchive("polls", poll("active"), poll("closed"))).toBe(true);
    expect(shouldArchive("polls", poll("closed"), poll("active"))).toBe(true);
    // Poll-Doc entstand durch eine Stimme ohne Status, danach wird gestartet.
    expect(shouldArchive("polls", poll(undefined, { ben: ["s1"] }), poll("active"))).toBe(true);
  });

  it("archiviert gelöschte Polls", () => {
    expect(shouldArchive("polls", poll("active", { ben: ["s1"] }), undefined)).toBe(true);
  });

  it("archiviert Polls NICHT bei einer Stimme ohne Statuswechsel", () => {
    expect(shouldArchive("polls", poll("active"), poll("active", { ben: ["s1"] }))).toBe(false);
    expect(
      shouldArchive("polls", poll("active", { ben: ["s1"] }), poll("active", { ben: [] })),
    ).toBe(false);
    expect(shouldArchive("polls", poll(undefined), poll(undefined, { ben: ["s1"] }))).toBe(false);
  });
});

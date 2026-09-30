import { describe, expect, it } from "vitest";
import { formatEndsAt, type PollDoc } from "@shared/poll";
import { PHASE_STEPS, giftPhase } from "./giftPhase";
import type { Gift, Suggestion } from "./types";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-09-30T12:00:00+02:00");
const NB = " ";

const gift = (extra: Partial<Gift> = {}): Gift => ({
  id: "g1",
  personId: "anna",
  year: 2026,
  status: "open",
  budgetPerPerson: 20,
  manuallyAdded: false,
  stackOrder: 0,
  enteredStackAt: 0,
  participantIds: ["ben", "christof", "lea"],
  ...extra,
});

const idea = (id: string, extra: Partial<Suggestion> = {}): Suggestion => ({
  id,
  giftId: "g1",
  title: `Idee ${id}`,
  suggestedBy: "ben",
  createdAt: Number(id.replace(/\D/g, "")) || 0,
  ...extra,
});

const ideas = [idea("s1", { title: "Plattenspieler", price: 129 }), idea("s2", { title: "Kochkurs", price: 60 }), idea("s3")];

const poll = (extra: Partial<PollDoc> = {}): PollDoc => ({
  status: "active",
  startedAt: NOW - HOUR,
  endsAt: NOW + 47 * HOUR,
  votes: {},
  ...extra,
});

describe("giftPhase – Ideen", () => {
  it("zählt nur Ideen dieses Geschenks", () => {
    const info = giftPhase(gift(), undefined, [...ideas, idea("x9", { giftId: "anderes" })], "ben", NOW);
    expect(info).toMatchObject({ phase: "ideas", step: 0, label: "💡 3 Ideen", ideaCount: 3, surprise: false });
    expect(info.badge).toBeUndefined();
  });

  it("Einzahl und leer", () => {
    expect(giftPhase(gift(), undefined, [ideas[0]], "ben", NOW).label).toBe("💡 1 Idee");
    expect(giftPhase(gift(), undefined, [], "ben", NOW).label).toBe("💡 Noch keine Ideen");
  });

  it("Legacy-Poll mit Status none zählt als keine Abstimmung", () => {
    expect(giftPhase(gift(), poll({ status: "none" }), ideas, "ben", NOW).phase).toBe("ideas");
  });
});

describe("giftPhase – Abstimmung", () => {
  it("zeigt x/y und Frist, Badge „Du fehlst“ für Wahlberechtigte ohne Stimme", () => {
    const p = poll({ votes: { ben: ["s1"] } });
    const info = giftPhase(gift(), p, ideas, "christof", NOW);
    expect(info).toMatchObject({ phase: "voting", step: 1, badge: "du-fehlst", endsAt: p.endsAt });
    expect(info.voters).toEqual({ voted: 1, total: 3, missing: ["christof", "lea"] });
    expect(info.label).toBe(`⏱ Abstimmung · 1/3 · ${formatEndsAt(p.endsAt!, NOW)}`);
  });

  it("kein Badge, wenn ich schon gewählt habe, nicht teilnehme oder keine Identität habe", () => {
    const p = poll({ votes: { ben: ["s1"] } });
    expect(giftPhase(gift(), p, ideas, "ben", NOW).badge).toBeUndefined();
    expect(giftPhase(gift(), p, ideas, "max", NOW).badge).toBeUndefined();
    expect(giftPhase(gift(), p, ideas, null, NOW).badge).toBeUndefined();
  });

  it("Stimmen für gelöschte Ideen zählen nicht als abgestimmt", () => {
    const info = giftPhase(gift(), poll({ votes: { ben: ["geloescht"] } }), ideas, "ben", NOW);
    expect(info.voters?.voted).toBe(0);
    expect(info.badge).toBe("du-fehlst");
  });

  it("ohne gültige Frist (Legacy) keine Zeitangabe", () => {
    const info = giftPhase(gift(), poll({ endsAt: undefined }), ideas, "ben", NOW);
    expect(info.label).toBe("⏱ Abstimmung · 0/3");
    expect(info.endsAt).toBeUndefined();
  });
});

describe("giftPhase – Auswertung", () => {
  it("abgelaufen mit Sieger → 🏆 Entscheidung offen", () => {
    const p = poll({ endsAt: NOW - 1, votes: { ben: ["s2"], christof: ["s2"], lea: ["s1"] } });
    const info = giftPhase(gift(), p, ideas, "ben", NOW);
    expect(info).toMatchObject({ phase: "result", step: 1, label: "🏆 Entscheidung offen" });
    expect(info.result).toEqual({ kind: "winner", id: "s2", votes: 2 });
    expect(info.badge).toBeUndefined();
  });

  it("geschlossen mit Gleichstand oder ohne Stimmen → ohne 🏆", () => {
    const tie = giftPhase(gift(), poll({ status: "closed", votes: { ben: ["s1"], lea: ["s2"] } }), ideas, "ben", NOW);
    expect(tie.label).toBe("⚖ Entscheidung offen");
    expect(tie.result).toEqual({ kind: "tie", ids: ["s1", "s2"], votes: 1 });
    const empty = giftPhase(gift(), poll({ status: "closed" }), ideas, "ben", NOW);
    expect(empty.label).toBe("⚖ Entscheidung offen");
    expect(empty.result).toEqual({ kind: "empty" });
  });
});

describe("giftPhase – entschieden und erhalten", () => {
  it("✓ Titel · Summe, Badge „Bezahlung offen“ solange ein Bezahler fehlt", () => {
    const info = giftPhase(gift({ status: "confirmed", selectedSuggestionIds: ["s1"] }), undefined, ideas, "ben", NOW);
    expect(info).toMatchObject({ phase: "decided", step: 2, label: `✓ Plattenspieler · 129${NB}€`, total: 129 });
    expect(info.badge).toBe("bezahlung-offen");
  });

  it("mehrere Ideen: erster Titel + Anzahl, Summe aller Preise; bezahlt → kein Badge", () => {
    const paid = ideas.map((s) => ({ ...s, paidBy: "ben" }));
    const info = giftPhase(gift({ status: "confirmed", selectedSuggestionIds: ["s2", "s1"] }), undefined, paid, "ben", NOW);
    expect(info.label).toBe(`✓ Kochkurs + 1 · 189${NB}€`);
    expect(info.badge).toBeUndefined();
  });

  it("ohne Auswahl bzw. ohne Preise", () => {
    expect(giftPhase(gift({ status: "confirmed" }), undefined, ideas, "ben", NOW).label).toBe("✓ Entschieden");
    const noPrice = giftPhase(gift({ status: "confirmed", selectedSuggestionIds: ["s3"] }), undefined, ideas, "ben", NOW);
    expect(noPrice.label).toBe("✓ Idee s3");
    expect(noPrice.total).toBeUndefined();
  });

  it("ausgewählte, aber gelöschte Ideen werden ignoriert", () => {
    const info = giftPhase(gift({ status: "confirmed", selectedSuggestionIds: ["weg"] }), undefined, ideas, "ben", NOW);
    expect(info.label).toBe("✓ Entschieden");
    expect(info.badge).toBeUndefined();
  });

  it("erhalten → Stufe 3, auch mit Zombie-Poll", () => {
    const info = giftPhase(gift({ status: "received", selectedSuggestionIds: ["s1"] }), poll(), ideas, "ben", NOW);
    expect(info).toMatchObject({ phase: "received", step: 3, label: `🎁 Plattenspieler · 129${NB}€` });
    expect(giftPhase(gift({ status: "received" }), undefined, ideas, "ben", NOW).label).toBe("🎁 Erhalten");
  });

  it("bestätigt schlägt eine noch laufende Abstimmung", () => {
    expect(giftPhase(gift({ status: "confirmed" }), poll(), ideas, "ben", NOW).phase).toBe("decided");
  });
});

describe("giftPhase – Spoiler-Schutz für die beschenkte Person", () => {
  it("während der Planung keinerlei Details", () => {
    for (const g of [gift(), gift({ status: "confirmed", selectedSuggestionIds: ["s1"] })]) {
      const info = giftPhase(g, poll({ votes: { ben: ["s1"] } }), ideas, "anna", NOW);
      expect(info).toEqual({ phase: "ideas", step: 0, label: "🤫 Überraschung läuft", surprise: true, ideaCount: 0 });
    }
  });

  it("nach der Übergabe nur die Titel, kein Preis, kein Badge", () => {
    const info = giftPhase(gift({ status: "received", selectedSuggestionIds: ["s1"] }), undefined, ideas, "anna", NOW);
    expect(info).toEqual({ phase: "received", step: 3, label: "🎁 Plattenspieler", surprise: true, ideaCount: 0 });
  });
});

describe("PHASE_STEPS", () => {
  it("vier Stufen in fester Reihenfolge", () => {
    expect(PHASE_STEPS).toEqual(["Ideen", "Abstimmung", "Entschieden", "Erhalten"]);
  });
});

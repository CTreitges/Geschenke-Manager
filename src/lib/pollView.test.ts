import { describe, expect, it } from "vitest";
import { formatEndsAt, type PollDoc } from "@shared/poll";
import {
  countdown,
  endedLine,
  endsTooLate,
  initialDecisionSelection,
  joinNames,
  resultHeadline,
  selectionSummary,
  sortIdeas,
  voteChangeToast,
  votersLine,
  voteShare,
} from "./pollView";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-09-30T12:00:00+02:00");
const NB = " "; // geschütztes Leerzeichen vor „€“ (Intl de-DE)

describe("countdown", () => {
  it("> 24 h: Endzeitpunkt statt Restzeit", () => {
    const end = NOW + 2 * DAY;
    expect(countdown(end, NOW)).toEqual({ text: formatEndsAt(end, NOW), urgent: false, over: false });
  });

  it("1–24 h: Restzeit, noch nicht dringend", () => {
    expect(countdown(NOW + 4 * HOUR + 12 * MIN, NOW)).toEqual({ text: "noch 4 Std 12 Min", urgent: false, over: false });
  });

  it("< 1 h: dringend", () => {
    expect(countdown(NOW + 38 * MIN, NOW)).toEqual({ text: "noch 38 Min", urgent: true, over: false });
  });

  it("genau am Ende: beendet", () => {
    expect(countdown(NOW, NOW)).toEqual({ text: "beendet", urgent: false, over: true });
  });
});

describe("votersLine / joinNames", () => {
  it("nennt die Fehlenden", () => {
    expect(votersLine(3, 4, ["Max"])).toBe("3 von 4 · Es fehlt: Max");
    expect(votersLine(1, 3, ["Max", "Lena"])).toBe("1 von 3 · Es fehlen: Max und Lena");
  });

  it("alle fertig oder niemand berechtigt", () => {
    expect(votersLine(4, 4, [])).toBe("4 von 4 · Alle haben abgestimmt 🎉");
    expect(votersLine(0, 0, [])).toBe("Noch niemand darf abstimmen");
  });

  it("kürzt lange Listen", () => {
    expect(joinNames(["A", "B", "C", "D", "E"])).toBe("A, B, C +2");
    expect(joinNames(["A", "B", "C"])).toBe("A, B und C");
    expect(joinNames([])).toBe("");
  });
});

describe("voteShare", () => {
  it("Anteil der Abstimmenden, nicht aller Stimmen (B19)", () => {
    expect(voteShare(3, 3)).toBe(1);
    expect(voteShare(1, 4)).toBe(0.25);
  });

  it("ohne Abstimmende 0", () => {
    expect(voteShare(0, 0)).toBe(0);
    expect(voteShare(2, 0)).toBe(0);
  });
});

describe("sortIdeas", () => {
  it("stabil nach createdAt, dann ID – unabhängig von der Eingabe", () => {
    const ideas = [
      { id: "c", createdAt: 2 },
      { id: "b", createdAt: 1 },
      { id: "a", createdAt: 2 },
    ];
    expect(sortIdeas(ideas).map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(sortIdeas([...ideas].reverse()).map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(ideas[0].id).toBe("c"); // Eingabe unverändert
  });
});

describe("initialDecisionSelection", () => {
  const ids = ["s1", "s2", "s3"];

  it("Sieger vorausgewählt, bestehende Auswahl bleibt (Vereinigung)", () => {
    expect(initialDecisionSelection({ kind: "winner", id: "s2", votes: 3 }, ["s1"], ids)).toEqual(["s1", "s2"]);
    expect(initialDecisionSelection({ kind: "winner", id: "s2", votes: 3 }, ["s2"], ids)).toEqual(["s2"]);
  });

  it("Gleichstand und leer: keine Vorauswahl", () => {
    expect(initialDecisionSelection({ kind: "tie", ids: ["s1", "s2"], votes: 2 }, [], ids)).toEqual([]);
    expect(initialDecisionSelection({ kind: "empty" }, ["s3"], ids)).toEqual(["s3"]);
    expect(initialDecisionSelection(null, [], ids)).toEqual([]);
  });

  it("gelöschte Ideen fallen aus der Auswahl", () => {
    expect(initialDecisionSelection({ kind: "empty" }, ["weg", "s1"], ids)).toEqual(["s1"]);
  });
});

describe("selectionSummary", () => {
  it("Summe und Anteil pro Person", () => {
    expect(selectionSummary([{ price: 129 }], 4)).toBe(`Auswahl: 1 · 129${NB}€ · 32,25${NB}€ pro Person`);
  });

  it("ohne Preise nur die Anzahl, ohne Teilnehmer ohne Anteil", () => {
    expect(selectionSummary([{}, {}], 4)).toBe("Auswahl: 2");
    expect(selectionSummary([{ price: 10 }, {}], 0)).toBe(`Auswahl: 2 · 10${NB}€`);
    expect(selectionSummary([], 4)).toBe("Noch nichts ausgewählt");
  });
});

describe("resultHeadline", () => {
  const title = (id: string) => ({ s1: "Kochkurs", s2: "Buch", s3: "Plattenspieler" })[id] ?? "?";

  it("🏆 nur bei echtem Sieger (B6)", () => {
    expect(resultHeadline({ kind: "winner", id: "s3", votes: 3 }, title)).toBe("🏆 Plattenspieler");
    expect(resultHeadline({ kind: "empty" }, title)).toBe("Niemand hat abgestimmt.");
    expect(resultHeadline({ kind: "empty" }, title)).not.toContain("🏆");
  });

  it("Gleichstand nennt alle Spitzenreiter", () => {
    expect(resultHeadline({ kind: "tie", ids: ["s1", "s2"], votes: 2 }, title)).toBe(
      "⚖ Gleichstand: Kochkurs & Buch (je 2)",
    );
    expect(resultHeadline({ kind: "tie", ids: ["s1", "s2", "s3"], votes: 1 }, title)).toBe(
      "⚖ Gleichstand: Kochkurs, Buch & Plattenspieler (je 1)",
    );
  });
});

describe("endedLine", () => {
  const base: PollDoc = { status: "active", startedAt: NOW - 2 * DAY, endsAt: NOW - HOUR, votes: {} };
  const name = (id: string) => ({ ben: "Ben" })[id];

  it("abgelaufen, aber noch nicht geschlossen", () => {
    expect(endedLine(base, NOW, name)).toBe(`${formatEndsAt(NOW - HOUR, NOW)} (Zeit abgelaufen)`);
  });

  it("vom Timer geschlossen", () => {
    const p: PollDoc = { ...base, status: "closed", closedAt: NOW - HOUR, closedReason: "timeout" };
    expect(endedLine(p, NOW, name)).toBe(`${formatEndsAt(NOW - HOUR, NOW)} (Zeit abgelaufen)`);
  });

  it("von Hand beendet nennt die Person", () => {
    const p: PollDoc = { ...base, endsAt: NOW + DAY, status: "closed", closedAt: NOW - MIN, closedBy: "ben", closedReason: "manual" };
    expect(endedLine(p, NOW, name)).toBe(`${formatEndsAt(NOW - MIN, NOW)} von Ben`);
  });

  it("Alt-Doc ohne Zeiten", () => {
    expect(endedLine({ status: "closed", votes: {} }, NOW, name)).toBe("beendet");
  });
});

describe("voteChangeToast", () => {
  it("nur bei Änderung", () => {
    expect(voteChangeToast(["s1", "s2"], ["s2", "s1"])).toBeNull();
    expect(voteChangeToast([], [])).toBeNull();
    expect(voteChangeToast([], ["s1"])).toBe("Gespeichert · 1 gewählt");
    expect(voteChangeToast(["s1"], ["s1", "s2"])).toBe("Gespeichert · 2 gewählt");
    expect(voteChangeToast(["s1"], [])).toBe("Stimmen zurückgenommen");
  });
});

describe("endsTooLate", () => {
  const occasion = new Date(NOW + 10 * DAY);

  it("warnt, wenn weniger als 3 Tage bis zum Anlass bleiben", () => {
    expect(endsTooLate(NOW + 8 * DAY, occasion, NOW)).toBe(true);
    expect(endsTooLate(NOW + 11 * DAY, occasion, NOW)).toBe(true);
    expect(endsTooLate(NOW + 2 * DAY, occasion, NOW)).toBe(false);
  });

  it("kein Hinweis ohne Datum oder für vergangene Anlässe", () => {
    expect(endsTooLate(NOW + DAY, null, NOW)).toBe(false);
    expect(endsTooLate(NOW + DAY, new Date(NOW - 5 * DAY), NOW)).toBe(false);
  });
});

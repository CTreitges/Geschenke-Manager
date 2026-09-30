import { describe, expect, it } from "vitest";
import { FAQ } from "./faq";

/** Sätze grob an Satzzeichen am Wortende zählen. */
const sentences = (text: string) => text.split(/[.!?](?=\s|$)/).filter((s) => s.trim().length > 0).length;

describe("FAQ", () => {
  it("hat eindeutige IDs und nicht-leere Fragen/Antworten", () => {
    const ids = FAQ.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FAQ) {
      expect(f.question.trim().endsWith("?"), f.id).toBe(true);
      expect(f.answer.trim().length, f.id).toBeGreaterThan(20);
    }
  });

  it("jede Antwort hat höchstens 3 Sätze", () => {
    for (const f of FAQ) expect(sentences(f.answer), f.id).toBeLessThanOrEqual(3);
  });

  it("deckt die Pflichtthemen ab (Spoiler-Schutz, sichtbare Stimmen, Trust)", () => {
    const byId = Object.fromEntries(FAQ.map((f) => [f.id, f]));
    expect(byId["wer-bin-ich"].answer).toMatch(/Spoiler-Schutz/);
    expect(byId["stimmen-sichtbar"].answer).toMatch(/^Ja, bewusst/);
    expect(byId["keine-admins"].answer).toMatch(/Vertrauen/);
    expect(byId["mail-erinnerungen"].answer).toMatch(/Kein Spam/);
  });

  it("Satzzähler erkennt Grenzfälle", () => {
    expect(sentences("Eins. Zwei! Drei?")).toBe(3);
    expect(sentences("Preis 12.50 € bleibt ein Satz.")).toBe(1);
  });
});

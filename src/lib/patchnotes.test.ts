import { describe, expect, it } from "vitest";
import { CURRENT_DATE, CURRENT_VERSION, PATCH_NOTES, formatPatchDate } from "./patchnotes";

describe("Patchnotes", () => {
  it("aktuelle Version ist v1.8.0 vom 30. September 2026", () => {
    expect(CURRENT_VERSION).toBe("v1.8.0");
    expect(formatPatchDate(CURRENT_DATE)).toBe("30. September 2026");
  });

  it("neueste zuerst, Versionen eindeutig", () => {
    const versions = PATCH_NOTES.map((n) => n.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (let i = 1; i < PATCH_NOTES.length; i++) {
      expect(PATCH_NOTES[i - 1].date >= PATCH_NOTES[i].date, PATCH_NOTES[i].version).toBe(true);
    }
  });

  it("Aktionen verlinken app-intern", () => {
    for (const n of PATCH_NOTES) {
      if (n.action) expect(n.action.to.startsWith("/"), n.version).toBe(true);
    }
    expect(PATCH_NOTES[0].action?.to).toBe("/tutorial");
  });

  it("Push-Schalter steht unter „Mitteilungen“, nicht „Konto“ (B41)", () => {
    const push = PATCH_NOTES.flatMap((n) => n.highlights).filter((h) => /Push/.test(h) && /Einstellungen →/.test(h));
    expect(push.length).toBeGreaterThan(0);
    for (const h of push) expect(h).toMatch(/Einstellungen → Mitteilungen/);
  });

  it("formatPatchDate: leer und ungültig bleiben robust", () => {
    expect(formatPatchDate("")).toBe("");
    expect(formatPatchDate("kaputt")).toBe("kaputt");
  });
});

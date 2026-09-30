import { describe, expect, it } from "vitest";
import { scanSource } from "../e2e/check-design.mjs";

const rules = (src: string) => scanSource(src).map((h) => `${h.rule}@${h.line}${h.reason ? " ok" : ""}`);

describe("check-design scanSource", () => {
  it("meldet Hex-Farben und arbiträre Schriftgrößen mit Zeile", () => {
    expect(rules('const a = 1;\n<div className="text-[13px]" style={{ color: "#7C3AED" }} />')).toEqual([
      "hex@2",
      "text-px@2",
    ]);
  });

  it("meldet natives confirm()/alert(), aber nicht useConfirm mit Objekt", () => {
    expect(rules('if (!confirm("Löschen?")) return;')).toEqual(["confirm@1"]);
    expect(rules("window.confirm(msg);\nalert(`x`);")).toEqual(["confirm@1", "confirm@2"]);
    expect(rules("const ok = await confirm({ title: 'x' });\ntoast.confirmed();")).toEqual([]);
  });

  it("meldet <div onClick>, auch über mehrere Zeilen", () => {
    expect(rules('<div\n  className="x"\n  onClick={go}\n>')).toEqual(["div-onclick@1"]);
    expect(rules("<button onClick={go} />\n<span onClick={go} />")).toEqual([]);
  });

  it("überspringt Kommentarzeilen und markiert design-ok als begründet", () => {
    expect(rules("// früher: #EDE9FE\n * window.confirm()")).toEqual([]);
    expect(rules('red: "#EA4335", // design-ok: Google-Markenfarbe')).toEqual(["hex@1 ok"]);
    expect(scanSource('{/* design-ok: Backdrop */}\n<div aria-hidden onClick={close} />')[0].reason).toBe("Backdrop");
  });

  it("ignoriert kurze Hex-Werte und Klassen ohne px", () => {
    expect(rules('color: "#fff"; className="text-meta text-[length:inherit]"')).toEqual([]);
  });
});

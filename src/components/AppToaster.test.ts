import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toasterPlacement } from "./AppToaster";

// Regressionstest (Quelltext, wie pwa-meta.test.ts): sonner rendert ohne
// Toasts kein prüfbares Markup, deshalb werden die Props direkt geprüft.
const toaster = readFileSync(new URL("./AppToaster.tsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");

describe("AppToaster", () => {
  it("sitzt normal unten mittig über der Tab-Bar, 2,6 s, ohne richColors", () => {
    expect(toaster).toContain('position={top ? "top-center" : "bottom-center"}');
    expect(toaster).toContain("duration={2600}");
    expect(toaster).toMatch(/offset=\{top \? TOP : BOTTOM\}/);
    expect(toaster).toMatch(/mobileOffset=\{top \? TOP : BOTTOM\}/); // < 600 px gilt nur mobileOffset
    expect(toaster).toMatch(/bottom: "calc\(\d+px \+ env\(safe-area-inset-bottom\)\)"/);
    expect(toaster).toMatch(/top: "calc\(\d+px \+ env\(safe-area-inset-top\)\)"/);
    const jsx = /<Toaster\b[\s\S]*?\/>/.exec(toaster)?.[0] ?? "";
    expect(jsx).not.toContain("richColors");
  });

  it("folgt der .dark-Klasse statt eines festen Themes", () => {
    expect(toaster).toContain('theme={dark ? "dark" : "light"}');
    expect(toaster).toContain("MutationObserver");
  });

  it("ist zusammen mit dem ConfirmProvider in main.tsx eingehängt", () => {
    expect(main).toContain("<AppToaster />");
    expect(main).toContain("<ConfirmProvider>");
    expect(main).not.toMatch(/<Toaster\b/);
  });
});

describe("toasterPlacement", () => {
  it("rückt nach oben, solange ein Sheet offen ist – dort lägen sonst Knöpfe darunter", () => {
    expect(toasterPlacement(1, "/")).toBe("top");
    expect(toasterPlacement(2, "/gift/anna_2026")).toBe("top");
  });

  it("rückt im Tutorial nach oben (Weiter/Überspringen unten)", () => {
    expect(toasterPlacement(0, "/tutorial")).toBe("top");
  });

  it("bleibt sonst unten über der Tab-Bar", () => {
    expect(toasterPlacement(0, "/")).toBe("bottom");
    expect(toasterPlacement(0, "/settings")).toBe("bottom");
    expect(toasterPlacement(0, "/tutorials")).toBe("bottom");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regressionstest (Quelltext, wie pwa-meta.test.ts): sonner rendert ohne
// Toasts kein prüfbares Markup, deshalb werden die Props direkt geprüft.
const toaster = readFileSync(new URL("./AppToaster.tsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");

describe("AppToaster", () => {
  it("sitzt unten mittig über der Tab-Bar, 2,6 s, ohne richColors", () => {
    expect(toaster).toContain('position="bottom-center"');
    expect(toaster).toContain("duration={2600}");
    expect(toaster).toMatch(/offset=\{OFFSET\}/);
    expect(toaster).toMatch(/mobileOffset=\{OFFSET\}/); // < 600 px gilt nur mobileOffset
    expect(toaster).toMatch(/bottom: "calc\(\d+px \+ env\(safe-area-inset-bottom\)\)"/);
    const jsx = /<Toaster\b[\s\S]*?\/>/.exec(toaster)?.[0] ?? "";
    expect(jsx).toContain("position=");
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

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, type Rgb } from "@/lib/colors";

// Regressionstest: Kontrast der Design-Tokens in src/index.css (WCAG 1.4.3/1.4.11).
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

function tokens(selector: string): Record<string, Rgb> {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  if (!block) throw new Error(`Block ${selector} fehlt in index.css`);
  const out: Record<string, Rgb> = {};
  for (const m of block.matchAll(/--gm-([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
}

const themes = { hell: tokens(":root"), dunkel: tokens(".dark") };

describe.each(Object.entries(themes))("Design-Tokens %s", (_name, t) => {
  it("definiert alle Farb-Tokens als RGB-Kanäle", () => {
    for (const key of [
      "canvas", "surface", "surface-2", "line", "line-subtle", "line-control",
      "fg", "fg-soft", "fg-muted", "accent", "accent-text", "accent-soft",
      "danger", "danger-soft", "glow",
      "status-open", "status-open-soft", "status-vote", "status-vote-soft",
      "status-done", "status-done-soft", "status-received", "status-received-soft",
    ]) {
      expect(t[key], key).toBeDefined();
    }
  });

  it("fg-muted erreicht ≥ 4,5:1 auf surface, canvas und surface-2", () => {
    expect(contrastRatio(t["fg-muted"], t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["fg-muted"], t.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["fg-muted"], t["surface-2"])).toBeGreaterThanOrEqual(4.5);
  });

  it("Text-Tokens erreichen ≥ 4,5:1 auf ihrem Hintergrund", () => {
    expect(contrastRatio(t.fg, t.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["fg-soft"], t["surface-2"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["accent-text"], t.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.danger, t["danger-soft"])).toBeGreaterThanOrEqual(4.5);
    for (const s of ["open", "vote", "done", "received"]) {
      expect(contrastRatio(t[`status-${s}`], t[`status-${s}-soft`]), s).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("Control-Ränder erreichen ≥ 3:1 (Nicht-Text-Kontrast)", () => {
    expect(contrastRatio(t["line-control"], t.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t["line-control"], t.canvas)).toBeGreaterThanOrEqual(3);
  });
});

describe("Globale a11y-Regeln in index.css", () => {
  it("hat einen sichtbaren :focus-visible-Ring in Akzentfarbe", () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid rgb\(var\(--gm-accent\)\)/);
  });

  it("schaltet Animationen bei prefers-reduced-motion ab", () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
    expect(block).toMatch(/animation-duration:\s*0\.01ms !important/);
    expect(block).toMatch(/animation-iteration-count:\s*1 !important/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms !important/);
  });

  it("blendet Scrollbars nur bei pointer: coarse aus", () => {
    const hidden = [...css.matchAll(/::-webkit-scrollbar\s*\{\s*width:\s*0/g)];
    expect(hidden).toHaveLength(1);
    const before = css.slice(0, hidden[0].index);
    expect(before.lastIndexOf("@media (pointer: coarse)")).toBeGreaterThan(before.lastIndexOf("}"));
  });
});

describe("Design-Tokens: Alias", () => {
  it("--gm-bg bleibt als Alias auf canvas erhalten", () => {
    expect(css).toMatch(/--gm-bg:\s*rgb\(var\(--gm-canvas\)\)/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regressionstests für index.html + PWA-Manifest (vite.config.ts).
const root = new URL("../", import.meta.url);
const indexHtml = readFileSync(new URL("index.html", root), "utf8");
const viteConfig = readFileSync(new URL("vite.config.ts", root), "utf8");

describe("index.html / PWA-Manifest", () => {
  it("erlaubt Pinch-Zoom (kein user-scalable=no, kein maximum-scale)", () => {
    const viewport = indexHtml.match(/<meta\s+name="viewport"\s+content="([^"]*)"/)?.[1];
    expect(viewport).toContain("width=device-width");
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });

  it("nutzt Violett als theme-color, identisch in index.html und Manifest", () => {
    const meta = indexHtml.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/)?.[1];
    const manifest = viteConfig.match(/theme_color:\s*"([^"]+)"/)?.[1];
    expect(meta).toBe("#6D28D9");
    expect(manifest).toBe(meta);
  });
});

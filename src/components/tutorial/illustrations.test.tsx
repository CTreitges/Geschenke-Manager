import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IllDefs } from "./primitives";
import { tutorialPages } from "./pages";

// Statisches Rendern (Vitest läuft in "node"): prüft die Regeln des
// Illustrations-Systems (dim-tutorial §3.3).
const pages = tutorialPages({ showInstall: true, hasIdentity: false });

describe.each(pages.map((p) => [p.id, p] as const))("Illustration %s", (_id, page) => {
  const html = renderToStaticMarkup(<page.Ill alt={page.alt} />);

  it("ist ein beschriftetes Bild mit viewBox 320×240", () => {
    expect(html).toMatch(/^<svg viewBox="0 0 320 240" role="img"/);
    expect(html).toContain(`aria-label="${page.alt}"`);
  });

  it("nutzt Farben nur über --ill-*-Tokens bzw. den gemeinsamen Verlauf", () => {
    const colors = [...html.matchAll(/(?:fill|stroke|stop-color)="([^"]+)"/g)].map((m) => m[1]);
    expect(colors.length).toBeGreaterThan(0);
    for (const c of colors) {
      expect(c, c).toMatch(/^(none|url\(#gm-ill-grad\)|var\(--ill-[a-z0-9-]+\))$/);
    }
  });

  it("enthält keinen Text außer Initialen", () => {
    const texts = [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    for (const t of texts) expect(t, t).toMatch(/^[A-Z]{0,2}$/);
  });

  it("definiert keine eigenen IDs (Verlauf liegt einmal im Pager)", () => {
    expect(html).not.toMatch(/\sid="/);
  });
});

describe("IllDefs", () => {
  it("definiert gm-ill-grad einmal, unsichtbar aber nicht display:none", () => {
    const html = renderToStaticMarkup(<IllDefs />);
    expect(html.match(/id="gm-ill-grad"/g)).toHaveLength(1);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/display:\s*none/);
    expect(html).not.toMatch(/class="(?:[^"]*\s)?hidden[\s"]/); // Tailwind „hidden“ = display:none
    expect(html).toContain('stop-color="var(--ill-grad-from)"');
  });

  it("definiert die Auslauf-Maske der Handys einmal; Illustrationen verweisen nur darauf", () => {
    const html = renderToStaticMarkup(<IllDefs />);
    expect(html.match(/id="gm-ill-fade"/g)).toHaveLength(1);
    for (const p of pages) {
      const masks = [...renderToStaticMarkup(<p.Ill alt={p.alt} />).matchAll(/mask="([^"]+)"/g)].map((m) => m[1]);
      for (const m of masks) expect(m, p.id).toBe("url(#gm-ill-fade)");
    }
  });
});

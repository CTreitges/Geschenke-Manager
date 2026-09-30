import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HelpEntries } from "./HelpMenu";

const noop = () => {};
const titles = (html: string) => [...html.matchAll(/<button[^>]*>.*?<\/button>/g)].map((m) => m[0].replace(/<[^>]+>/g, ""));

describe("HelpEntries", () => {
  it("feste Reihenfolge: Tutorial zuerst, dann Was ist neu, Fragen, Feedback", () => {
    const list = titles(renderToStaticMarkup(<HelpEntries go={noop} />));
    expect(list).toHaveLength(4);
    expect(list[0]).toMatch(/^Tutorial ansehen5 kurze Seiten · ca\. 1 Minute$/);
    expect(list[1]).toMatch(/^Was ist neu/);
    expect(list[1]).toMatch(/v1\.8\.0 · 30\. September 2026/);
    expect(list[2]).toMatch(/^Häufige Fragen/);
    expect(list[3]).toMatch(/^Feedback geben/);
  });

  it("App installieren nur mit Handler, und dann als letzter Eintrag", () => {
    const list = titles(renderToStaticMarkup(<HelpEntries go={noop} onInstall={noop} />));
    expect(list).toHaveLength(5);
    expect(list[4]).toMatch(/^App installieren/);
  });

  it("Tutorial-Eintrag ist visuell primär (Verlaufs-Kachel)", () => {
    const html = renderToStaticMarkup(<HelpEntries go={noop} />);
    const first = html.match(/<button[^>]*>.*?<\/button>/)![0];
    expect(first).toContain("bg-grad-primary");
    expect(first).toContain("bg-accent-soft");
  });

  it("zeigt „neu“ bei ungesehener Version (ohne Storage: ungesehen)", () => {
    const list = titles(renderToStaticMarkup(<HelpEntries go={noop} />));
    expect(list[1]).toMatch(/^Was ist neuneu/);
  });
});

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { GROUP_ID, getDb, seed, setDarkMode } from "../emu-seed.mjs";
import { THEMES, runScenes } from "../emu-scenes.mjs";
import { formatA11y, loginAs, seriousA11yViolations } from "./helpers";

// axe über alle Screens des Screenshot-Satzes (e2e/emu-scenes.mjs), hell und
// dunkel: keine Verstöße der Stufe serious/critical. Mit AXE_REPORT_DIR wird
// das Protokoll zusätzlich als axe-<theme>.txt dorthin geschrieben.

const HOUR = 3_600_000;

function report(name: string, body: string) {
  const dir = process.env.AXE_REPORT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), body + "\n", "utf8");
}

// Szenen ändern Daten (Abstimmungen, Wünsche) → frischer Stand für die nächste Datei.
test.afterAll(async () => {
  await seed();
});

for (const theme of THEMES) {
  test(`axe: alle Screens ohne serious/critical (${theme.suffix})`, async ({ browser }, testInfo) => {
    test.setTimeout(900_000);
    const lines: string[] = [];
    const failing: string[] = [];
    await runScenes({
      browser,
      baseURL: testInfo.project.use.baseURL,
      theme,
      snap: async ({ page, id }: { page: Page; id: string }) => {
        const violations = await seriousA11yViolations(page);
        lines.push(formatA11y(id, violations));
        if (violations.length) failing.push(id);
      },
    });
    const log = lines.join("\n");
    console.log(log);
    await testInfo.attach(`axe-${theme.suffix}.txt`, { body: log, contentType: "text/plain" });
    report(`axe-${theme.suffix}.txt`, log);
    expect(lines.length).toBeGreaterThan(40);
    expect(failing).toEqual([]);
  });
}

/** WCAG-Kontrast zweier CSS-Farben „rgb(a)(…)“; Alpha des Vordergrunds wird eingerechnet. */
function contrast(fg: string, bg: string): number {
  const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const [br, bgG, bb] = parse(bg);
  const [fr, fgG, fb, fa = 1] = parse(fg);
  const mix = [fr * fa + br * (1 - fa), fgG * fa + bgG * (1 - fa), fb * fa + bb * (1 - fa)];
  const lum = ([r, g, b]: number[]) => {
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [l1, l2] = [lum(mix), lum([br, bgG, bb])].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Vorher meldete axe in voting.spec „Geschenk entschieden“ einen Kontrastfehler
// am sonner-Toast: gemessen während der Einblend-Animation (opacity 0 → 1).
// Hier der echte Kontrast nach dem Einblenden, hell und dunkel.
test("Toast „Entschieden ✓“ hat nach dem Einblenden vollen Kontrast", async ({ page }) => {
  const results: string[] = [];
  for (const dark of [false, true]) {
    const { giftIds } = await seed();
    await setDarkMode(dark);
    const now = Date.now();
    await getDb()
      .doc(`groups/${GROUP_ID}/polls/${giftIds.christof}`)
      .set({
        giftId: giftIds.christof,
        status: "closed",
        startedAt: now - 30 * HOUR,
        startedBy: "anna",
        endsAt: now - HOUR,
        closedAt: now - HOUR,
        closedReason: "timeout",
        votes: { anna: ["s-christof-1"], ben: ["s-christof-1"] },
      });
    // Seed hat die Mitglieder gelöscht → neu anmelden.
    await loginAs(page, "Ben");
    await page.goto(`/gift/${giftIds.christof}?vote=1`);
    await expect(page.locator("html")).toHaveClass(dark ? /dark/ : /^(?!.*dark)/);
    const result = page.getByRole("dialog", { name: "Ergebnis · für Christof" });
    await result.getByRole("button", { name: "Entscheidung festlegen" }).click();

    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Entschieden ✓" });
    await expect(toast).toHaveAttribute("data-mounted", "true");
    expect(await seriousA11yViolations(page, "[data-sonner-toast]")).toEqual([]);
    const colors = await toast.evaluate((el) => {
      const title = el.querySelector("[data-title]") ?? el;
      return {
        fg: getComputedStyle(title).color,
        bg: getComputedStyle(el).backgroundColor,
        opacity: getComputedStyle(el).opacity,
      };
    });
    const ratio = contrast(colors.fg, colors.bg);
    results.push(`${dark ? "dunkel" : "hell"}: ${colors.fg} auf ${colors.bg}, opacity ${colors.opacity} → ${ratio.toFixed(1)}:1`);
    expect(colors.opacity).toBe("1");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
  console.log(`[axe] Toast-Kontrast nach dem Einblenden\n  ${results.join("\n  ")}`);
  report("axe-toast.txt", results.join("\n"));
});

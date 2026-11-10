import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { GROUP_ID, GROUP_PASSWORD } from "../emu-seed.mjs";
import { settle } from "../emu-session.mjs";
import { ONBOARDING_KEYS, TUTORIAL_VERSION, dayStamp } from "../../src/lib/onboarding";

// Onboarding unterdrücken (Tutorial gesehen, Identität gefragt, Install-Tipp
// erledigt). Keys direkt aus src/lib/onboarding.ts, damit nichts auseinanderläuft.
export const SUPPRESS_KEYS: Record<string, string> = {
  [ONBOARDING_KEYS.tutorial]: TUTORIAL_VERSION,
  // „Später“ gilt nur für heute (Tagesstempel), danach fragt die App wieder.
  [ONBOARDING_KEYS.identityAsked]: dayStamp(),
  [ONBOARDING_KEYS.installTip]: "yes",
};

/** Person-ID in der Demo-Gruppe (e2e/emu-seed.mjs): Name in Kleinbuchstaben. */
export const personId = (personName: string) => personName.toLowerCase();

/**
 * Meldet sich über die UI in der Demo-Gruppe an (joinGroup-Function im
 * Emulator) und setzt vorher per localStorage die „Wer bin ich?"-Identität
 * sowie die Onboarding-Keys — für jede Seite dieses Browser-Kontexts.
 * `keys: {}` lässt das Onboarding zu (First-Run-Tests), `null` als Name
 * meldet ohne Identität an.
 */
export async function loginAs(
  page: Page,
  personName: string | null,
  { keys = SUPPRESS_KEYS }: { keys?: Record<string, string> } = {},
): Promise<void> {
  await page.context().addInitScript(
    ({ keys, identityKey, identity }) => {
      for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
      if (identity) localStorage.setItem(identityKey, identity);
    },
    {
      keys,
      identityKey: `gm:identity:v1:${GROUP_ID}`,
      identity: personName ? personId(personName) : null,
    },
  );
  await page.goto("/login");
  await page.getByPlaceholder("Gruppen-ID").fill(GROUP_ID);
  await page.getByPlaceholder("Passwort").fill(GROUP_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await page.getByText("Lade Gruppendaten…").waitFor({ state: "detached", timeout: 30_000 });
}

export interface A11yViolation {
  id: string;
  impact: string;
  help: string;
  nodes: number;
  targets: string[];
}

// @axe-core/playwright ist gegen das hochgezogene playwright-core typisiert,
// @playwright/test bringt eine eigene Version mit – zur Laufzeit dieselbe Page.
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

/**
 * axe-Scan der aktuellen Seite; liefert nur Verstöße der Stufe serious/critical.
 * Wartet vorher, bis Einblend-Animationen (Sheets, Toasts) durch sind: mitten
 * in der Opacity-Animation misst axe sonst den halb transparenten Zwischenstand
 * als Kontrastfehler.
 */
export async function seriousA11yViolations(page: Page, include?: string): Promise<A11yViolation[]> {
  await settle(page);
  const builder = new AxeBuilder({ page: page as unknown as AxePage });
  if (include) builder.include(include);
  const { violations } = await builder.analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id,
      impact: v.impact ?? "",
      help: v.help,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
}

/** Kompakte, zeilenweise Darstellung für Log und Baseline. */
export function formatA11y(label: string, violations: A11yViolation[]): string {
  if (violations.length === 0) return `[axe] ${label}: keine serious/critical-Verstöße`;
  return [
    `[axe] ${label}: ${violations.length} serious/critical-Verstöße`,
    ...violations.map(
      (v) => `  ${v.impact.padEnd(8)} ${v.id} (${v.nodes}×) — ${v.help} — z. B. ${v.targets.join(" | ")}`,
    ),
  ].join("\n");
}

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { GROUP_ID, GROUP_PASSWORD } from "../emu-seed.mjs";

// Tutorial + Tipp-Dialoge unterdrücken (Keys aus App.tsx,
// PwaInstallTipDialog.tsx, TestMailTipDialog.tsx). Beim neuen Tutorial-Key
// (src/lib/onboarding.ts) hier nachziehen.
export const SUPPRESS_KEYS: Record<string, string> = {
  "gm:tutorial-seen:v5": "yes",
  "gm:pwa-install-tip-seen:v1": "yes",
  "gm:test-mail-tip-seen:v1": "yes",
};

/** Person-ID in der Demo-Gruppe (e2e/emu-seed.mjs): Name in Kleinbuchstaben. */
export const personId = (personName: string) => personName.toLowerCase();

/**
 * Meldet sich über die UI in der Demo-Gruppe an (joinGroup-Function im
 * Emulator) und setzt vorher per localStorage die „Wer bin ich?"-Identität
 * sowie die Tutorial-/Tipp-Keys — für jede Seite dieses Browser-Kontexts.
 */
export async function loginAs(page: Page, personName: string): Promise<void> {
  await page.context().addInitScript(
    ({ keys, identityKey, identity }) => {
      for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
      localStorage.setItem(identityKey, identity);
    },
    {
      keys: SUPPRESS_KEYS,
      identityKey: `gm:identity:v1:${GROUP_ID}`,
      identity: personId(personName),
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

/** axe-Scan der aktuellen Seite; liefert nur Verstöße der Stufe serious/critical. */
export async function seriousA11yViolations(page: Page): Promise<A11yViolation[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();
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

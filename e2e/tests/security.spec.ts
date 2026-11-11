import { expect, test } from "@playwright/test";
import { GROUP_ID, GROUP_PASSWORD, getDb } from "../emu-seed.mjs";
import { currentUid } from "../emu-session.mjs";
import { loginAs } from "./helpers";
import { JOIN_MAX_ATTEMPTS_PER_UID } from "../../functions/src/rateLimit";

// Security Tier 2 (TS-GM) im Emulator: echte joinGroup-Function, echte
// Rules, echte App.

test("Beitritt mit falschem Passwort bis zur Sperre – danach hilft auch das richtige nicht", async ({ page }) => {
  await page.goto("/login");
  const tryJoin = async (pw: string) => {
    await page.getByPlaceholder("Gruppen-ID").fill(GROUP_ID);
    await page.getByPlaceholder("Passwort").fill(pw);
    await page.locator('form button[type="submit"]').click();
  };
  for (let i = 1; i <= JOIN_MAX_ATTEMPTS_PER_UID; i++) {
    await tryJoin(`falsch-${i}`);
    await expect(page.getByText("Falsches Passwort").last()).toBeVisible();
    console.log(`Versuch ${i}: Falsches Passwort`);
    // Toast abwarten, damit der nächste nicht mit dem alten verwechselt wird.
    await expect(page.getByText("Falsches Passwort")).toHaveCount(0, { timeout: 15_000 });
  }
  await tryJoin(GROUP_PASSWORD);
  await expect(page.getByText("Zu viele Versuche – bitte in 15 Minuten erneut probieren")).toBeVisible();
  console.log(`Versuch ${JOIN_MAX_ATTEMPTS_PER_UID + 1} (richtiges Passwort): Zu viele Versuche`);
  await expect(page).toHaveURL(/\/login$/);

  const uid = await currentUid(page);
  const counter = await getDb().doc(`_rateLimits/join_uid_${uid}`).get();
  expect(counter.data()?.count).toBe(JOIN_MAX_ATTEMPTS_PER_UID);
  console.log(`Zähler _rateLimits/join_uid_<uid>: count=${counter.data()?.count}`);
  expect((await getDb().doc(`groups/${GROUP_ID}/members/${uid}`).get()).exists).toBe(false);
});

test("anderer Nutzer tritt trotz gesperrtem Angreifer normal bei", async ({ page }) => {
  await loginAs(page, null);
  await expect(page).not.toHaveURL(/\/login/);
});

test("Zugangsverlust: aus der Gruppe entfernt → Login mit Hinweis", async ({ page }) => {
  await loginAs(page, null);
  const uid = await currentUid(page);
  await getDb().doc(`groups/${GROUP_ID}/members/${uid}`).delete();
  // Neu öffnen: Die Subscriptions bekommen jetzt permission-denied.
  await page.reload();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
  await expect(page.getByRole("status").filter({ hasText: "Kein Zugriff mehr auf diese Gruppe" })).toBeVisible();
  console.log("Nach Entfernen + Reload: /login mit Hinweis „Kein Zugriff mehr auf diese Gruppe“");
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ prefsLoaded: false }));

vi.mock("@/lib/messaging", () => ({
  enablePushForGroup: vi.fn(),
  sendTestPush: vi.fn(),
  setPushPrefs: vi.fn(),
  usePushState: () => ({ state: "on", prefs: { stack: false, polls: false }, prefsLoaded: h.prefsLoaded }),
}));

const { NotificationsBlock } = await import("./NotificationsBlock");

const switches = () => renderToStaticMarkup(<NotificationsBlock groupId="g1" />).match(/<button[^>]*role="switch"[^>]*>/g) ?? [];

describe("NotificationsBlock (R6)", () => {
  it("sperrt die Schalter bis zum ersten Member-Snapshot", () => {
    h.prefsLoaded = false;
    expect(switches()).toHaveLength(2);
    for (const s of switches()) expect(s).toMatch(/\sdisabled=""/);
  });

  it("gibt sie danach frei", () => {
    h.prefsLoaded = true;
    for (const s of switches()) expect(s).not.toMatch(/\sdisabled=""/);
  });
});

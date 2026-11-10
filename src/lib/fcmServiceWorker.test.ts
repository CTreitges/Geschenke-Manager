// Tests für public/firebase-messaging-sw.js: Das Skript wird in einem
// vm-Kontext mit nachgebautem `self` ausgewertet — wie ein frisch gestarteter
// Service Worker (Regression B1: Listener müssen beim ersten Auswerten da sein).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const SW_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/firebase-messaging-sw.js");

type Listener = (event: Record<string, unknown>) => void;

interface FakeWindow {
  url: string;
  focused: boolean;
  messages: unknown[];
  focusCalls: number;
  focus: () => Promise<void>;
  postMessage: (m: unknown) => void;
}

function fakeWindow(url: string, focused = false): FakeWindow {
  const w: FakeWindow = {
    url,
    focused,
    messages: [],
    focusCalls: 0,
    focus: async () => {
      w.focusCalls++;
    },
    postMessage: (m) => w.messages.push(m),
  };
  return w;
}

function loadWorker(opts: { windows?: FakeWindow[]; failRichNotification?: boolean } = {}) {
  const listeners = new Map<string, Listener>();
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const matchAllArgs: unknown[] = [];
  const windows = opts.windows ?? [];
  const self = {
    location: { origin: "https://app.example" },
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
    skipWaiting: () => undefined,
    clients: {
      claim: async () => undefined,
      matchAll: async (arg: unknown) => {
        matchAllArgs.push(arg);
        return windows;
      },
      openWindow: async (url: string) => {
        opened.push(url);
      },
    },
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => {
        if (opts.failRichNotification && "tag" in options) throw new Error("zu viele Optionen");
        shown.push({ title, options });
      },
    },
  };
  const code = readFileSync(SW_FILE, "utf8");
  vm.runInNewContext(code, { self, URL, console });

  async function dispatch(type: string, event: Record<string, unknown>) {
    let pending: Promise<unknown> = Promise.resolve();
    const fn = listeners.get(type);
    if (!fn) throw new Error(`kein ${type}-Listener`);
    fn({ ...event, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  }

  const push = (payload: unknown) =>
    dispatch("push", {
      data: payload === undefined ? null : { json: () => (typeof payload === "string" ? JSON.parse(payload) : payload) },
    });

  const click = (data: Record<string, unknown> | undefined) => {
    let closed = false;
    return dispatch("notificationclick", {
      notification: { data, close: () => (closed = true) },
    }).then(() => closed);
  };

  const subscriptionChange = () => dispatch("pushsubscriptionchange", {});

  return { listeners, shown, opened, matchAllArgs, push, click, subscriptionChange };
}

describe("firebase-messaging-sw.js", () => {
  it("registriert push/notificationclick/pushsubscriptionchange/install/activate beim ersten Auswerten, ohne importScripts", () => {
    const w = loadWorker();
    expect([...w.listeners.keys()].sort()).toEqual([
      "activate",
      "install",
      "notificationclick",
      "push",
      "pushsubscriptionchange",
    ]);
    const code = readFileSync(SW_FILE, "utf8");
    expect(code).not.toMatch(/importScripts\s*\(/);
  });

  it("zeigt Data-only-Pushes genau einmal mit Titel, Text, Tag und URL", async () => {
    const w = loadWorker();
    await w.push({
      data: { title: "🎂 Anna hat in 30 Tagen Geburtstag", body: "Zeit für Ideen.", url: "/", tag: "gm-stack-g-p", type: "birthday_stack", groupId: "g" },
    });
    expect(w.shown).toHaveLength(1);
    expect(w.shown[0].title).toBe("🎂 Anna hat in 30 Tagen Geburtstag");
    expect(w.shown[0].options).toMatchObject({
      body: "Zeit für Ideen.",
      tag: "gm-stack-g-p",
      silent: false,
      data: { url: "/", type: "birthday_stack", groupId: "g" },
    });
    expect(w.matchAllArgs[0]).toEqual({ type: "window", includeUncontrolled: true });
  });

  it("zeigt auch bei offener, fokussierter App eine Meldung (leise) und schickt GM_PUSH", async () => {
    const win = fakeWindow("https://app.example/", true);
    const w = loadWorker({ windows: [win] });
    await w.push({ data: { title: "Test", body: "x" } });
    expect(w.shown).toHaveLength(1);
    expect(w.shown[0].options.silent).toBe(true);
    expect(win.messages).toEqual([{ type: "GM_PUSH", data: { title: "Test", body: "x" } }]);
  });

  it("zeigt bei leerem oder kaputtem Payload trotzdem eine Meldung", async () => {
    const w = loadWorker();
    await w.push(undefined);
    await w.push("{kaputt");
    expect(w.shown.map((s) => s.title)).toEqual(["Geschenke-Manager", "Geschenke-Manager"]);
  });

  it("fällt auf eine einfache Meldung zurück, wenn die reiche Variante scheitert", async () => {
    const w = loadWorker({ failRichNotification: true });
    await w.push({ data: { title: "T", body: "B", tag: "x" } });
    expect(w.shown).toEqual([{ title: "T", options: { body: "B" } }]);
  });

  // Regression PUSH-07: rotiert der Browser das Abo, muss die offene App sofort neu registrieren.
  it("meldet pushsubscriptionchange an alle offenen Fenster, ohne Meldung anzuzeigen", async () => {
    const a = fakeWindow("https://app.example/");
    const b = fakeWindow("https://app.example/settings", true);
    const w = loadWorker({ windows: [a, b] });
    await w.subscriptionChange();
    expect(a.messages).toEqual([{ type: "GM_PUSH_SUBSCRIPTION_CHANGE" }]);
    expect(b.messages).toEqual([{ type: "GM_PUSH_SUBSCRIPTION_CHANGE" }]);
    expect(w.matchAllArgs[0]).toEqual({ type: "window", includeUncontrolled: true });
    expect(w.shown).toEqual([]);
  });

  it("pushsubscriptionchange ohne offenes Fenster läuft fehlerfrei durch", async () => {
    const w = loadWorker();
    await expect(w.subscriptionChange()).resolves.toBeUndefined();
    expect(w.opened).toEqual([]);
  });

  it("Klick fokussiert ein offenes Fenster und schickt GM_NAVIGATE statt neues Fenster", async () => {
    const win = fakeWindow("https://app.example/people");
    const w = loadWorker({ windows: [win] });
    const closed = await w.click({ url: "/g/abc/gift/g1?vote=1" });
    expect(closed).toBe(true);
    expect(win.focusCalls).toBe(1);
    expect(win.messages).toEqual([{ type: "GM_NAVIGATE", url: "/g/abc/gift/g1?vote=1" }]);
    expect(w.opened).toEqual([]);
  });

  it("Klick ohne offenes Fenster öffnet die Ziel-URL", async () => {
    const w = loadWorker();
    await w.click({ url: "/wishlist" });
    expect(w.opened).toEqual(["https://app.example/wishlist"]);
  });

  it("Klick mit fremder Origin öffnet nur die Startseite", async () => {
    const w = loadWorker();
    await w.click({ url: "https://evil.example/x" });
    expect(w.opened).toEqual(["https://app.example/"]);
  });
});

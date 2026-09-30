import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Minimaler Browser-Ersatz: History mit Einträgen, back() asynchron wie im Browser.
class FakeHistory {
  entries: unknown[] = [{ idx: 0, key: "start" }];
  index = 0;
  backCalls = 0;
  constructor(private win: EventTarget) {}
  get state() {
    return this.entries[this.index];
  }
  pushState(state: unknown) {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(structuredClone(state));
    this.index++;
  }
  back() {
    this.backCalls++;
    setTimeout(() => {
      if (this.index === 0) return;
      this.index--;
      this.win.dispatchEvent(new Event("popstate"));
    }, 0);
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

let hist: FakeHistory;
let mod: typeof import("./sheetStack");
let rootStyle: { overflow: string };

beforeEach(async () => {
  const win = new EventTarget();
  hist = new FakeHistory(win);
  rootStyle = { overflow: "auto" };
  vi.stubGlobal("window", win);
  vi.stubGlobal("history", hist);
  vi.stubGlobal("document", { documentElement: { style: rootStyle } });
  vi.resetModules(); // Modul-Zustand (Stapel, Zähler) pro Test frisch
  mod = await import("./sheetStack");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registerSheet", () => {
  it("legt beim Öffnen einen History-Eintrag an und räumt ihn beim Schließen ab", async () => {
    const close = vi.fn();
    const h = mod.registerSheet(close);
    await tick();
    expect(hist.index).toBe(1);
    expect(hist.state).toMatchObject({ idx: 0, key: "start" }); // Router-State bleibt erhalten
    expect((hist.state as { gmSheet?: number }).gmSheet).toBeTypeOf("number");

    h.release();
    await tick();
    expect(hist.index).toBe(0);
    expect(close).not.toHaveBeenCalled(); // eigenes popstate wird ignoriert
  });

  it("Zurück-Taste schließt nur das oberste Sheet", async () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    mod.registerSheet(closeA);
    const b = mod.registerSheet(closeB);
    await tick();
    expect(hist.index).toBe(2);

    hist.back(); // Nutzer drückt Zurück
    await tick();
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();

    b.release(); // Komponente räumt nach onClose ab – kein zweites back()
    await tick();
    expect(hist.index).toBe(1);
    expect(hist.backCalls).toBe(1);
  });

  it("Abmelden vor dem pushState (StrictMode) legt keinen Eintrag an", async () => {
    mod.registerSheet(vi.fn()).release();
    const h = mod.registerSheet(vi.fn());
    await tick();
    expect(hist.entries).toHaveLength(2);
    h.release();
    await tick();
    expect(hist.index).toBe(0);
  });

  it("neues Sheet wartet mit pushState auf ein laufendes history.back()", async () => {
    const a = mod.registerSheet(vi.fn());
    await tick();
    a.release(); // back() läuft noch
    const closeB = vi.fn();
    mod.registerSheet(closeB);
    await tick();
    await tick();
    expect(hist.index).toBe(1);
    expect(hist.entries).toHaveLength(2); // kein verwaister Eintrag von A
    expect(closeB).not.toHaveBeenCalled();
  });

  it("springt nicht zurück, wenn inzwischen navigiert wurde", async () => {
    const h = mod.registerSheet(vi.fn());
    await tick();
    hist.pushState({ idx: 1, key: "neu" }); // navigate() aus dem Sheet heraus
    h.release();
    await tick();
    expect(hist.backCalls).toBe(0);
    expect(hist.state).toMatchObject({ key: "neu" });
  });

  it("isTop kennt nur das oberste Sheet", () => {
    const a = mod.registerSheet(vi.fn());
    const b = mod.registerSheet(vi.fn());
    expect(a.isTop()).toBe(false);
    expect(b.isTop()).toBe(true);
    b.release();
    expect(a.isTop()).toBe(true);
  });

  it("sperrt das Scrollen, solange mindestens ein Sheet offen ist", () => {
    const a = mod.registerSheet(vi.fn());
    const b = mod.registerSheet(vi.fn());
    expect(rootStyle.overflow).toBe("hidden");
    a.release();
    expect(rootStyle.overflow).toBe("hidden");
    b.release();
    expect(rootStyle.overflow).toBe("auto");
  });
});

describe("whenHistorySettled", () => {
  it("löst sofort auf, wenn nichts abzuräumen ist", async () => {
    await expect(mod.whenHistorySettled()).resolves.toBeUndefined();
  });

  it("wartet, bis das history.back() eines geschlossenen Sheets verarbeitet ist", async () => {
    const h = mod.registerSheet(vi.fn());
    await tick();
    h.release();
    let settled = false;
    void mod.whenHistorySettled().then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await tick();
    expect(settled).toBe(true);
    expect(hist.index).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { activeTab, canGoBack, loginTarget } from "./nav";

describe("canGoBack", () => {
  it("true ab dem zweiten App-Eintrag", () => {
    expect(canGoBack({ idx: 1 })).toBe(true);
    expect(canGoBack({ idx: 7, usr: null, key: "abc" })).toBe(true);
  });

  it("false beim ersten Eintrag (Direkteinstieg per Link, Push oder Reload)", () => {
    expect(canGoBack({ idx: 0 })).toBe(false);
  });

  it("false ohne oder mit fremdem History-State", () => {
    expect(canGoBack(null)).toBe(false);
    expect(canGoBack(undefined)).toBe(false);
    expect(canGoBack({})).toBe(false);
    expect(canGoBack({ idx: null })).toBe(false);
    expect(canGoBack({ idx: "3" })).toBe(false);
    expect(canGoBack({ idx: Number.NaN })).toBe(false);
    expect(canGoBack("state")).toBe(false);
  });
});

describe("activeTab", () => {
  it("markiert die Übersicht auch auf Geschenk- und Archivseiten", () => {
    expect(activeTab("/")).toBe("home");
    expect(activeTab("/gift/anna_2026")).toBe("home");
    expect(activeTab("/past")).toBe("home");
  });

  it("markiert Personen auch auf der Detailseite", () => {
    expect(activeTab("/people")).toBe("people");
    expect(activeTab("/person/ben")).toBe("people");
  });

  it("ordnet die übrigen Tabs genau zu, Hilfe-Seiten haben keinen Tab", () => {
    expect(activeTab("/wishlist")).toBe("wishlist");
    expect(activeTab("/settings")).toBe("settings");
    expect(activeTab("/feedback")).toBe("feedback");
    expect(activeTab("/help")).toBeNull();
    expect(activeTab("/whats-new")).toBeNull();
    expect(activeTab("/giftx")).toBeNull();
  });
});

describe("loginTarget", () => {
  it("führt nach dem Login zurück zum gemerkten Ziel inkl. Query und Hash", () => {
    expect(loginTarget({ from: { pathname: "/gift/anna_2026", search: "?vote=1", hash: "" } })).toBe("/gift/anna_2026?vote=1");
    expect(loginTarget({ from: { pathname: "/person/ben", search: "", hash: "#profil" } })).toBe("/person/ben#profil");
  });

  it("fällt ohne gültiges Ziel auf die Übersicht zurück", () => {
    expect(loginTarget(null)).toBe("/");
    expect(loginTarget(undefined)).toBe("/");
    expect(loginTarget({})).toBe("/");
    expect(loginTarget({ from: { pathname: "/login" } })).toBe("/");
    expect(loginTarget({ from: { pathname: "/login/new" } })).toBe("/");
    expect(loginTarget({ from: { pathname: "//evil.example" } })).toBe("/");
    expect(loginTarget({ from: { pathname: "https://evil.example/x" } })).toBe("/");
    expect(loginTarget({ from: { pathname: "/", search: "vote=1" } })).toBe("/");
  });
});

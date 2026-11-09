import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimedPersonIds,
  cloudIdentityBehind,
  identitySkipKey,
  identityToRestore,
  isIdentitySkipped,
  liveIdentity,
  skipIdentity,
  staleIdentity,
} from "./identity";

describe("liveIdentity (Regression SPO-05)", () => {
  const persons = [{ id: "anna" }, { id: "ben" }];

  it("gilt nur, solange die Person existiert", () => {
    expect(liveIdentity("anna", { persons, ready: true })).toBe("anna");
    expect(liveIdentity("anna-alt", { persons, ready: true })).toBeNull();
    expect(liveIdentity(null, { persons, ready: true })).toBeNull();
  });

  it("vor dem Laden der Personen (oder beim Gruppenwechsel) zählt die gespeicherte", () => {
    expect(liveIdentity("anna-alt", { persons: [], ready: false })).toBe("anna-alt");
  });
});

describe("staleIdentity (Regression SPO-05)", () => {
  const persons = [{ id: "anna" }];
  const base = { uid: "u1", members: [] as { uid: string; identityPersonId?: string }[], persons, ready: true, serverConfirmed: true };

  it("lokale Identität einer gelöschten Person → lokal (und Cloud) leeren", () => {
    expect(staleIdentity({ ...base, localId: "anna-alt" })).toBe("local");
    expect(staleIdentity({ ...base, localId: "anna" })).toBeNull();
  });

  it("nur die Cloud zeigt auf eine gelöschte Person → Cloud leeren", () => {
    const members = [
      { uid: "u1", identityPersonId: "anna-alt" },
      { uid: "u2", identityPersonId: "weg" },
    ];
    expect(staleIdentity({ ...base, localId: null, members })).toBe("cloud");
    expect(staleIdentity({ ...base, localId: null, members: [{ uid: "u1", identityPersonId: "anna" }] })).toBeNull();
    expect(staleIdentity({ ...base, localId: null, members: [{ uid: "u1", identityPersonId: "" }] })).toBeNull();
  });

  it("nichts, solange die Personen der Gruppe nicht geladen sind", () => {
    expect(staleIdentity({ ...base, localId: "anna-alt", persons: [], ready: false })).toBeNull();
  });
});

describe("Sitzungs-Ausweg „nur ansehen“", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gilt pro Gruppe und ohne sessionStorage für den App-Start", () => {
    expect(isIdentitySkipped("g1")).toBe(false);
    skipIdentity("g1");
    expect(isIdentitySkipped("g1")).toBe(true);
    expect(isIdentitySkipped("g2")).toBe(false);
    expect(isIdentitySkipped(null)).toBe(false);
  });

  it("liest den Key aus sessionStorage (Reload in derselben Sitzung)", () => {
    const store = new Map([[identitySkipKey("g9"), "1"]]);
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: () => {} });
    expect(isIdentitySkipped("g9")).toBe(true);
  });

  it("gesperrter Storage wirft nicht", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(isIdentitySkipped("g3")).toBe(false);
    expect(() => skipIdentity("g3")).not.toThrow();
    expect(isIdentitySkipped("g3")).toBe(true);
  });
});

describe("claimedPersonIds", () => {
  const members = [
    { uid: "u1", identityPersonId: "anna" },
    { uid: "u2", identityPersonId: "" },
    { uid: "u3" },
    { uid: "me", identityPersonId: "ben" },
  ];

  it("nur Personen, die andere gewählt haben", () => {
    expect([...claimedPersonIds(members, "me")]).toEqual(["anna"]);
    expect([...claimedPersonIds(members)].sort()).toEqual(["anna", "ben"]);
  });
});

describe("identityToRestore", () => {
  const persons = [{ id: "anna" }, { id: "ben" }];
  const members = [
    { uid: "me", identityPersonId: "anna" },
    { uid: "other", identityPersonId: "ben" },
  ];

  it("übernimmt die Cloud-Identität, wenn lokal nichts gesetzt ist", () => {
    expect(identityToRestore({ localId: null, uid: "me", members, persons })).toBe("anna");
  });

  it("nie bei lokaler Identität, ohne Konto, ohne Eintrag oder gelöschter Person", () => {
    expect(identityToRestore({ localId: "ben", uid: "me", members, persons })).toBeNull();
    expect(identityToRestore({ localId: null, uid: null, members, persons })).toBeNull();
    expect(identityToRestore({ localId: null, uid: "new", members, persons })).toBeNull();
    expect(identityToRestore({ localId: null, uid: "me", members, persons: [{ id: "ben" }] })).toBeNull();
    expect(
      identityToRestore({ localId: null, uid: "me", members: [{ uid: "me", identityPersonId: "" }], persons }),
    ).toBeNull();
  });
});

describe("staleIdentity nur mit Server-Stand (R2)", () => {
  const base = { localId: "weg", uid: "u1", members: [], persons: [{ id: "p1" }], ready: true };

  it("ein reiner Cache-Snapshot räumt nichts auf", () => {
    expect(staleIdentity({ ...base, serverConfirmed: false })).toBeNull();
  });

  it("der Server-Stand räumt auf", () => {
    expect(staleIdentity({ ...base, serverConfirmed: true })).toBe("local");
  });
});

describe("cloudIdentityBehind", () => {
  const base = {
    localId: "p1",
    uid: "u1",
    persons: [{ id: "p1" }],
    ready: true,
    serverConfirmed: true,
  };

  it("erkennt ein Member-Doc ohne die lokale Identität (Stimmen-Regel braucht sie)", () => {
    expect(cloudIdentityBehind({ ...base, members: [{ uid: "u1" }] })).toBe(true);
    expect(cloudIdentityBehind({ ...base, members: [{ uid: "u1", identityPersonId: "p2" }] })).toBe(true);
  });

  it("nichts zu tun: gleich, kein Member-Doc, keine lokale oder veraltete Identität", () => {
    expect(cloudIdentityBehind({ ...base, members: [{ uid: "u1", identityPersonId: "p1" }] })).toBe(false);
    expect(cloudIdentityBehind({ ...base, members: [] })).toBe(false);
    expect(cloudIdentityBehind({ ...base, localId: null, members: [{ uid: "u1" }] })).toBe(false);
    expect(cloudIdentityBehind({ ...base, localId: "weg", members: [{ uid: "u1" }] })).toBe(false);
    expect(cloudIdentityBehind({ ...base, ready: false, members: [{ uid: "u1" }] })).toBe(false);
  });
});

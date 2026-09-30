import { describe, expect, it } from "vitest";
import {
  genitive,
  pollMarkerId,
  pollPushTag,
  pollPushTtlSeconds,
  pollPushUrl,
  pollReminderData,
  pollStartedData,
  readGift,
  roundRemaining,
} from "./pollPush";

const MIN = 60_000;
const HOUR = 60 * MIN;
// Mi, 30.09.2026 10:00 Wien
const T0 = Date.parse("2026-09-30T10:00:00+02:00");

describe("genitive", () => {
  it("hängt ein s an", () => {
    expect(genitive("Anna")).toBe("Annas");
    expect(genitive("Christof")).toBe("Christofs");
    expect(genitive(" Lea ")).toBe("Leas");
  });

  it("nur Apostroph bei s, ß, x, z und ce am Ende", () => {
    expect(genitive("Max")).toBe("Max'");
    expect(genitive("Hans")).toBe("Hans'");
    expect(genitive("Fritz")).toBe("Fritz'");
    expect(genitive("Strauß")).toBe("Strauß'");
    expect(genitive("Alice")).toBe("Alice'");
    expect(genitive("KLAUS")).toBe("KLAUS'");
  });

  it("leerer Name bleibt leer", () => {
    expect(genitive("  ")).toBe("");
  });
});

describe("Deeplink, Tag, Marker, TTL", () => {
  it("URL öffnet das VoteSheet, Tag und Marker je Geschenk bzw. Runde", () => {
    expect(pollPushUrl("g1", "gift1")).toBe("/g/g1/gift/gift1?vote=1");
    expect(pollPushTag("g1", "gift1")).toBe("gm-poll-g1-gift1");
    expect(pollMarkerId("poll_started", "gift1", T0)).toBe(`poll_started-gift1-${T0}`);
    expect(pollMarkerId("poll_reminder", "gift1", T0)).toBe(`poll_reminder-gift1-${T0}`);
  });

  it("TTL bis zum Ende, mindestens 1 Minute, ohne Frist 1 Tag", () => {
    expect(pollPushTtlSeconds(T0 + 48 * HOUR, T0)).toBe(48 * 3600);
    expect(pollPushTtlSeconds(T0 + 10_000, T0)).toBe(60);
    expect(pollPushTtlSeconds(T0 - HOUR, T0)).toBe(60);
    expect(pollPushTtlSeconds(null, T0)).toBe(86_400);
  });

  it("roundRemaining: volle Stunden ab 1 Std, darunter 5-Minuten-Schritte aufwärts", () => {
    expect(roundRemaining(11 * HOUR + 57 * MIN)).toBe(12 * HOUR);
    expect(roundRemaining(12 * HOUR + 28 * MIN)).toBe(12 * HOUR);
    expect(roundRemaining(2 * HOUR + 31 * MIN)).toBe(3 * HOUR);
    expect(roundRemaining(60 * MIN)).toBe(HOUR);
    expect(roundRemaining(38 * MIN)).toBe(40 * MIN);
    expect(roundRemaining(1)).toBe(5 * MIN);
  });
});

describe("pollStartedData", () => {
  const base = { groupId: "g1", giftId: "gift1", personName: "Anna", now: T0 };

  it("neutraler Text mit Starter, Ideen-Zahl und Ende, Data-Felder als Strings", () => {
    expect(pollStartedData({ ...base, starterName: "Ben", ideaCount: 4, endsAt: T0 + 48 * HOUR })).toEqual({
      type: "poll_started",
      kind: "poll_started",
      groupId: "g1",
      giftId: "gift1",
      url: "/g/g1/gift/gift1?vote=1",
      tag: "gm-poll-g1-gift1",
      renotify: "1",
      title: "🗳️ Abstimmung für Annas Geschenk",
      body: "Ben hat 4 Ideen zur Wahl gestellt – endet Fr 10:00.",
    });
  });

  it("Genitiv mit Apostroph, Einzahl und Ende morgen", () => {
    const d = pollStartedData({ ...base, personName: "Max", starterName: "Lea", ideaCount: 1, endsAt: T0 + 24 * HOUR });
    expect(d.title).toBe("🗳️ Abstimmung für Max' Geschenk");
    expect(d.body).toBe("Lea hat 1 Idee zur Wahl gestellt – endet morgen 10:00.");
  });

  it("alter Client ohne Starter und ohne Frist", () => {
    const d = pollStartedData({ ...base, starterName: "", ideaCount: 3, endsAt: null });
    expect(d.body).toBe("3 Ideen stehen zur Wahl.");
    expect(pollStartedData({ ...base, ideaCount: 1, endsAt: null }).body).toBe("1 Idee steht zur Wahl.");
  });

  it("ohne Namen: „das Geschenk“", () => {
    expect(pollStartedData({ ...base, personName: "", ideaCount: 2, endsAt: null }).title).toBe(
      "🗳️ Abstimmung für das Geschenk",
    );
  });

  it("enthält nie Ideen-Titel oder Preise (nur übergebene Namen/Zahlen)", () => {
    const d = pollStartedData({ ...base, starterName: "Ben", ideaCount: 2, endsAt: T0 + 48 * HOUR });
    expect(Object.keys(d).sort()).toEqual(["body", "giftId", "groupId", "kind", "renotify", "tag", "title", "type", "url"]);
    expect(d.body).not.toMatch(/€/);
  });
});

describe("pollReminderData", () => {
  const base = { groupId: "g1", giftId: "gift1", personName: "Hans" };

  it("„Noch 3 Std zum Abstimmen“ und fehlende Stimme", () => {
    const d = pollReminderData({ ...base, now: T0, endsAt: T0 + 3 * HOUR + 2 * MIN });
    expect(d.title).toBe("⏱ Noch 3 Std zum Abstimmen");
    expect(d.body).toBe("Für Hans' Geschenk fehlt noch deine Stimme.");
    expect(d.type).toBe("poll_reminder");
    expect(d.kind).toBe("poll_reminder");
    expect(d.url).toBe("/g/g1/gift/gift1?vote=1");
    expect(d.tag).toBe("gm-poll-g1-gift1");
  });

  it("kurz vor Schluss in Minuten", () => {
    expect(pollReminderData({ ...base, now: T0, endsAt: T0 + 28 * MIN }).title).toBe("⏱ Noch 30 Min zum Abstimmen");
  });
});

describe("readGift", () => {
  it("liest Person, Status und Teilnehmer", () => {
    expect(readGift({ personId: "anna", status: "open", participantIds: ["ben", 3, "lea"], year: 2026 })).toEqual({
      personId: "anna",
      status: "open",
      participantIds: ["ben", "lea"],
    });
    expect(readGift({ personId: "anna", status: "received" })).toEqual({
      personId: "anna",
      status: "received",
      participantIds: [],
    });
  });

  it("fail-closed ohne beschenkte Person oder mit unbekanntem Status", () => {
    expect(readGift(undefined)).toBeNull();
    expect(readGift({ status: "open", participantIds: ["ben"] })).toBeNull();
    expect(readGift({ personId: "", status: "open" })).toBeNull();
    expect(readGift({ personId: "anna", status: "archived" })).toBeNull();
  });
});

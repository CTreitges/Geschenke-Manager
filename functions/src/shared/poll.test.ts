import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION_PRESET,
  DURATION_PRESETS,
  POLL_LOCK_REASON,
  canVote,
  classifyTransition,
  countVoters,
  effectiveEndsAt,
  eligibleVoters,
  formatEndsAt,
  formatRemaining,
  getGiftLocks,
  isQuietTime,
  normalizePoll,
  normalizeVotes,
  pollPhase,
  pollResult,
  ranking,
  reminderDueAt,
  tally,
  type GiftLike,
  type PollDoc,
} from "./poll";

const MIN = 60_000;
const HOUR = 60 * MIN;
const T0 = Date.parse("2026-09-30T10:00:00+02:00");

const gift = (extra: Partial<GiftLike> = {}): GiftLike => ({
  personId: "anna",
  status: "open",
  participantIds: ["ben", "christof", "lea"],
  ...extra,
});

const poll = (extra: Partial<PollDoc> = {}): PollDoc => ({
  status: "active",
  startedAt: T0,
  endsAt: T0 + 48 * HOUR,
  votes: {},
  ...extra,
});

describe("DURATION_PRESETS", () => {
  it("bietet 24 Std / 48 Std / 3 Tage / 1 Woche, Default 48 Std", () => {
    expect(DURATION_PRESETS.map((p) => p.label)).toEqual(["24 Std", "48 Std", "3 Tage", "1 Woche"]);
    expect(DURATION_PRESETS.map((p) => p.ms / HOUR)).toEqual([24, 48, 72, 168]);
    expect(DEFAULT_DURATION_PRESET).toBe("48h");
    expect(DURATION_PRESETS.some((p) => p.id === DEFAULT_DURATION_PRESET)).toBe(true);
  });
});

describe("normalizeVotes / normalizePoll", () => {
  it("wandelt Legacy-Strings in einelementige Listen und verwirft Müll", () => {
    expect(normalizeVotes({ a: "s1", b: ["s1", "s2", 3], c: "", d: null })).toEqual({
      a: ["s1"],
      b: ["s1", "s2"],
      c: [],
      d: [],
    });
    expect(normalizeVotes(undefined)).toEqual({});
    expect(normalizeVotes("kaputt")).toEqual({});
  });

  it("übernimmt gültige Felder und lässt ungültige weg (kein undefined im Objekt)", () => {
    const p = normalizePoll({
      status: "active",
      startedAt: T0,
      startedBy: "ben",
      endsAt: "morgen",
      closedReason: "weil",
      votes: { ben: "s1" },
    });
    expect(p).toEqual({ status: "active", startedAt: T0, startedBy: "ben", votes: { ben: ["s1"] } });
    expect(Object.values(p)).not.toContain(undefined);
  });

  it("fällt bei unbekanntem Status oder fehlenden Daten auf none zurück", () => {
    expect(normalizePoll({ status: "paused" }).status).toBe("none");
    expect(normalizePoll(null)).toEqual({ status: "none", votes: {} });
  });

  it("liest closedReason, closedBy und closedAt", () => {
    const p = normalizePoll({ status: "closed", closedAt: 5, closedBy: "lea", closedReason: "timeout", votes: {} });
    expect(p).toMatchObject({ closedAt: 5, closedBy: "lea", closedReason: "timeout" });
  });
});

describe("eligibleVoters", () => {
  it("nimmt Teilnehmer ohne die beschenkte Person, dedupliziert, Reihenfolge bleibt", () => {
    expect(eligibleVoters(gift({ participantIds: ["ben", "anna", "lea", "ben", ""] }))).toEqual(["ben", "lea"]);
  });

  it("kommt ohne participantIds aus", () => {
    expect(eligibleVoters(gift({ participantIds: undefined }))).toEqual([]);
  });
});

describe("effectiveEndsAt / pollPhase", () => {
  it("none ohne Doc und bei Legacy-Status none", () => {
    expect(pollPhase(undefined, T0)).toBe("none");
    expect(pollPhase(null, T0)).toBe("none");
    expect(pollPhase(poll({ status: "none" }), T0)).toBe("none");
  });

  it("running vor der Frist, expired genau ab endsAt", () => {
    const p = poll();
    expect(pollPhase(p, T0 + 48 * HOUR - 1)).toBe("running");
    expect(pollPhase(p, T0 + 48 * HOUR)).toBe("expired");
    expect(pollPhase(p, T0 + 49 * HOUR)).toBe("expired");
  });

  it("ignoriert endsAt ≤ startedAt (Rest aus der Vorrunde) → läuft ohne Frist", () => {
    const stale = poll({ endsAt: T0 - HOUR });
    expect(effectiveEndsAt(stale)).toBeNull();
    expect(effectiveEndsAt(poll({ endsAt: T0 }))).toBeNull();
    expect(pollPhase(stale, T0 + 1000 * HOUR)).toBe("running");
  });

  it("Frist ohne startedAt oder ohne endsAt zählt nicht", () => {
    expect(effectiveEndsAt(poll({ startedAt: undefined }))).toBeNull();
    expect(effectiveEndsAt(poll({ endsAt: undefined }))).toBeNull();
    expect(effectiveEndsAt(poll({ endsAt: Number.NaN }))).toBeNull();
    expect(effectiveEndsAt(undefined)).toBeNull();
    expect(effectiveEndsAt(poll())).toBe(T0 + 48 * HOUR);
  });

  it("closed bleibt closed, auch nach der Frist", () => {
    expect(pollPhase(poll({ status: "closed" }), T0)).toBe("closed");
    expect(pollPhase(poll({ status: "closed" }), T0 + 100 * HOUR)).toBe("closed");
  });
});

describe("canVote", () => {
  const p = poll();
  it("Teilnehmer darf bei laufender Wahl abstimmen", () => {
    expect(canVote(gift(), p, "ben", T0 + HOUR)).toBe(true);
  });

  it("beschenkte Person nie – auch wenn sie in participantIds steht", () => {
    expect(canVote(gift({ participantIds: ["anna", "ben"] }), p, "anna", T0 + HOUR)).toBe(false);
  });

  it("ohne Identität und als Nicht-Teilnehmer nicht", () => {
    expect(canVote(gift(), p, null, T0 + HOUR)).toBe(false);
    expect(canVote(gift(), p, undefined, T0 + HOUR)).toBe(false);
    expect(canVote(gift(), p, "", T0 + HOUR)).toBe(false);
    expect(canVote(gift(), p, "max", T0 + HOUR)).toBe(false);
  });

  it("nicht nach Ablauf, nach dem Schließen oder ohne Poll", () => {
    expect(canVote(gift(), p, "ben", T0 + 48 * HOUR)).toBe(false);
    expect(canVote(gift(), poll({ status: "closed" }), "ben", T0 + HOUR)).toBe(false);
    expect(canVote(gift(), undefined, "ben", T0)).toBe(false);
  });

  it("nicht bei bestätigtem oder erhaltenem Geschenk (Zombie-Wahl)", () => {
    expect(canVote(gift({ status: "confirmed" }), p, "ben", T0 + HOUR)).toBe(false);
    expect(canVote(gift({ status: "received" }), p, "ben", T0 + HOUR)).toBe(false);
  });
});

describe("tally / ranking / pollResult", () => {
  const suggestions = [
    { id: "s1", createdAt: 100 },
    { id: "s2", createdAt: 200 },
    { id: "s3", createdAt: 300 },
  ];
  const ids = suggestions.map((s) => s.id);
  const eligible = ["ben", "christof", "lea"];

  it("zählt nur existierende Ideen und nur Wahlberechtigte", () => {
    const p = poll({
      votes: {
        ben: ["s1", "s2", "s1"],
        christof: ["s2", "geloescht"],
        anna: ["s1"], // beschenkte Person
        max: ["s1"], // kein Teilnehmer
      },
    });
    expect(tally(p, ids, eligible)).toEqual({ s1: ["ben"], s2: ["ben", "christof"], s3: [] });
  });

  it("ohne Poll: alle Ideen mit leeren Listen", () => {
    expect(tally(undefined, ids, eligible)).toEqual({ s1: [], s2: [], s3: [] });
  });

  it("doppelte Wahlberechtigte zählen einmal", () => {
    expect(tally(poll({ votes: { ben: ["s1"] } }), ids, ["ben", "ben"]).s1).toEqual(["ben"]);
  });

  it("0 Stimmen → empty (kein 🏆 für die erste Idee)", () => {
    const r = ranking(suggestions, tally(poll(), ids, eligible));
    expect(r.map((x) => x.votes)).toEqual([0, 0, 0]);
    expect(pollResult(r)).toEqual({ kind: "empty" });
    expect(pollResult([])).toEqual({ kind: "empty" });
  });

  it("eindeutiger Sieger", () => {
    const p = poll({ votes: { ben: ["s3"], christof: ["s3", "s1"], lea: ["s3"] } });
    const r = ranking(suggestions, tally(p, ids, eligible));
    expect(r.map((x) => x.id)).toEqual(["s3", "s1", "s2"]);
    expect(r[0]).toEqual({ id: "s3", votes: 3, voters: ["ben", "christof", "lea"] });
    expect(pollResult(r)).toEqual({ kind: "winner", id: "s3", votes: 3 });
  });

  it("Gleichstand unabhängig von der Eingabe-Reihenfolge, ältere Idee zuerst", () => {
    const p = poll({ votes: { ben: ["s3"], christof: ["s1"] } });
    const t = tally(p, ids, eligible);
    const forward = ranking(suggestions, t);
    const backward = ranking([...suggestions].reverse(), t);
    expect(forward).toEqual(backward);
    expect(forward.map((x) => x.id)).toEqual(["s1", "s3", "s2"]);
    expect(pollResult(forward)).toEqual({ kind: "tie", ids: ["s1", "s3"], votes: 1 });
    expect(pollResult(backward)).toEqual(pollResult(forward));
  });

  it("gleiches createdAt → ID entscheidet (deterministisch)", () => {
    const same = [
      { id: "b", createdAt: 1 },
      { id: "a", createdAt: 1 },
    ];
    expect(ranking(same, {}).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("pollResult findet den Spitzenwert auch in unsortierter Eingabe", () => {
    expect(
      pollResult([
        { id: "x", votes: 1, voters: ["a"] },
        { id: "y", votes: 2, voters: ["a", "b"] },
      ]),
    ).toEqual({ kind: "winner", id: "y", votes: 2 });
  });
});

describe("countVoters", () => {
  const eligible = ["ben", "christof", "lea"];

  it("zählt Personen mit ≥ 1 Stimme, Nenner = Wahlberechtigte", () => {
    const p = poll({ votes: { ben: ["s1", "s2"], lea: [], max: ["s1"], anna: ["s2"] } });
    expect(countVoters(p, eligible)).toEqual({ voted: 1, total: 3, missing: ["christof", "lea"] });
  });

  it("nie mehr Abstimmende als Wahlberechtigte (kein „5 von 4“)", () => {
    const p = poll({ votes: { ben: ["s1"], christof: ["s1"], lea: ["s1"], max: ["s1"], anna: ["s1"] } });
    const c = countVoters(p, eligible);
    expect(c.voted).toBeLessThanOrEqual(c.total);
    expect(c).toEqual({ voted: 3, total: 3, missing: [] });
  });

  it("mit suggestionIds zählen Stimmen für gelöschte Ideen nicht", () => {
    const p = poll({ votes: { ben: ["geloescht"], christof: ["s1"] } });
    expect(countVoters(p, eligible, ["s1"])).toEqual({ voted: 1, total: 3, missing: ["ben", "lea"] });
    expect(countVoters(p, eligible).voted).toBe(2);
  });

  it("ohne Poll fehlen alle; doppelte Wahlberechtigte zählen einmal", () => {
    expect(countVoters(undefined, ["ben", "ben"])).toEqual({ voted: 0, total: 1, missing: ["ben"] });
  });
});

describe("getGiftLocks", () => {
  const keys = ["addIdea", "adoptWish", "editIdea", "deleteIdea", "decideOutsideResult"] as const;

  it("sperrt alles mit Grund, solange die Wahl läuft", () => {
    const locks = getGiftLocks(gift(), poll(), T0 + HOUR);
    for (const k of keys) expect(locks[k]).toEqual({ locked: true, reason: POLL_LOCK_REASON });
    expect(POLL_LOCK_REASON).toBe("Pausiert, bis die Abstimmung endet");
  });

  it("gibt frei ohne Poll, nach Ablauf und nach dem Schließen", () => {
    for (const [p, now] of [
      [undefined, T0],
      [poll(), T0 + 48 * HOUR],
      [poll({ status: "closed" }), T0 + HOUR],
      [poll({ status: "none" }), T0 + HOUR],
    ] as const) {
      const locks = getGiftLocks(gift(), p, now);
      for (const k of keys) expect(locks[k]).toEqual({ locked: false });
    }
  });

  it("sperrt nicht bei bestätigtem Geschenk mit Zombie-Poll", () => {
    expect(getGiftLocks(gift({ status: "confirmed" }), poll(), T0 + HOUR).addIdea.locked).toBe(false);
  });

  it("liefert unabhängige Objekte je Aktion", () => {
    const locks = getGiftLocks(gift(), poll(), T0 + HOUR);
    expect(locks.addIdea).not.toBe(locks.adoptWish);
  });
});

describe("reminderDueAt", () => {
  const at = (iso: string) => Date.parse(iso);
  const span = (start: string, ms: number) => ({ startedAt: at(start), endsAt: at(start) + ms });

  it("25 % vor Ende, wenn das tagsüber liegt", () => {
    // 24 h ab Mitternacht → Erinnerung 6 h vor Ende = 18:00
    expect(reminderDueAt(span("2026-09-30T00:00:00+02:00", 24 * HOUR))).toBe(at("2026-09-30T18:00:00+02:00"));
  });

  it("klemmt auf mindestens 30 Min und höchstens 12 Std", () => {
    expect(reminderDueAt(span("2026-09-30T10:00:00+02:00", 1 * HOUR))).toBe(at("2026-09-30T10:30:00+02:00"));
    // 1 Woche: 12 h vor Ende (Mi 10:00 + 7 T − 12 h = Di 22:00 → Ruhezeit → Di 21:30)
    const week = span("2026-09-30T10:00:00+02:00", 168 * HOUR);
    expect(reminderDueAt(week)).toBe(at("2026-10-06T21:30:00+02:00"));
    // 1 Woche ab 20:00: 12 h vor Ende = 08:00 (keine Ruhezeit mehr)
    expect(reminderDueAt(span("2026-09-30T20:00:00+02:00", 168 * HOUR))).toBe(at("2026-10-07T08:00:00+02:00"));
  });

  it("zieht 22:00–24:00 auf 21:30 desselben Abends vor", () => {
    // 48 h ab Mi 10:00 → 12 h vor Ende = Do 22:00
    expect(reminderDueAt(span("2026-09-30T10:00:00+02:00", 48 * HOUR))).toBe(at("2026-10-01T21:30:00+02:00"));
  });

  it("zieht 0–8 Uhr auf 21:30 des Vortages vor", () => {
    // 24 h ab 12:00 → 6 h vor Ende = 06:00 → Vorabend 21:30
    expect(reminderDueAt(span("2026-09-30T12:00:00+02:00", 24 * HOUR))).toBe(at("2026-09-30T21:30:00+02:00"));
    // Winterzeit (+01:00): 48 h ab 12:00 → Mitternacht → 21:30 am Vortag
    expect(reminderDueAt(span("2026-11-10T12:00:00+01:00", 48 * HOUR))).toBe(at("2026-11-11T21:30:00+01:00"));
  });

  it("rechnet über die Zeitumstellung korrekt (CEST → CET am 25.10.)", () => {
    // Start Sa 12:00 CEST, Ende 24 h später = So 11:00 CET, Erinnerung 05:00 CET → Sa 21:30 CEST
    expect(reminderDueAt(span("2026-10-24T12:00:00+02:00", 24 * HOUR))).toBe(at("2026-10-24T21:30:00+02:00"));
  });

  it("nie vor Start + 10 Min", () => {
    // 20 Min Dauer: 30 Min vor Ende läge vor dem Start → Start + 10 Min
    expect(reminderDueAt(span("2026-09-30T10:00:00+02:00", 20 * MIN))).toBe(at("2026-09-30T10:10:00+02:00"));
  });

  it("verschiebt auf 8 Uhr, wenn Vorziehen nicht geht und Start + 10 Min in der Ruhezeit liegt", () => {
    const w = { startedAt: at("2026-09-30T22:30:00+02:00"), endsAt: at("2026-10-01T09:00:00+02:00") };
    expect(reminderDueAt(w)).toBe(at("2026-10-01T08:00:00+02:00"));
  });

  it("null ohne gültige Frist oder wenn die Erinnerung nicht mehr vor das Ende passt", () => {
    expect(reminderDueAt({ startedAt: T0 })).toBeNull();
    expect(reminderDueAt({ startedAt: T0, endsAt: T0 - HOUR })).toBeNull();
    expect(reminderDueAt(span("2026-09-30T10:00:00+02:00", 10 * MIN))).toBeNull();
    // Start 21:55, Ende 23:00: Start + 10 Min = 22:05 (Ruhe) → 8 Uhr liegt nach dem Ende
    expect(
      reminderDueAt({ startedAt: at("2026-09-30T21:55:00+02:00"), endsAt: at("2026-09-30T23:00:00+02:00") }),
    ).toBeNull();
  });

  it("liegt für alle Presets und Startzeiten nie in der Ruhezeit und nie außerhalb der Runde", () => {
    const hourIn = (ts: number) =>
      Number(
        new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Vienna", hour: "numeric", hourCycle: "h23" }).format(ts),
      );
    for (const preset of DURATION_PRESETS) {
      for (let h = 0; h < 24; h++) {
        const startedAt = at("2026-10-20T00:00:00+02:00") + h * HOUR + 7 * MIN;
        const due = reminderDueAt({ startedAt, endsAt: startedAt + preset.ms });
        expect(due).not.toBeNull();
        const local = hourIn(due!);
        expect(local >= 22 || local < 8).toBe(false);
        expect(due!).toBeGreaterThanOrEqual(startedAt + 10 * MIN);
        expect(due!).toBeLessThan(startedAt + preset.ms);
      }
    }
  });
});

describe("isQuietTime", () => {
  const at = (iso: string) => Date.parse(iso);

  it("22:00 bis 7:59 Wiener Zeit ist Ruhezeit, 8:00 bis 21:59 nicht", () => {
    expect(isQuietTime(at("2026-09-30T21:59:00+02:00"))).toBe(false);
    expect(isQuietTime(at("2026-09-30T22:00:00+02:00"))).toBe(true);
    expect(isQuietTime(at("2026-10-01T03:00:00+02:00"))).toBe(true);
    expect(isQuietTime(at("2026-10-01T07:59:00+02:00"))).toBe(true);
    expect(isQuietTime(at("2026-10-01T08:00:00+02:00"))).toBe(false);
  });

  it("rechnet in Europe/Vienna, auch im Winter (UTC+1)", () => {
    // 21:30 UTC = 22:30 Wien (Winterzeit)
    expect(isQuietTime(Date.UTC(2026, 10, 10, 21, 30))).toBe(true);
    // 07:30 UTC = 08:30 Wien
    expect(isQuietTime(Date.UTC(2026, 10, 10, 7, 30))).toBe(false);
  });
});

describe("classifyTransition", () => {
  it("started: neues Doc bzw. neues startedAt im Status active", () => {
    expect(classifyTransition(undefined, poll())).toBe("started");
    expect(classifyTransition(poll({ status: "closed" }), poll({ startedAt: T0 + 1 }))).toBe("started");
    expect(classifyTransition(poll(), poll({ startedAt: T0 + 1 }))).toBe("started");
  });

  it("closed: active → closed in derselben Runde", () => {
    expect(classifyTransition(poll(), poll({ status: "closed", closedReason: "timeout" }))).toBe("closed");
  });

  it("null: Stimmen, Verlängern, Löschen, Legacy-none", () => {
    expect(classifyTransition(poll(), poll({ votes: { ben: ["s1"] } }))).toBeNull();
    expect(classifyTransition(poll({ status: "closed" }), poll({ endsAt: T0 + 49 * HOUR }))).toBeNull();
    expect(classifyTransition(poll(), undefined)).toBeNull();
    expect(classifyTransition(poll(), poll({ status: "none" }))).toBeNull();
    expect(classifyTransition(undefined, poll({ status: "closed" }))).toBeNull();
    expect(classifyTransition(poll(), poll({ status: "closed", startedAt: T0 + 1 }))).toBeNull();
    expect(classifyTransition(undefined, poll({ startedAt: undefined }))).toBeNull();
  });
});

describe("formatRemaining", () => {
  it("formatiert Tage, Stunden und Minuten", () => {
    expect(formatRemaining(28 * HOUR)).toBe("noch 1 T 4 Std");
    expect(formatRemaining(48 * HOUR)).toBe("noch 2 T");
    expect(formatRemaining(4 * HOUR + 12 * MIN)).toBe("noch 4 Std 12 Min");
    expect(formatRemaining(3 * HOUR)).toBe("noch 3 Std");
    expect(formatRemaining(38 * MIN)).toBe("noch 38 Min");
  });

  it("rundet Minuten auf, damit nie „noch 0 Min“ erscheint", () => {
    expect(formatRemaining(30_000)).toBe("noch 1 Min");
    expect(formatRemaining(37 * MIN + 1)).toBe("noch 38 Min");
    expect(formatRemaining(59 * MIN + 30_000)).toBe("noch 1 Std");
  });

  it("„beendet“ bei 0, negativ und ungültig", () => {
    expect(formatRemaining(0)).toBe("beendet");
    expect(formatRemaining(-5 * MIN)).toBe("beendet");
    expect(formatRemaining(Number.NaN)).toBe("beendet");
  });
});

describe("formatEndsAt", () => {
  const TZ = "Europe/Vienna";
  const now = Date.parse("2026-09-30T12:00:00+02:00"); // Mittwoch
  const f = (iso: string) => formatEndsAt(Date.parse(iso), now, TZ);

  it("heute / morgen / Wochentag", () => {
    expect(f("2026-09-30T18:30:00+02:00")).toBe("endet heute 18:30");
    expect(f("2026-10-01T09:05:00+02:00")).toBe("endet morgen 09:05");
    expect(f("2026-10-02T18:30:00+02:00")).toBe("endet Fr 18:30");
    expect(f("2026-10-06T18:30:00+02:00")).toBe("endet Di 18:30");
  });

  it("ab 7 Tagen mit Datum (derselbe Wochentag wäre mehrdeutig)", () => {
    expect(f("2026-10-07T12:00:00+02:00")).toBe("endet Mi, 7.10., 12:00");
  });

  it("Vergangenes heißt „beendet“", () => {
    expect(f("2026-09-30T08:00:00+02:00")).toBe("beendet heute 08:00");
    expect(f("2026-09-29T18:30:00+02:00")).toBe("beendet gestern 18:30");
    expect(f("2026-09-25T18:30:00+02:00")).toBe("beendet Fr 18:30");
    expect(formatEndsAt(now, now, TZ)).toBe("beendet heute 12:00");
  });

  it("rechnet Kalendertage in der angegebenen Zeitzone", () => {
    const late = Date.parse("2026-09-30T23:30:00+02:00");
    const end = Date.parse("2026-10-01T00:30:00+02:00");
    expect(formatEndsAt(end, late, TZ)).toBe("endet morgen 00:30");
    expect(formatEndsAt(end, late, "UTC")).toBe("endet heute 22:30");
  });
});

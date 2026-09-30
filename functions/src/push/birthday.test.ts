import { describe, expect, it } from "vitest";
import {
  birthdayMarkerId,
  birthdayPushData,
  isBirthdayPushDue,
  planBirthdayPushes,
  viennaToday,
} from "./birthday";
import type { PushMember } from "./recipients";

const today = new Date(2026, 8, 30); // 30.09.2026, lokal 00:00

describe("isBirthdayPushDue", () => {
  it("Toleranzfenster 28–30 Tage", () => {
    expect(isBirthdayPushDue(30)).toBe(true);
    expect(isBirthdayPushDue(28)).toBe(true);
    expect(isBirthdayPushDue(31)).toBe(false);
    expect(isBirthdayPushDue(27)).toBe(false);
    expect(isBirthdayPushDue(null)).toBe(false);
  });
});

describe("viennaToday", () => {
  it("nimmt das Datum in Wien, nicht in UTC", () => {
    // 23:30 UTC am 30.09. ist in Wien (MESZ) schon der 01.10.
    const d = viennaToday(new Date(Date.UTC(2026, 8, 30, 23, 30)));
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 10, 1]);
    expect(d.getHours()).toBe(0);
  });
});

describe("birthdayPushData", () => {
  const base = { groupId: "g1", personId: "p-anna", name: "Anna", daysLeft: 30 };

  it("Text für die anderen", () => {
    expect(birthdayPushData({ ...base, self: false })).toEqual({
      groupId: "g1",
      personId: "p-anna",
      tag: "gm-stack-g1-p-anna",
      type: "birthday_stack",
      title: "🎂 Anna hat in 30 Tagen Geburtstag",
      body: "Zeit für Ideen.",
      url: "/",
    });
  });

  it("Text für die Person selbst führt zur Wunschliste", () => {
    const d = birthdayPushData({ ...base, self: true });
    expect(d.title).toBe("🎂 In 30 Tagen hast du Geburtstag");
    expect(d.body).toBe("Magst du deine Wunschliste ergänzen?");
    expect(d.url).toBe("/wishlist");
    expect(d.tag).toBe("gm-stack-g1-p-anna");
    expect(JSON.stringify(d)).not.toContain("Anna");
  });

  it("nennt die tatsächliche Zahl der Tage (Nachholen im Fenster)", () => {
    expect(birthdayPushData({ ...base, daysLeft: 29, self: false }).title).toBe(
      "🎂 Anna hat in 29 Tagen Geburtstag",
    );
  });
});

describe("planBirthdayPushes", () => {
  const members: PushMember[] = [
    { uid: "u-anna", identityPersonId: "p-anna", notifyStack: true },
    { uid: "u-ben", identityPersonId: "p-ben", notifyStack: true },
    { uid: "u-anon", notifyStack: true },
    { uid: "u-off", identityPersonId: "p-clara", notifyStack: false },
  ];
  const tokensByUid = {
    "u-anna": ["t-anna"],
    "u-ben": ["t-ben", "t-shared"],
    "u-anon": ["t-anon"],
    "u-off": ["t-off"],
  };
  // 30.10. ist am 30.09. genau 30 Tage entfernt.
  const anna = { id: "p-anna", name: "Anna", birthday: "1990-10-30" };

  it("Happy-Path: andere ohne Anna, Anna bekommt ihre eigene Variante", () => {
    const [plan, ...rest] = planBirthdayPushes({
      groupId: "g1",
      persons: [anna],
      members,
      tokensByUid,
      today,
    });
    expect(rest).toEqual([]);
    expect(plan.markerId).toBe("birthday-p-anna-2026");
    expect([...plan.others.tokens].sort()).toEqual(["t-anon", "t-ben", "t-shared"]);
    expect(plan.others.data.type).toBe("birthday_stack");
    expect(plan.self.tokens).toEqual(["t-anna"]);
    expect(plan.self.data.type).toBe("birthday_self");
  });

  it("Annas Token unter Bens UID (gleiches Gerät) bekommt nur die eigene Variante", () => {
    const [plan] = planBirthdayPushes({
      groupId: "g1",
      persons: [anna],
      members,
      tokensByUid: { ...tokensByUid, "u-anna": ["t-shared"] },
      today,
    });
    expect(plan.others.tokens).not.toContain("t-shared");
    expect(plan.self.tokens).toEqual(["t-shared"]);
  });

  it("Personen außerhalb des Fensters oder mit ungültigem Datum werden nicht geplant", () => {
    const plans = planBirthdayPushes({
      groupId: "g1",
      persons: [
        { id: "p1", name: "Früh", birthday: "11-05" }, // 36 Tage
        { id: "p2", name: "Spät", birthday: "10-20" }, // 20 Tage
        { id: "p3", name: "Kaputt", birthday: "xx" },
        { id: "p4", name: "Nachzügler", birthday: "10-28" }, // 28 Tage
      ],
      members,
      tokensByUid,
      today,
    });
    expect(plans.map((p) => p.personId)).toEqual(["p4"]);
  });

  it("Jahreswechsel: Marker trägt das Jahr des nächsten Geburtstags", () => {
    const [plan] = planBirthdayPushes({
      groupId: "g1",
      persons: [{ id: "p-ny", name: "Neujahr", birthday: "01-01" }],
      members,
      tokensByUid,
      today: new Date(2026, 11, 3), // 03.12.2026 → 29 Tage
    });
    expect(plan.markerId).toBe("birthday-p-ny-2027");
  });

  it("ohne Empfänger kein Plan (und damit auch kein Marker)", () => {
    const plans = planBirthdayPushes({
      groupId: "g1",
      persons: [anna],
      members: members.map((m) => ({ ...m, notifyStack: false })),
      tokensByUid,
      today,
    });
    expect(plans).toEqual([]);
  });
});

describe("birthdayMarkerId", () => {
  it("einmal pro Person und Jahr", () => {
    expect(birthdayMarkerId("p1", 2026)).toBe("birthday-p1-2026");
  });
});

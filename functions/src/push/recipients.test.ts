import { describe, expect, it } from "vitest";
import {
  selectRecipients,
  selectSelfRecipients,
  wantsPush,
  type PushMember,
  type SelectRecipientsInput,
} from "./recipients";

// Gruppe: Anna (beschenkt), Ben, Clara, Dora; dazu ein Mitglied ohne Identität.
const anna: PushMember = { uid: "u-anna", identityPersonId: "p-anna", notifyStack: true };
const ben: PushMember = { uid: "u-ben", identityPersonId: "p-ben", notifyStack: true };
const clara: PushMember = { uid: "u-clara", identityPersonId: "p-clara", notifyStack: true };
const dora: PushMember = { uid: "u-dora", identityPersonId: "p-dora", notifyStack: true };
const anon: PushMember = { uid: "u-anon", notifyStack: true };

const tokens: Record<string, string[]> = {
  "u-anna": ["t-anna"],
  "u-ben": ["t-ben"],
  "u-clara": ["t-clara"],
  "u-dora": ["t-dora"],
  "u-anon": ["t-anon"],
};

const sorted = (a: string[]) => [...a].sort();

function poll(overrides: Partial<SelectRecipientsInput> = {}): string[] {
  return sorted(
    selectRecipients({
      members: [anna, ben, clara, dora, anon],
      tokensByUid: tokens,
      kind: "poll",
      targetPersonIds: ["p-ben", "p-clara", "p-dora"],
      blockedPersonId: "p-anna",
      ...overrides,
    }),
  );
}

describe("wantsPush", () => {
  it("Geburtstag folgt nur notifyStack", () => {
    expect(wantsPush({ uid: "x", notifyStack: true }, "birthday")).toBe(true);
    expect(wantsPush({ uid: "x" }, "birthday")).toBe(false);
    expect(wantsPush({ uid: "x", notifyStack: false, notifyPolls: true }, "birthday")).toBe(false);
  });

  it("Abstimmungen: notifyPolls ?? notifyStack === true", () => {
    expect(wantsPush({ uid: "x", notifyStack: true }, "poll")).toBe(true);
    expect(wantsPush({ uid: "x" }, "poll")).toBe(false);
    expect(wantsPush({ uid: "x", notifyStack: true, notifyPolls: false }, "poll")).toBe(false);
    expect(wantsPush({ uid: "x", notifyStack: false, notifyPolls: true }, "poll")).toBe(true);
  });
});

describe("selectRecipients – Abstimmungen", () => {
  it("Happy-Path: alle Wahlberechtigten mit Opt-in", () => {
    expect(poll()).toEqual(["t-ben", "t-clara", "t-dora"]);
  });

  it("beschenkte Person bekommt nie etwas, auch wenn sie in der Zielgruppe steht", () => {
    expect(poll({ targetPersonIds: ["p-anna", "p-ben"] })).toEqual(["t-ben"]);
  });

  it("Mitglied ohne Identität bekommt keine Abstimmungs-Pushes", () => {
    expect(poll({ targetPersonIds: ["p-ben", ""] })).toEqual(["t-ben"]);
    const emptyIdentity: PushMember = { uid: "u-e", identityPersonId: "", notifyPolls: true };
    expect(
      selectRecipients({
        members: [emptyIdentity],
        tokensByUid: { "u-e": ["t-e"] },
        kind: "poll",
        targetPersonIds: [""],
        blockedPersonId: "p-anna",
      }),
    ).toEqual([]);
  });

  it("Token der beschenkten Person bleibt gesperrt, auch unter einer anderen UID (gleiches Gerät)", () => {
    const annaAlt: PushMember = { uid: "u-anna-alt", identityPersonId: "p-ben", notifyStack: true };
    const out = poll({
      members: [anna, annaAlt, clara],
      tokensByUid: { "u-anna": ["t-shared"], "u-anna-alt": ["t-shared", "t-ben2"], "u-clara": ["t-clara"] },
    });
    expect(out).toEqual(["t-ben2", "t-clara"]);
  });

  it("Token eines Mitglieds ohne Identität ist auch unter anderer UID gesperrt", () => {
    const out = poll({
      members: [anon, ben],
      tokensByUid: { "u-anon": ["t-shared"], "u-ben": ["t-shared", "t-ben"] },
    });
    expect(out).toEqual(["t-ben"]);
  });

  it("Sperre greift auch, wenn die beschenkte Person selbst kein Opt-in hat", () => {
    const annaOff: PushMember = { ...anna, notifyStack: false };
    const out = poll({
      members: [annaOff, ben],
      tokensByUid: { "u-anna": ["t-shared"], "u-ben": ["t-shared"] },
    });
    expect(out).toEqual([]);
  });

  it("Auslöser ist auf allen seinen Geräten ausgenommen", () => {
    const benTablet: PushMember = { uid: "u-ben-tab", identityPersonId: "p-ben", notifyStack: true };
    const out = poll({
      members: [ben, benTablet, clara],
      tokensByUid: { "u-ben": ["t-ben"], "u-ben-tab": ["t-ben-tab"], "u-clara": ["t-clara"] },
      excludePersonIds: ["p-ben"],
    });
    expect(out).toEqual(["t-clara"]);
  });

  it("Erinnerung: nur Personen ohne Stimme", () => {
    expect(poll({ requireNoVote: new Set(["p-ben", "p-dora"]) })).toEqual(["t-clara"]);
    expect(poll({ requireNoVote: new Set() })).toEqual(["t-ben", "t-clara", "t-dora"]);
  });

  it("Nicht-Wahlberechtigte bekommen nichts", () => {
    expect(poll({ targetPersonIds: ["p-clara"] })).toEqual(["t-clara"]);
  });

  it("ohne Zielgruppe bekommt bei Abstimmungen niemand etwas (fail-closed)", () => {
    expect(poll({ targetPersonIds: undefined })).toEqual([]);
    expect(poll({ targetPersonIds: [] })).toEqual([]);
  });

  it("respektiert notifyPolls=false trotz notifyStack", () => {
    const claraOff: PushMember = { ...clara, notifyPolls: false };
    expect(poll({ members: [ben, claraOff] })).toEqual(["t-ben"]);
  });

  it("dedupliziert Tokens über mehrere UIDs derselben Person", () => {
    const benOld: PushMember = { uid: "u-ben-old", identityPersonId: "p-ben", notifyStack: true };
    const out = poll({
      members: [ben, benOld],
      tokensByUid: { "u-ben": ["t-ben"], "u-ben-old": ["t-ben"] },
    });
    expect(out).toEqual(["t-ben"]);
  });

  it("Mitglied ohne Token-Doc wird übersprungen", () => {
    expect(poll({ tokensByUid: { "u-ben": ["t-ben"] } })).toEqual(["t-ben"]);
  });
});

describe("selectRecipients – Geburtstag", () => {
  const birthday = (overrides: Partial<SelectRecipientsInput> = {}) =>
    sorted(
      selectRecipients({
        members: [anna, ben, clara, anon],
        tokensByUid: tokens,
        kind: "birthday",
        blockedPersonId: "p-anna",
        ...overrides,
      }),
    );

  it("alle mit notifyStack außer der beschenkten Person; Mitglieder ohne Identität bleiben dabei", () => {
    expect(birthday()).toEqual(["t-anon", "t-ben", "t-clara"]);
  });

  it("Token der beschenkten Person unter anderer UID wird gesperrt", () => {
    expect(
      birthday({
        members: [anna, ben],
        tokensByUid: { "u-anna": ["t-shared"], "u-ben": ["t-shared", "t-ben"] },
      }),
    ).toEqual(["t-ben"]);
  });

  it("notifyPolls allein reicht nicht für Geburtstags-Pushes", () => {
    const onlyPolls: PushMember = { uid: "u-ben", identityPersonId: "p-ben", notifyPolls: true };
    expect(birthday({ members: [onlyPolls] })).toEqual([]);
  });
});

describe("selectSelfRecipients", () => {
  it("liefert die Tokens der Person selbst (alle UIDs, dedupliziert)", () => {
    const annaTab: PushMember = { uid: "u-anna-tab", identityPersonId: "p-anna", notifyStack: true };
    const out = selectSelfRecipients(
      [anna, annaTab, ben],
      { "u-anna": ["t-anna"], "u-anna-tab": ["t-anna", "t-tab"], "u-ben": ["t-ben"] },
      "p-anna",
      "birthday",
    );
    expect(sorted(out)).toEqual(["t-anna", "t-tab"]);
  });

  it("ohne Opt-in oder ohne Person: nichts", () => {
    expect(selectSelfRecipients([{ ...anna, notifyStack: false }], tokens, "p-anna", "birthday")).toEqual([]);
    expect(selectSelfRecipients([anon], tokens, "", "birthday")).toEqual([]);
  });
});

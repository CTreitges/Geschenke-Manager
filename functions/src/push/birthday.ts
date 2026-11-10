// Geburtstags-Push (30-Tage-Stack): reine Planung ohne firebase-Imports.
// Der Job in birthdayJob.ts lädt die Daten, ruft planBirthdayPushes auf,
// setzt pro Person/Jahr einen Idempotenz-Marker und sendet.

import { birthdayYearFor, daysUntil } from "../shared/dates";
import {
  selectRecipients,
  selectSelfRecipients,
  type PushMember,
} from "./recipients";

/** Toleranzfenster statt exakt Tag 30: fällt ein Lauf aus, wird nachgeholt. */
export const BIRTHDAY_PUSH_MIN_DAYS = 28;
export const BIRTHDAY_PUSH_MAX_DAYS = 30;
export const BIRTHDAY_PUSH_TTL_SECONDS = 3 * 86_400;

export interface BirthdayPerson {
  id: string;
  name: string;
  birthday: string;
}

export interface PlannedPush {
  tokens: string[];
  data: Record<string, string>;
}

export interface BirthdayPlan {
  personId: string;
  /** Marker-Doc-ID unter groups/{gid}/_push (einmal pro Person und Geburtstagsjahr). */
  markerId: string;
  /** Alle außer der beschenkten Person. */
  others: PlannedPush;
  /** Die beschenkte Person selbst (Wunschliste ergänzen). */
  self: PlannedPush;
}

/** Heutiges Datum in Europe/Vienna als lokales Date (00:00), passend zu shared/dates. */
export function viennaToday(now: Date): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA liefert YYYY-MM-DD.
  const [y, m, d] = fmt.format(now).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isBirthdayPushDue(daysLeft: number | null): boolean {
  return (
    daysLeft !== null &&
    daysLeft >= BIRTHDAY_PUSH_MIN_DAYS &&
    daysLeft <= BIRTHDAY_PUSH_MAX_DAYS
  );
}

export function birthdayMarkerId(personId: string, year: number): string {
  return `birthday-${personId}-${year}`;
}

/** Push-Daten (Data-only) für andere bzw. für die Person selbst. */
export function birthdayPushData(opts: {
  groupId: string;
  personId: string;
  name: string;
  daysLeft: number;
  self: boolean;
}): Record<string, string> {
  const { groupId, personId, name, daysLeft, self } = opts;
  const common = { groupId, personId, tag: `gm-stack-${groupId}-${personId}` };
  const groupPath = `/g/${encodeURIComponent(groupId)}`;
  if (self) {
    return {
      ...common,
      type: "birthday_self",
      title: `🎂 In ${daysLeft} Tagen hast du Geburtstag`,
      body: "Magst du deine Wunschliste ergänzen?",
      url: `${groupPath}/wishlist`,
    };
  }
  return {
    ...common,
    type: "birthday_stack",
    title: `🎂 ${name} hat in ${daysLeft} Tagen Geburtstag`,
    body: "Zeit für Ideen.",
    url: groupPath,
  };
}

/**
 * Plant die Geburtstags-Pushes einer Gruppe: fällige Personen im
 * Toleranzfenster, Empfänger ohne die beschenkte Person (auch nicht über
 * geteilte Tokens), eigene Variante für die Person selbst. Personen ohne
 * Empfänger fallen weg (dann wird auch kein Marker gesetzt).
 */
export function planBirthdayPushes(input: {
  groupId: string;
  persons: BirthdayPerson[];
  members: PushMember[];
  tokensByUid: Record<string, string[]>;
  today: Date;
}): BirthdayPlan[] {
  const { groupId, members, tokensByUid, today } = input;
  const plans: BirthdayPlan[] = [];
  for (const person of input.persons) {
    const daysLeft = daysUntil(person.birthday, today);
    const year = birthdayYearFor(person.birthday, today);
    if (!isBirthdayPushDue(daysLeft) || daysLeft === null || year === null) continue;

    const others = selectRecipients({
      members,
      tokensByUid,
      kind: "birthday",
      blockedPersonId: person.id,
    });
    const self = selectSelfRecipients(members, tokensByUid, person.id, "birthday");
    if (others.length === 0 && self.length === 0) continue;

    const base = { groupId, personId: person.id, name: person.name, daysLeft };
    plans.push({
      personId: person.id,
      markerId: birthdayMarkerId(person.id, year),
      others: { tokens: others, data: birthdayPushData({ ...base, self: false }) },
      self: { tokens: self, data: birthdayPushData({ ...base, self: true }) },
    });
  }
  return plans;
}

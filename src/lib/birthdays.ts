import type { Person, Gift } from "./types";

export const STACK_WINDOW_DAYS = 30;

function parseBD(bd: string): { month: number; day: number } {
  const parts = bd.split("-");
  if (parts.length === 3) return { month: +parts[1], day: +parts[2] };
  return { month: +parts[0], day: +parts[1] };
}

export function nextBirthday(person: Person, ref: Date = new Date()): Date {
  const { month, day } = parseBD(person.birthday);
  const year = ref.getFullYear();
  const candidate = new Date(year, month - 1, day);
  if (candidate < new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())) {
    return new Date(year + 1, month - 1, day);
  }
  return candidate;
}

export function daysUntilBirthday(person: Person, ref: Date = new Date()): number {
  const next = nextBirthday(person, ref);
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export function isInStackWindow(person: Person, ref: Date = new Date()): boolean {
  return daysUntilBirthday(person, ref) <= STACK_WINDOW_DAYS;
}

export function birthdayYearForPerson(person: Person, ref: Date = new Date()): number {
  return nextBirthday(person, ref).getFullYear();
}

export function formatBirthday(person: Person): string {
  const { month, day } = parseBD(person.birthday);
  const months = [
    "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
  ];
  return `${day}. ${months[month - 1]}`;
}

export function ageOnNextBirthday(person: Person, ref: Date = new Date()): number | null {
  const parts = person.birthday.split("-");
  if (parts.length !== 3) return null;
  const birthYear = +parts[0];
  if (!birthYear || birthYear < 1900) return null;
  return nextBirthday(person, ref).getFullYear() - birthYear;
}

export function formatTodayHeader(d: Date = new Date()): string {
  const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return `${days[d.getDay()]} · ${d.getDate()}. ${months[d.getMonth()]}`;
}

export function daysAgo(timestamp: number, ref: Date = new Date()): number {
  return Math.max(0, Math.floor((ref.getTime() - timestamp) / 86400000));
}

export function formatDaysUntil(days: number): string {
  if (days === 0) return "heute! 🎉";
  if (days === 1) return "morgen";
  if (days < 0) return `vor ${-days} Tagen`;
  return `in ${days} Tagen`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Days until a gift's relevant date — uses customDate if set, otherwise person's birthday. */
export function daysUntilForGift(g: Gift, p: Person | undefined, ref: Date = new Date()): number {
  if (g.customDate) {
    const parts = g.customDate.split("-").map(Number);
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      const [y, m, d] = parts;
      const target = new Date(y, m - 1, d);
      const today = startOfDay(ref);
      return Math.round((target.getTime() - today.getTime()) / 86400000);
    }
  }
  return p ? daysUntilBirthday(p, ref) : 9999;
}

/** Datum des Anlasses: customDate (falls gültig), sonst der nächste Geburtstag; null ohne beides. */
export function giftDate(g: Gift, p: Person | undefined, ref: Date = new Date()): Date | null {
  if (g.customDate) {
    const parts = g.customDate.split("-").map(Number);
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      const [y, m, d] = parts;
      return new Date(y, m - 1, d);
    }
  }
  return p ? nextBirthday(p, ref) : null;
}

const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** Datumszeile unter dem Geschenk-Titel: „Mi, 15. Okt · in 15 Tagen“ (customDate beachtet). */
export function giftDateLine(g: Gift, p: Person | undefined, ref: Date = new Date()): string {
  const date = giftDate(g, p, ref);
  if (!date) return "";
  const day = `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]}`;
  return `${day} · ${formatDaysUntil(daysUntilForGift(g, p, ref))}`;
}

/** Sort gifts in the stack (open + confirmed) by upcoming relevant date
 *  (nearest first). Bestätigte Geschenke bleiben im Stack — sie verschwinden
 *  erst, wenn der Status auf "received" gewechselt wird. */
export function sortStack(gifts: Gift[], persons: Person[]): Gift[] {
  const personById = Object.fromEntries(persons.map((p) => [p.id, p]));
  return [...gifts]
    .filter((g) => g.status === "open" || g.status === "confirmed")
    .sort((a, b) => {
      const da = daysUntilForGift(a, personById[a.personId]);
      const db = daysUntilForGift(b, personById[b.personId]);
      if (da !== db) return da - db;
      return a.enteredStackAt - b.enteredStackAt;
    });
}

/** Find the next person with the soonest upcoming birthday (open gift in stack OR scheduled). */
export function findHero(persons: Person[], ref: Date = new Date()): Person | null {
  if (persons.length === 0) return null;
  return [...persons].sort(
    (a, b) => daysUntilBirthday(a, ref) - daysUntilBirthday(b, ref),
  )[0];
}

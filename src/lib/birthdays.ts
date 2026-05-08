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

/** Sort open gifts by upcoming birthday (nearest first). */
export function sortStack(gifts: Gift[], persons: Person[]): Gift[] {
  const personById = Object.fromEntries(persons.map((p) => [p.id, p]));
  return [...gifts]
    .filter((g) => g.status === "open")
    .sort((a, b) => {
      const pa = personById[a.personId];
      const pb = personById[b.personId];
      const da = pa ? daysUntilBirthday(pa) : 9999;
      const db = pb ? daysUntilBirthday(pb) : 9999;
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

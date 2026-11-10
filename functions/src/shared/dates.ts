// Reine Datums-Helfer für Geburtstage. Keine Imports aus firebase-admin /
// firebase-functions: functions/src/shared wird auch vom Frontend (Alias
// "@shared") importiert.

/** Zerlegt "MM-DD" oder "YYYY-MM-DD" (Jahr wird ignoriert); null bei ungültiger Eingabe. */
export function parseBirthday(bd: string): { month: number; day: number } | null {
  const parts = bd.split("-");
  if (parts.length === 3) {
    const m = +parts[1];
    const d = +parts[2];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { month: m, day: d };
    return null;
  }
  if (parts.length === 2) {
    const m = +parts[0];
    const d = +parts[1];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { month: m, day: d };
    return null;
  }
  return null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function nextBirthdayDate(bd: string, ref: Date): Date | null {
  const parsed = parseBirthday(bd);
  if (!parsed) return null;
  const today = startOfDay(ref);
  const candidate = new Date(today.getFullYear(), parsed.month - 1, parsed.day);
  if (candidate.getTime() < today.getTime()) {
    return new Date(today.getFullYear() + 1, parsed.month - 1, parsed.day);
  }
  return candidate;
}

/** Tage bis zum nächsten Geburtstag ab dem Tag von `ref` (0 = heute); null bei ungültigem Datum. */
export function daysUntil(bd: string, ref: Date): number | null {
  const next = nextBirthdayDate(bd, ref);
  if (!next) return null;
  return Math.round((next.getTime() - startOfDay(ref).getTime()) / 86_400_000);
}

/** Jahr des nächsten Geburtstags ab `ref`; null bei ungültigem Datum. */
export function birthdayYearFor(bd: string, ref: Date): number | null {
  const next = nextBirthdayDate(bd, ref);
  return next ? next.getFullYear() : null;
}

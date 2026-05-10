export interface PatchNote {
  version: string;
  /** ISO date: YYYY-MM-DD */
  date: string;
  highlights: string[];
}

/**
 * Newest at the top. The first entry is treated as the "current" version
 * and shown prominently in the tutorial header.
 */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: "v1.3.0",
    date: "2026-05-11",
    highlights: [
      "Optional: Mit Google anmelden — Login-Screen + Einstellungen → Konto",
      "Wer Google nutzt, ist auf allen Geräten mit demselben Google-Konto automatisch in seinen Gruppen drin",
      "Anonyme Nutzung bleibt voll möglich — der Google-Login ist nur ein Add-on",
    ],
  },
  {
    version: "v1.2.0",
    date: "2026-05-11",
    highlights: [
      "Sicherheit: Daten anderer Gruppen sind ohne Passwort jetzt wirklich unzugänglich",
      "Anonyme Firebase-Anmeldung beim ersten Besuch — keine Eingabe nötig",
      "Passwörter werden serverseitig mit Salt + PBKDF2 geprüft, der Hash ist nicht mehr aus dem Browser lesbar",
      "Bestehender Login (Browser) muss einmalig nochmal Passwort eingeben",
    ],
  },
  {
    version: "v1.1.1",
    date: "2026-05-11",
    highlights: [
      "Gruppe-hinzufügen leitet jetzt zum Login statt direkt zum Erstellen",
      "Login + Erstellen-Seite zeigen oben deine gespeicherten Gruppen — ein Klick zurück, ohne Umweg",
      "Patch Notes paginiert: initial 3 Versionen, älteres lädt sich nach",
    ],
  },
  {
    version: "v1.1.0",
    date: "2026-05-11",
    highlights: [
      "Neuer Bereich in den Einstellungen: pro offenem Geschenk an-/abhaken, ob du mitmachst",
      "Patch Notes + Version/Datum oben im Tutorial sichtbar",
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-05-11",
    highlights: [
      "Mehrere Gruppen pro Browser – eigener Switcher oben rechts",
      "Gruppe komplett löschen (mit Passwort-Bestätigung) in den Einstellungen",
      "Feedback ist jetzt gruppenübergreifend – eine Inbox für alle Gruppen",
      "Tutorial auf 10 Schritte erweitert, inkl. neuem Schritt für Gruppen",
    ],
  },
  {
    version: "v0.5",
    date: "2026-05-10",
    highlights: [
      "Wunschliste im Geschenk-Detail mit Übernehmen-Knopf",
      "Zeitstempel pro Wunsch (gerade eben, vor 2 Tagen, Datum)",
      "Dark Mode ist Standard",
      "Wunschliste-Tab: Personen-Picker, falls Identität noch nicht gesetzt",
    ],
  },
  {
    version: "v0.4",
    date: "2026-05-09",
    highlights: [
      "Feedback-Tab als 5. Bottom-Nav-Eintrag",
      "Tutorial-Page mit Schritt-für-Schritt-Anleitung",
      "Auto-Stack-Duplikate-Fix + sichere Cache-Header",
    ],
  },
];

export const CURRENT_VERSION = PATCH_NOTES[0]?.version ?? "—";
export const CURRENT_DATE = PATCH_NOTES[0]?.date ?? "";

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export function formatPatchDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d}. ${MONTHS_DE[m - 1]} ${y}`;
}

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
    version: "v1.7.0",
    date: "2026-05-14",
    highlights: [
      "🆕 Neuer Zwischenstatus „bestätigt“ — Auswahl treffen, „✓ Auswahl bestätigen“ klicken, das Geschenk muss aber noch nicht erhalten sein. Im bestätigten Zustand verschwinden Wunschliste und „Idee teilen“ (Auswahl ist final), aus „Theoretische Gesamtsumme“ wird „Gesamtsumme“, und unten erscheint die Bezahler-Zeile. Jederzeit über „Bestätigung aufheben“ rückgängig",
      "🗳️ Unbegrenzte Stimmen pro Person — jede Person kann jetzt für mehrere Vorschläge gleichzeitig stimmen (Klick toggelt). Sinnvoll, wenn ihr mehrere Geschenke macht oder eure Top-3 sammeln wollt",
      "💶 Bezahler-Dropdown pro ausgewähltem Vorschlag — schon im offenen Status verfügbar mit kleinem „vorläufig“-Hinweis, im bestätigten/erhaltenen Zustand gefestigt",
      "Dezente Bezahler-Summen-Zeile unten am Geschenk: pro Person aufsummiert, wer wieviel bezahlt — erscheint ab „bestätigt“",
      "💬 Feedback ist jetzt privat: nur du selbst (und der App-Owner) sieht dein Feedback. Andere Gruppen-Mitglieder können dein Feedback weder lesen, editieren noch löschen — backend-seitig abgesichert über firestore-Rules",
      "Dialog „Wer hat was bezahlt?“ springt nach „Geschenk erhalten“ nur noch auf, wenn noch Bezahler fehlen — vorab schon alles eingetragen → direkt zurück zur Übersicht",
    ],
  },
  {
    version: "v1.6.2",
    date: "2026-05-13",
    highlights: [
      "Tutorial-Update: Hero-Intro erwähnt den neuen Install-Tip, Schritt 9 beschreibt die App-Sektion in den Einstellungen (verschwindet in der PWA, zeigt sonst Install-Button bzw. „✓ installiert“)",
    ],
  },
  {
    version: "v1.6.1",
    date: "2026-05-13",
    highlights: [
      "📲 Neuer Install-Tipp direkt nach dem Tutorial — erklärt gerätespezifisch, wie du die App auf den Startbildschirm bekommst (Chrome/Edge: ein Klick, iPhone/iPad: Safari-Teilen-Menü)",
      "Einstellungen → App: Installier-Button erscheint nur im Browser; in der installierten PWA verschwindet er, und ist sie schon installiert, zeigt der Bereich das stattdessen an",
    ],
  },
  {
    version: "v1.6.0",
    date: "2026-05-13",
    highlights: [
      "📲 App ist jetzt installierbar — auf Android über den Install-Prompt, auf iOS via Teilen → 'Zum Home-Bildschirm'. Eigenes Icon, eigener Splashscreen, läuft ohne Browser-Leiste",
      "🔔 Push-Benachrichtigungen aufs Handy: sobald jemand in den 30-Tage-Stack rutscht, kommt eine Push (Toggle in Einstellungen → Konto)",
      "Eigene Splashscreens für alle iPhone- und iPad-Modelle — App-Start ohne weißes Flackern",
      "Offline-tauglich: Daten werden lokal gecached, Multi-Tab-Sync inklusive",
      "Update-Hinweis erscheint automatisch, sobald eine neue Version live ist",
      "Hotfix: Google-Login klappt jetzt zuverlässig auch in der installierten PWA (iOS-Safari-ITP-Workaround)",
    ],
  },
  {
    version: "v1.5.0",
    date: "2026-05-12",
    highlights: [
      "Neu: Anlass + alternatives Datum pro Geschenk — z.B. Reise, Hochzeit, Jubiläum (Default bleibt Geburtstag)",
      "Neu: Gruppen-Chat-Link (WhatsApp o.ä.) pro Geschenk, wird beim nächsten Jahr automatisch übernommen",
      "Neu: Nach Geschenk-erhalten direkter Dialog Wer-hat-was-bezahlt — pro Vorschlag Dropdown aus den Teilnehmern",
      "Neu: Bezahlt-Übersicht oben im Geschenk-Detail mit Summe pro Person",
      "Neu: Alte-Geschenke-Übersicht unter dem Stack — alle erhaltenen Geschenke in chronologischer Reihenfolge",
      "Auswahl für Gesamtsumme jetzt deutlich sichtbar mit Pill „Für Gesamtsumme ausgewählt“",
      "Profil-Banner oben rechts führt direkt zum eigenen Profil",
      "Post-Tutorial-Hinweis erinnert an die Test-Mail (Kein-Spam-Trainings)",
      "Mobile-Fix: Plus-Button rutscht nicht mehr aus dem Bildschirm, kein Auto-Zoom beim Tippen",
      "Dark-Mode-Toggle funktioniert wieder zuverlässig",
    ],
  },
  {
    version: "v1.4.0",
    date: "2026-05-12",
    highlights: [
      "Neu: Geburtstags-Erinnerungen per Mail — 60 / 30 / 14 Tage vor dem Geburtstag",
      "Test-Mail-Knopf im Profil — einmal an dich schicken und in deinem Postfach als Kein-Spam markieren, damit echte Erinnerungen später sauber ankommen",
      "Folge-Erinnerungen entfallen automatisch, sobald die Person eine Wunschliste hat",
      "Klick im Mail-Link führt ohne Passwort direkt in die Wunschliste (7 Tage gültig)",
      "Unsubscribe-Link in jeder Mail; Toggle pro Person in den Profil-Einstellungen",
      "E-Mail-Adresse pro Person in Profil-Tab + beim Anlegen einer neuen Person",
    ],
  },
  {
    version: "v1.3.3",
    date: "2026-05-11",
    highlights: [
      "Tutorial aktualisiert: Google-Login und der neue Konto-Bereich in den Einstellungen sind drin",
      "Bottom-Sheet (Gruppen-Wechsler) fix — saß auf Mobile am falschen Rand",
    ],
  },
  {
    version: "v1.3.2",
    date: "2026-05-11",
    highlights: [
      "Auf neuen Geräten zeigt Google-Login automatisch deine bestehenden Gruppen — kein Passwort nötig",
      "Voraussetzung: einmal nach dem Update mit Passwort beitreten, damit dein Account als Member registriert wird (geschieht automatisch beim nächsten Login)",
    ],
  },
  {
    version: "v1.3.1",
    date: "2026-05-11",
    highlights: [
      "Google-Anmeldung sichtbar als grüner Status mit Mail-Adresse",
      "Mit-Google-abmelden-Knopf im Login-Screen und in Einstellungen → Konto",
      "Nach Google-Login wirst du direkt in deine bestehende Gruppe geführt",
    ],
  },
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

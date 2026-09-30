export interface PatchNote {
  version: string;
  /** ISO date: YYYY-MM-DD */
  date: string;
  /** Optionale Überschrift der Version (nur „Was ist neu“). */
  title?: string;
  highlights: string[];
  /** Optionaler Knopf unter den Punkten, z. B. zum Tutorial. */
  action?: { label: string; to: string };
}

/**
 * Neueste oben. Der erste Eintrag gilt als aktuelle Version: Er steht unter
 * „Was ist neu“ aufgeklappt und steuert den Neu-Punkt am „?“.
 */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: "v1.8.0",
    date: "2026-09-30",
    title: "Abstimmen mit Frist & neue Hilfe",
    highlights: [
      "🗳️ Abstimmen im eigenen Fenster: Beim Start legt ihr eine Frist fest (24 Std bis 1 Woche), danach endet die Abstimmung von selbst",
      "⏸️ Solange abgestimmt wird, sind neue Ideen pausiert – so stimmen alle über dasselbe ab",
      "🔔 Push-Nachricht, wenn eine Abstimmung startet, und eine Erinnerung, falls du noch nicht abgestimmt hast. Einstellbar unter Einstellungen → Mitteilungen",
      "🤫 Überraschungs-Schutz: Wer beschenkt wird, sieht von den Plänen nichts mehr",
      "📝 Wunschliste neu: Wünsche bearbeiten, als Herzenswunsch markieren und mit Notiz versehen. Wünsche, die andere eintragen, zeigen „notiert von …“",
      "❓ Neues Tutorial mit Bildern und ein Hilfe-Menü hinter dem „?“ oben rechts – mit häufigen Fragen",
      "🎨 Frischeres, besser lesbares Design",
    ],
    action: { label: "Tutorial ansehen", to: "/tutorial" },
  },
  {
    version: "v1.7.3",
    date: "2026-05-25",
    highlights: [
      "🔗 Teilen-Knopf pro Geschenk — Link kopieren und direkt an Mitmachende schicken (Symbol oben rechts im Geschenk-Detail)",
      "Der Link leitet direkt ins Geschenk weiter — Gruppen-ID ist vorausgefuellt, nur Passwort eingeben",
      "Beim ersten Beitritt via Link: Personen-Picker fragt sofort wer du bist, dann direkt im Geschenk",
    ],
  },
  {
    version: "v1.7.2",
    date: "2026-05-14",
    highlights: [
      "🎯 In den Einstellungen → „Wo macht … mit?“ kannst du jetzt pro Person der Gruppe einstellen, ob du bei ihren Geschenken mitmachst — nicht mehr nur für die nächsten 30 Tage. Wirkt sofort auf alle offenen und bestätigten Geschenke und gilt auch für zukünftige",
      "Die Sektion ist zusammenklappbar — zugeklappt steht nur „Bei X von Y Personen aktiv“",
      "🟢 In „Wer bin ich?“: Personen mit grünem Rahmen + Punkt sind schon von jemandem in der Gruppe gewählt — du siehst auf einen Blick, wer die App schon nutzt (gerätübergreifend)",
      "💬 Feedback-Fix: nach Google-Login kamen Feedbacks teilweise nicht durch — jetzt klappt es zuverlässig und Fehler werden direkt angezeigt",
      "Erledigte Feedbacks landen in einer aufklappbaren Sektion (zugeklappt by default)",
    ],
  },
  {
    version: "v1.7.1",
    date: "2026-05-14",
    highlights: [
      "Hotfix: bestätigte Geschenke verloren manchmal ihre Daten, wenn man kurz raus und wieder rein ging. Behoben",
      "Bestätigte Geschenke bleiben im offenen Stack — sie verschwinden erst, wenn das Geschenk als erhalten markiert wird",
    ],
  },
  {
    version: "v1.7.0",
    date: "2026-05-14",
    highlights: [
      "🆕 Neuer Zwischenstatus „bestätigt“ — Auswahl treffen, „✓ Auswahl bestätigen“ klicken. Wunschliste und „Idee teilen“ verschwinden (Auswahl ist final), aus „Theoretische Gesamtsumme“ wird „Gesamtsumme“, unten kommt die Bezahler-Zeile. „Bestätigung aufheben“ macht alles rückgängig",
      "🗳️ Unbegrenzte Stimmen pro Person — du kannst jetzt für mehrere Vorschläge gleichzeitig stimmen (Klick toggelt). Praktisch wenn ihr mehrere Geschenke macht oder eure Top-3 sammeln wollt",
      "💶 Bezahler-Dropdown pro ausgewähltem Vorschlag — schon vor „Geschenk erhalten“ einstellbar mit kleinem „vorläufig“-Hinweis",
      "Dezente Zeile unten am Geschenk: pro Person aufsummiert, wer wieviel bezahlt — erscheint ab „bestätigt“",
      "💬 Feedback ist jetzt privat: nur du selbst siehst dein eigenes Feedback. Andere Gruppen-Mitglieder können es weder lesen noch editieren",
      "Dialog „Wer hat was bezahlt?“ springt nach „Geschenk erhalten“ nur noch auf, wenn noch Bezahler fehlen",
    ],
  },
  {
    version: "v1.6.2",
    date: "2026-05-13",
    highlights: [
      "Tutorial aktualisiert: der Install-Tipp und die App-Sektion in den Einstellungen sind erklärt",
    ],
  },
  {
    version: "v1.6.1",
    date: "2026-05-13",
    highlights: [
      "📲 Install-Tipp direkt nach dem Tutorial — gerätespezifisch erklärt, wie du die App auf den Startbildschirm bekommst",
      "Einstellungen → App: Installier-Button erscheint nur im Browser; ist die App schon installiert, steht da stattdessen ein ✓",
    ],
  },
  {
    version: "v1.6.0",
    date: "2026-05-13",
    highlights: [
      "📲 App ist jetzt installierbar — eigenes Icon, eigener Splashscreen, läuft ohne Browser-Leiste",
      "🔔 Push-Benachrichtigungen aufs Handy: sobald jemand in den 30-Tage-Stack rutscht, kommt eine Push (Schalter in Einstellungen → Mitteilungen)",
      "App ist offline-tauglich — Daten bleiben lokal verfügbar",
      "Update-Hinweis erscheint automatisch, sobald eine neue Version live ist",
      "Google-Login klappt jetzt zuverlässig auch in der installierten App",
    ],
  },
  {
    version: "v1.5.0",
    date: "2026-05-12",
    highlights: [
      "Neu: Anlass + alternatives Datum pro Geschenk — z.B. Reise, Hochzeit, Jubiläum (Default bleibt Geburtstag)",
      "Neu: Gruppen-Chat-Link (WhatsApp o.ä.) pro Geschenk, wird beim nächsten Jahr automatisch übernommen",
      "Neu: Nach „Geschenk erhalten“ — Dialog, wer was bezahlt hat",
      "Neu: Bezahlt-Übersicht im Geschenk-Detail mit Summe pro Person",
      "Neu: Alte-Geschenke-Übersicht unter dem Stack — alle erhaltenen Geschenke chronologisch",
      "Ausgewählte Vorschläge sind jetzt deutlich sichtbar markiert",
      "Profil-Banner oben rechts führt direkt zu deinem eigenen Profil",
      "Mobile-Fix: Plus-Button rutscht nicht mehr aus dem Bildschirm, kein Auto-Zoom beim Tippen",
      "Dark-Mode-Toggle funktioniert wieder zuverlässig",
    ],
  },
  {
    version: "v1.4.0",
    date: "2026-05-12",
    highlights: [
      "Neu: Geburtstags-Erinnerungen per Mail — 60 / 30 / 14 Tage vor dem Geburtstag",
      "Test-Mail-Knopf im Profil — einmal an dich schicken und im Postfach als „Kein Spam“ markieren, damit echte Erinnerungen später sauber ankommen",
      "Folge-Erinnerungen entfallen automatisch, sobald die Person eine Wunschliste hat",
      "Mail-Link führt ohne Passwort direkt in die Wunschliste (7 Tage gültig)",
      "Unsubscribe-Link in jeder Mail; Toggle pro Person im Profil",
      "E-Mail-Adresse pro Person hinterlegbar",
    ],
  },
  {
    version: "v1.3.3",
    date: "2026-05-11",
    highlights: [
      "Tutorial aktualisiert: Google-Login und der Konto-Bereich in den Einstellungen sind erklärt",
      "Gruppen-Wechsler auf Mobile sitzt jetzt am richtigen Rand",
    ],
  },
  {
    version: "v1.3.2",
    date: "2026-05-11",
    highlights: [
      "Auf neuen Geräten zeigt Google-Login automatisch deine bestehenden Gruppen — kein Passwort nötig",
      "Voraussetzung: einmal nach dem Update mit Passwort beitreten, danach läuft alles automatisch",
    ],
  },
  {
    version: "v1.3.1",
    date: "2026-05-11",
    highlights: [
      "Google-Anmeldung sichtbar als grüner Status mit Mail-Adresse",
      "Abmelden-Knopf im Login-Screen und in Einstellungen → Konto",
      "Nach Google-Login landest du direkt in deiner Gruppe",
    ],
  },
  {
    version: "v1.3.0",
    date: "2026-05-11",
    highlights: [
      "Optional: Mit Google anmelden — auf dem Login-Screen oder in Einstellungen → Konto",
      "Mit Google bist du auf allen Geräten mit demselben Konto automatisch in deinen Gruppen drin",
      "Anonyme Nutzung bleibt voll möglich — Google ist nur ein Add-on",
    ],
  },
  {
    version: "v1.2.0",
    date: "2026-05-11",
    highlights: [
      "Mehr Schutz: Daten anderer Gruppen sind ohne Passwort jetzt wirklich unzugänglich",
      "Erster Besuch klappt ohne Eingabe — die App meldet sich im Hintergrund an",
      "Passwörter sind sicherer geprüft — auch über die Browser-Tools nicht mehr lesbar",
      "Bestehender Login muss einmalig nochmal Passwort eingeben",
    ],
  },
  {
    version: "v1.1.1",
    date: "2026-05-11",
    highlights: [
      "Gruppe-hinzufügen leitet jetzt zum Login statt direkt zum Erstellen",
      "Login + Erstellen-Seite zeigen oben deine gespeicherten Gruppen — ein Klick zurück, ohne Umweg",
      "Patch-Notes laden Stück für Stück — älteres erst auf Klick",
    ],
  },
  {
    version: "v1.1.0",
    date: "2026-05-11",
    highlights: [
      "Neuer Bereich in den Einstellungen: pro offenem Geschenk an-/abhaken, ob du mitmachst",
      "Patch-Notes + Version/Datum oben im Tutorial sichtbar",
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-05-11",
    highlights: [
      "Mehrere Gruppen pro Browser — eigener Wechsler oben rechts",
      "Gruppe komplett löschen (mit Passwort-Bestätigung) in den Einstellungen",
      "Feedback ist gruppenübergreifend — eine Inbox für alle Gruppen",
      "Tutorial auf 10 Schritte erweitert",
    ],
  },
  {
    version: "v0.5",
    date: "2026-05-10",
    highlights: [
      "Wunschliste im Geschenk-Detail mit „Übernehmen“-Knopf",
      "Zeitstempel pro Wunsch („gerade eben“, „vor 2 Tagen“, Datum)",
      "Dark Mode ist Standard",
      "Wunschliste-Tab: Personen-Picker direkt im Tab, falls Identität noch nicht gesetzt",
    ],
  },
  {
    version: "v0.4",
    date: "2026-05-09",
    highlights: [
      "Feedback-Tab als 5. Eintrag in der Bottom-Nav",
      "Tutorial mit Schritt-für-Schritt-Anleitung",
      "Stack zeigt keine Doppel-Einträge mehr",
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

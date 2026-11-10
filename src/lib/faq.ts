// Häufige Fragen (/help): das Detailwissen des alten 10-Schritte-Tutorials,
// knapp und in Nutzersprache. Jede Antwort höchstens 3 Sätze (faq.test.ts).

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export const FAQ: FaqEntry[] = [
  {
    id: "zweites-geraet",
    question: "Wie komme ich auf einem zweiten Gerät rein?",
    answer:
      "Gib dort einfach Gruppen-ID und Passwort ein. Bequemer geht es mit „Mit Google anmelden“: Dann erscheinen deine Gruppen auf jedem Gerät mit demselben Google-Konto von selbst. Ohne Google funktioniert die App genauso.",
  },
  {
    id: "gruppen",
    question: "Wie wechsle, entferne oder lösche ich eine Gruppe?",
    answer:
      "Tipp oben auf den Gruppennamen: Dort wechselst du die Gruppe oder entfernst sie aus deiner Liste – die Daten bleiben dabei erhalten. Eine Gruppe endgültig löschen geht nur in den Einstellungen und braucht das Gruppen-Passwort. Dabei verschwinden alle Personen, Geschenke und Wunschlisten der Gruppe.",
  },
  {
    id: "wer-bin-ich",
    question: "Warum soll ich „Wer bist du?“ festlegen?",
    answer:
      "Damit Stimmen und Wünsche dir gehören – und damit der Spoiler-Schutz greift: Nur wenn die App weiß, wer du bist, kann sie die Pläne für dein Geschenk vor dir verbergen. Du wählst dich einmal pro Gruppe aus der Personenliste aus. Ändern kannst du das jederzeit in den Einstellungen.",
  },
  {
    id: "mail-erinnerungen",
    question: "Wie funktionieren die Mail-Erinnerungen?",
    answer:
      "Ist bei einer Person eine E-Mail hinterlegt, bekommt sie 60, 30 und 14 Tage vor dem Geburtstag eine Erinnerung an ihre Wunschliste – Folge-Erinnerungen entfallen, solange eigene Wünsche aus den letzten 4 Monaten darauf stehen. Schick nach dem Eintragen einmal eine Test-Mail und markiere sie als „Kein Spam“, damit die echten Erinnerungen sicher ankommen. Der Link in der Mail führt ohne Passwort direkt in die Wunschliste, abbestellen geht in jeder Mail.",
  },
  {
    id: "push",
    question: "Wie bekomme ich Push-Nachrichten?",
    answer:
      "Installiere die App auf deinem Startbildschirm und schalte unter Einstellungen → Mitteilungen „Geburtstage“ und „Abstimmungen“ ein. Auf dem iPhone kommen Push-Nachrichten nur in der installierten App an. Mit „Test-Push senden“ prüfst du, ob alles klappt.",
  },
  {
    id: "phasen",
    question: "Was bedeuten Ideen, Abstimmung, Entschieden und Erhalten?",
    answer:
      "Das sind die Phasen eines Geschenks: Erst sammelt ihr Ideen, dann stimmt ihr mit Frist ab und legt fest, was ihr schenkt. Eine Entscheidung lässt sich bei Bedarf wieder ändern. Ist alles überreicht, markiert ihr das Geschenk als erhalten – es wandert dann zu „Alte Geschenke“.",
  },
  {
    id: "bezahlt",
    question: "Wie halten wir fest, wer was bezahlt hat?",
    answer:
      "Sobald ihr entschieden habt, wählt ihr bei jeder ausgewählten Idee, wer sie bezahlt hat. Unten im Geschenk steht dann die Summe pro Person. Bis das Geschenk als erhalten markiert ist, bleibt alles änderbar.",
  },
  {
    id: "nachtragen",
    question: "Kann ich ein Geschenk nachtragen oder zwei im selben Jahr planen?",
    answer:
      "Ja: Über das + auf der Übersicht legst du ein Geschenk von Hand an – auch für ein vergangenes Jahr oder einen anderen Anlass wie eine Hochzeit. Zum Geburtstag erscheint jede Person 30 Tage vorher von selbst.",
  },
  {
    id: "stimmen-sichtbar",
    question: "Sehen andere, wofür ich gestimmt habe?",
    answer:
      "Ja, bewusst: Stimmen sind für alle Teilnehmenden sichtbar, das macht die Wahl nachvollziehbar. Du kannst mehrere Ideen wählen und deine Stimmen ändern, solange die Abstimmung läuft. Nur die beschenkte Person sieht davon nichts.",
  },
  {
    id: "feedback",
    question: "Wer sieht mein Feedback?",
    answer:
      "Nur du und der App-Betreuer. Andere aus deiner Gruppe können es weder lesen noch ändern. Eigenes Feedback kannst du jederzeit bearbeiten, löschen oder als erledigt markieren.",
  },
  {
    id: "keine-admins",
    question: "Warum gibt es keine Admins?",
    answer:
      "Die App setzt auf Vertrauen: Wer das Gruppen-Passwort kennt, darf alles – Rollen und Rechte braucht es unter Freunden nicht. „Wer bist du?“ ist deshalb eine Auswahl und kein Login. Andere Gruppen bleiben trotzdem abgeschottet: Ohne ihr Passwort kommt niemand hinein.",
  },
];

import type { ComponentType } from "react";
import { IllBirthdays, IllInstall, IllSpoiler, IllVote, IllWelcome, IllWishes } from "./illustrations";

// Inhalte der Tutorial-Seiten (Titel ≤ 5 Wörter, Text ≤ 2 kurze Sätze).
// Reihenfolge und Texte laut Spezifikation A5.

export type TutorialPageId = "welcome" | "birthdays" | "wishes" | "vote" | "spoiler" | "install";

export interface TutorialPage {
  id: TutorialPageId;
  title: string;
  body: string;
  /** Bildbeschreibung (aria-label der Illustration). */
  alt: string;
  Ill: ComponentType<{ alt: string }>;
}

export interface TutorialPageContext {
  /** Seite 6 nur im Browser und nie installiert gewesen. */
  showInstall: boolean;
  /** Ohne Identität bittet Seite 5 darum, sich gleich auszuwählen. */
  hasIdentity: boolean;
}

export function tutorialPages({ showInstall, hasIdentity }: TutorialPageContext): TutorialPage[] {
  const pages: TutorialPage[] = [
    {
      id: "welcome",
      title: "Geschenke gemeinsam planen",
      body: "Eure Gruppe sammelt Ideen, stimmt ab und schenkt zusammen. Ganz ohne Chaos im Gruppenchat.",
      alt: "Ein Geschenk in der Mitte, vier Freunde als farbige Kreise drumherum, mit gestrichelten Linien verbunden.",
      Ill: IllWelcome,
    },
    {
      id: "birthdays",
      title: "Kein Geburtstag verpasst",
      body: "30 Tage vorher erscheint die Person auf der Übersicht. Eine Push-Nachricht sagt dir Bescheid.",
      alt: "Handy mit einer Liste anstehender Geburtstage, darüber eine Benachrichtigung der App. Daneben ein Kalenderblatt mit markiertem Tag und eine Glocke.",
      Ill: IllBirthdays,
    },
    {
      id: "wishes",
      title: "Wünsche und Ideen",
      body: "Jeder pflegt seine Wunschliste. Im Geschenk übernehmt ihr Wünsche oder sammelt eigene Ideen.",
      alt: "Links eine Wunschliste, ein lila Pfeil trägt einen Wunsch in die Ideenliste rechts. Darüber drei Teilnehmer und ein Budget-Symbol.",
      Ill: IllWishes,
    },
    {
      id: "vote",
      title: "Gemeinsam abstimmen",
      body: "Startet eine Abstimmung mit Frist. Bis sie endet, sind neue Ideen pausiert.",
      alt: "Handy mit geöffnetem Abstimmungsfenster: drei Ideen mit Ergebnisbalken und Häkchen, oben ein Frist-Ring. Daneben eine Ideen-Karte mit Pause-Zeichen.",
      Ill: IllVote,
    },
    {
      id: "spoiler",
      title: "Keine Spoiler für dich",
      body: hasIdentity
        ? "Was die anderen für dich planen, bleibt für dich unsichtbar. Deine eigene Wunschliste siehst du natürlich."
        : "Was die anderen für dich planen, bleibt für dich unsichtbar. Sag uns gleich, wer du bist.",
      alt: "Eine Geschenk-Karte für dich ist verdeckt, in der Mitte ein Schild mit geschlossenem Auge. Links und rechts tuscheln zwei Freunde in Sprechblasen.",
      Ill: IllSpoiler,
    },
  ];
  if (showInstall) {
    pages.push({
      id: "install",
      title: "Hol dir die App",
      body: "Vom Startbildschirm startet sie wie eine App. Auf dem iPhone kommen Push-Nachrichten nur so an.",
      alt: "Startbildschirm eines Handys: Das Geschenk-Symbol der App wird hinzugefügt und zeigt einen Benachrichtigungs-Punkt.",
      Ill: IllInstall,
    });
  }
  return pages;
}

// Empfänger-Auswahl für Web-Push. REIN (keine firebase-Imports), damit sie
// ohne Emulator testbar ist. Fail-closed: im Zweifel bekommt jemand KEINEN
// Push — ein fehlender Push ist harmlos, ein Spoiler nicht.

export type PushKind = "birthday" | "poll";

export interface PushMember {
  uid: string;
  /** "Wer bin ich?"-Identität; leer/fehlend = keine Identität gewählt. */
  identityPersonId?: string;
  notifyStack?: boolean;
  notifyPolls?: boolean;
}

export interface SelectRecipientsInput {
  members: PushMember[];
  /** FCM-Tokens je UID (pushTokens/{uid}). Ein Gerät kann unter mehreren UIDs stehen. */
  tokensByUid: Record<string, string[]>;
  kind: PushKind;
  /**
   * Personen, die den Push bekommen dürfen (z. B. Wahlberechtigte eines
   * Geschenks). Fehlt die Liste: bei "birthday" keine Einschränkung, bei
   * "poll" bekommt niemand etwas (fail-closed).
   */
  targetPersonIds?: string[];
  /** Beschenkte Person: bekommt nie etwas, ihre Tokens sind auch unter anderen UIDs gesperrt. */
  blockedPersonId: string;
  /** Auslöser (z. B. wer die Abstimmung gestartet hat) — auf allen Geräten ausgenommen. */
  excludePersonIds?: string[];
  /**
   * Personen-IDs, die schon abgestimmt haben. Ist das Set gesetzt, bekommen
   * nur Personen OHNE Stimme den Push (Erinnerung).
   */
  requireNoVote?: Set<string>;
}

/** Opt-in je Push-Art. Abstimmungen erben den Geburtstags-Schalter, solange nie explizit gesetzt. */
export function wantsPush(member: PushMember, kind: PushKind): boolean {
  if (kind === "birthday") return member.notifyStack === true;
  return member.notifyPolls ?? member.notifyStack === true;
}

function identityOf(member: PushMember): string {
  return typeof member.identityPersonId === "string" ? member.identityPersonId : "";
}

/**
 * Liefert die deduplizierten Tokens, an die gesendet werden darf.
 *
 * Gesperrt werden alle Tokens von Mitgliedern mit Identität == beschenkter
 * Person — auch wenn derselbe Token (= dasselbe Gerät) zusätzlich unter einer
 * anderen UID liegt. Bei Abstimmungen gilt dasselbe für Mitglieder ohne
 * Identität (könnte die beschenkte Person sein).
 */
export function selectRecipients(input: SelectRecipientsInput): string[] {
  const { members, tokensByUid, kind, blockedPersonId } = input;
  const tokensOf = (uid: string): string[] => tokensByUid[uid] ?? [];

  const blocked = new Set<string>();
  for (const m of members) {
    const id = identityOf(m);
    const isGiftee = id !== "" && id === blockedPersonId;
    const unknownInPoll = kind === "poll" && id === "";
    if (isGiftee || unknownInPoll) tokensOf(m.uid).forEach((t) => blocked.add(t));
  }

  const targets =
    input.targetPersonIds !== undefined
      ? new Set(input.targetPersonIds)
      : kind === "poll"
        ? new Set<string>() // fail-closed: ohne Zielgruppe keine Abstimmungs-Pushes
        : null;
  const excluded = new Set(input.excludePersonIds ?? []);

  const out = new Set<string>();
  for (const m of members) {
    const id = identityOf(m);
    if (id !== "" && id === blockedPersonId) continue;
    if (kind === "poll" && id === "") continue;
    if (targets && !targets.has(id)) continue;
    if (id !== "" && excluded.has(id)) continue;
    if (input.requireNoVote && input.requireNoVote.has(id)) continue;
    if (!wantsPush(m, kind)) continue;
    for (const t of tokensOf(m.uid)) {
      if (!blocked.has(t)) out.add(t);
    }
  }
  return [...out];
}

/**
 * Tokens der Mitglieder, die sich als `personId` ausgewiesen haben und den
 * Push dieser Art wollen (z. B. „In 30 Tagen hast du Geburtstag“).
 * Dedupliziert.
 */
export function selectSelfRecipients(
  members: PushMember[],
  tokensByUid: Record<string, string[]>,
  personId: string,
  kind: PushKind,
): string[] {
  const out = new Set<string>();
  if (!personId) return [];
  for (const m of members) {
    if (identityOf(m) !== personId || !wantsPush(m, kind)) continue;
    (tokensByUid[m.uid] ?? []).forEach((t) => out.add(t));
  }
  return [...out];
}

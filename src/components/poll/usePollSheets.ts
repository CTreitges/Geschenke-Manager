import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  autoPollSheet,
  linkedPollSheet,
  markPrompted,
  openPollSheetKind,
  resultPromptKey,
  votePromptKey,
  wasPrompted,
  type PollSheetKind,
} from "@/lib/pollPrompts";
import type { Gift, ID, Poll } from "@/lib/types";
import { usePollSheetUrl } from "./usePollSheetUrl";

/**
 * Welches Abstimmungs-Sheet gerade offen ist (VoteSheet oder Ergebnis) –
 * gesteuert über `?vote=1`: Deeplink (Push, Home-Chip) übernehmen oder
 * verwerfen, einmal pro Runde automatisch öffnen und schließen, wenn es
 * nichts mehr zu zeigen gibt. Die Art folgt der Phase: läuft die Wahl →
 * VoteSheet, ist sie vorbei → Ergebnis (so wechselt ein offenes Sheet von
 * selbst in die Ergebnisansicht).
 */
export function usePollSheets({
  gift,
  poll,
  ideaIds,
  myId,
  groupId,
  now,
  suspended = false,
}: {
  gift: Gift;
  poll: Poll | undefined;
  ideaIds: readonly ID[];
  myId: ID | null;
  groupId: string | null;
  now: number;
  /** true = gerade ist ein anderes Sheet offen → nicht automatisch darüber öffnen. */
  suspended?: boolean;
}): { kind: PollSheetKind | null; open: () => void; close: () => void } {
  const url = usePollSheetUrl();
  const { key: locationKey } = useLocation();
  const kind = openPollSheetKind(gift, poll, now);
  const round = poll?.startedAt;
  const ctx = { gift, poll, myId, now };
  const linked = linkedPollSheet(ctx);

  // Pro History-Eintrag höchstens eine automatische Navigation (StrictMode
  // ruft Effekte doppelt auf, die Location ist dann noch dieselbe).
  const navigatedFrom = useRef<string | null>(null);
  const once = (tag: string, run: () => void) => {
    const key = `${locationKey}|${tag}|${round}`;
    if (navigatedFrom.current === key) return;
    navigatedFrom.current = key;
    run();
  };

  // Einmal pro Runde von selbst öffnen.
  const auto =
    !suspended && !url.open && !url.linkPending && groupId && round !== undefined
      ? autoPollSheet({
          ...ctx,
          ideaIds,
          votePrompted: wasPrompted(votePromptKey(groupId, gift.id, round)),
          resultPrompted: wasPrompted(resultPromptKey(groupId, gift.id, round)),
        })
      : null;

  useEffect(() => {
    // `?vote=1` von außen: übernehmen, wenn es für mich etwas zu tun gibt, sonst still entfernen.
    if (url.linkPending) once("link", linked ? url.adoptLink : url.dropLink);
    // Offen, aber nichts mehr zu zeigen (verworfen, entschieden) → schließen.
    else if (url.open && !kind) once("close", url.closeSheet);
    else if (auto) once(`auto-${auto}`, url.openSheet);
    // Nur auf Zustandswechsel reagieren; die Callbacks ändern sich mit jeder Location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url.linkPending, url.open, linked, kind, auto, locationKey]);

  // Was ich gesehen habe, gilt für diese Runde als „gefragt“.
  useEffect(() => {
    if (!url.open || !kind || !groupId || round === undefined) return;
    markPrompted(kind === "vote" ? votePromptKey(groupId, gift.id, round) : resultPromptKey(groupId, gift.id, round));
  }, [url.open, kind, groupId, gift.id, round]);

  return { kind: url.open ? kind : null, open: url.openSheet, close: url.closeSheet };
}

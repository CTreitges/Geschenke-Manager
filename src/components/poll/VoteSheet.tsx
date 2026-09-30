import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatEndsAt, formatRemaining } from "@shared/poll";
import { Button, Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { enablePushForGroup, usePushState } from "@/lib/messaging";
import type { PollModel } from "@/lib/pollModel";
import { markPushAsked, shouldAskPush } from "@/lib/pollPrompts";
import { countdown, voteChangeToast, votersLine } from "@/lib/pollView";
import { clearMyVotes, setMyVote } from "@/lib/storage";
import type { Person, Suggestion } from "@/lib/types";
import { normalizeUrl } from "@/lib/url";
import { ChoiceRow } from "./ChoiceRow";
import { PollOptionsMenu } from "./PollOptionsMenu";
import { VoterAvatars } from "./VoterAvatars";

// ── VoteSheet: das Abstimmungs-PopUp ──────────────────────────
// Ein Tipp setzt die Stimme sofort (optimistisch, kurzes Vibrieren), ohne
// Toast. Fehler → toast.error und Rücksetzen. Beim Schließen ein
// Sammel-Toast, aber nur wenn sich etwas geändert hat. Offen-Zustand steht
// in der URL (`?vote=1`) → kein eigener History-Eintrag.
export function VoteSheet({
  open,
  onClose,
  giftId,
  recipientName,
  model,
  ideas,
  personsById,
  myId,
  now,
  groupId,
}: {
  open: boolean;
  onClose: () => void;
  giftId: string;
  recipientName: string;
  model: PollModel;
  ideas: readonly Suggestion[];
  personsById: Record<string, Person>;
  myId: string | null;
  now: number;
  groupId: string | null;
}) {
  // suggestionId → gewünschter Zustand, solange der Schreibvorgang läuft.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [askPush, setAskPush] = useState(false);
  const { state: pushState } = usePushState(open ? groupId : null);

  // Sammel-Toast: Stand beim Öffnen merken, beim Schließen vergleichen
  // (auch wenn das Sheet per Zurück-Taste über den Router zugeht).
  const latestRef = useRef(model.myVotes);
  latestRef.current = model.myVotes;
  const beforeRef = useRef<string[] | null>(null);
  useEffect(() => {
    if (open) {
      beforeRef.current = latestRef.current;
      return;
    }
    const before = beforeRef.current;
    beforeRef.current = null;
    if (!before) return;
    const msg = voteChangeToast(before, latestRef.current);
    if (msg) toast.success(msg);
  }, [open]);

  useEffect(() => {
    if (open && groupId) setAskPush(shouldAskPush(groupId, pushState, Date.now()));
  }, [open, groupId, pushState]);

  const mine = new Set(model.myVotes);
  const isOn = (sid: string) => pending[sid] ?? mine.has(sid);
  const chosen = ideas.filter((s) => isOn(s.id)).length;

  function toggle(sid: string) {
    if (!myId || !model.canVote) return;
    const on = !isOn(sid);
    navigator.vibrate?.(10);
    setPending((p) => ({ ...p, [sid]: on }));
    setMyVote(giftId, myId, sid, on)
      .catch(() => toast.error("Stimme nicht gespeichert – bitte nochmal tippen"))
      .finally(() =>
        setPending((p) => {
          const next = { ...p };
          delete next[sid];
          return next;
        }),
      );
  }

  function clearAll() {
    if (!myId) return;
    clearMyVotes(giftId, myId).catch(() => toast.error("Zurücknehmen hat nicht geklappt – bitte nochmal"));
  }

  function answerPush(yes: boolean) {
    if (!groupId) return;
    markPushAsked(groupId, Date.now());
    setAskPush(false);
    if (!yes) return;
    // Direkt aus dem Tap: iOS fragt die Berechtigung nur in der Nutzergeste.
    enablePushForGroup(groupId)
      .then(() => toast.success("Mitteilungen sind an"))
      .catch((e: Error) => toast.error(e.message || "Mitteilungen ließen sich nicht einschalten"));
  }

  const eligiblePeople = model.eligible.map((id) => personsById[id]).filter((p): p is Person => !!p);
  const votedSet = new Set(model.eligible.filter((id) => !model.voters.missing.includes(id)));
  const missingNames = model.voters.missing.map((id) => personsById[id]?.name ?? "?");
  const cd = model.endsAt !== null ? countdown(model.endsAt, now) : null;
  const anyLink = ideas.some((s) => normalizeUrl(s.url));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      history={false}
      title={`Abstimmung · für ${recipientName}`}
      footer={
        <>
          <Button size="lg" className="w-full" onClick={onClose}>
            {chosen > 0 ? `Fertig · ${chosen} gewählt` : "Fertig"}
          </Button>
          <div className="mt-1 flex items-center justify-between">
            {chosen > 0 && model.canVote ? (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Alle zurücknehmen
              </Button>
            ) : (
              <span />
            )}
            {model.canVote && <PollOptionsMenu giftId={giftId} model={model} myId={myId} showLabel />}
          </div>
        </>
      }
    >
      <div className="space-y-2.5">
        <p className={cn("m-0 text-meta font-semibold", cd?.urgent ? "text-status-vote" : "text-fg-soft")}>
          {model.endsAt !== null && cd
            ? `⏱ ${formatEndsAt(model.endsAt, now)} · ${cd.over ? "beendet" : formatRemaining(model.endsAt - now)}`
            : "⏱ ohne Frist"}
        </p>
        <div className="flex items-center gap-2.5">
          <VoterAvatars people={eligiblePeople} voted={votedSet} size={26} />
          <span className="text-meta text-fg-soft">
            {votersLine(model.voters.voted, model.voters.total, missingNames)}
          </span>
        </div>
        <div>
          <p className="m-0 text-body font-semibold text-fg">Tippe alles an, was du gut findest.</p>
          <p className="m-0 text-meta text-fg-muted">Mehrfachwahl · Stimmen sind für alle sichtbar</p>
        </div>
        {!model.canVote && (
          <p className="m-0 rounded-tile bg-surface-2 px-3 py-2 text-meta text-fg-soft">
            Abstimmen können nur eingetragene Teilnehmer.
          </p>
        )}
      </div>

      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {ideas.map((s) => (
          <ChoiceRow
            key={s.id}
            idea={s}
            author={personsById[s.suggestedBy]}
            pressed={isOn(s.id)}
            disabled={!model.canVote}
            onToggle={() => toggle(s.id)}
            voters={(model.counts[s.id] ?? []).map((id) => personsById[id]).filter((p): p is Person => !!p)}
            votedTotal={model.voters.voted}
            reserveLink={anyLink}
          />
        ))}
      </ul>

      {askPush && (
        <div className="mt-3 rounded-card bg-accent-soft p-3.5">
          <p className="m-0 text-meta font-semibold text-fg">
            🔔 Soll ich dir Bescheid geben, wenn eine Abstimmung startet?
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" onClick={() => answerPush(true)}>
              Ja
            </Button>
            <Button size="sm" variant="ghost" onClick={() => answerPush(false)}>
              Später
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

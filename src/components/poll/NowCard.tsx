import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useRequireIdentity } from "@/components/IdentitySheet";
import { Button, Confetti, Icon, useConfirm, type PhaseKey } from "@/components/ui";
import { PayerChips } from "@/components/gift/PayerChips";
import { PayerTotalsLine } from "@/components/gift/PayerTotalsLine";
import { cn } from "@/lib/cn";
import type { PollModel } from "@/lib/pollModel";
import { startPollBlocker } from "@/lib/pollOps";
import { countdown, endedLine, resultHeadline, selectionSummary, voterNames, votersLine } from "@/lib/pollView";
import { addParticipant, discardPoll, extendPoll, unconfirmGift } from "@/lib/storage";
import type { Gift, Person, Poll, Suggestion } from "@/lib/types";
import { PollOptionsMenu } from "./PollOptionsMenu";
import { VoterAvatars } from "./VoterAvatars";

const DAY = 86_400_000;

const TONE: Record<PhaseKey, string> = {
  ideas: "border-l-status-open",
  voting: "border-l-status-vote",
  decided: "border-l-status-done",
  received: "border-l-status-received",
};

function Shell({
  tone,
  title,
  children,
  celebrate = false,
}: {
  tone: PhaseKey;
  title: ReactNode;
  children: ReactNode;
  celebrate?: boolean;
}) {
  return (
    <section
      aria-label="Jetzt"
      className={cn(
        "relative overflow-hidden rounded-card border border-l-4 border-line-subtle bg-surface p-4 shadow-card",
        TONE[tone],
      )}
    >
      <Confetti active={celebrate} />
      <h2 className="m-0 text-body font-bold text-fg">{title}</h2>
      <div className="mt-2 space-y-2.5">{children}</div>
    </section>
  );
}

function Reason({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 flex items-center gap-1.5 text-meta text-fg-muted">
      <Lock size={14} aria-hidden className="shrink-0" />
      {children}
    </p>
  );
}

type NowCardProps = {
  gift: Gift;
  poll: Poll | undefined;
  model: PollModel;
  ideas: readonly Suggestion[];
  personsById: Record<string, Person>;
  myId: string | null;
  now: number;
  startBlocker: string | null;
  celebrate: boolean;
  onStart: () => void;
  onOpenVote: () => void;
  onOpenDecision: () => void;
  onDirectDecide: () => void;
  onMarkReceived: () => void;
  onEditPayments: () => void;
};

// ── Jetzt-Karte: genau eine Karte mit dem nächsten Schritt pro Phase ──
export function NowCard(props: NowCardProps) {
  const { gift, poll, model } = props;
  if (model.isRecipient) {
    // Spoiler-Schutz: keine Details für die beschenkte Person.
    return (
      <Shell tone="ideas" title="🤫 Überraschung läuft">
        <p className="m-0 text-meta text-fg-soft">Hier wird gerade etwas für dich geplant.</p>
      </Shell>
    );
  }
  if (gift.status === "received") return <ReceivedNow {...props} />;
  if (gift.status === "confirmed") return <DecidedNow {...props} />;
  if (poll && model.phase === "running") return <VotingNow {...props} poll={poll} />;
  if (poll && (model.phase === "expired" || model.phase === "closed")) return <ResultNow {...props} poll={poll} />;
  return <IdeasNow {...props} />;
}

function IdeasNow({ gift, ideas, myId, startBlocker, onStart, onDirectDecide }: NowCardProps) {
  const n = ideas.length;
  const requireIdentity = useRequireIdentity();
  // Ohne Identität erst „Wer bist du?“ – danach geht es direkt weiter.
  const blocked = !!myId && !!startBlocker;

  async function start() {
    if (myId) return onStart();
    const id = await requireIdentity({ recipientId: gift.personId, reason: "Damit alle sehen, wer die Abstimmung startet." });
    if (!id) return;
    const blocker = startPollBlocker(gift, n, id);
    if (blocker) toast.message(blocker);
    else onStart();
  }

  return (
    <Shell tone="ideas" title={n === 0 ? "💡 Noch keine Ideen" : `💡 ${n} ${n === 1 ? "Idee" : "Ideen"} gesammelt`}>
      <p className="m-0 text-meta text-fg-soft">Sammelt Ideen und stimmt dann gemeinsam ab – oder entscheidet direkt.</p>
      <Button size="lg" className="w-full" disabled={blocked} onClick={() => void start()}>
        <Icon.vote /> Abstimmung starten
      </Button>
      {blocked && <Reason>{startBlocker}</Reason>}
      {n > 0 && myId && (
        <Button variant="ghost" size="sm" className="w-full" onClick={onDirectDecide}>
          Direkt entscheiden
        </Button>
      )}
    </Shell>
  );
}

function VotingNow({ gift, poll, model, personsById, myId, now, onOpenVote }: NowCardProps & { poll: Poll }) {
  const cd = model.endsAt !== null ? countdown(model.endsAt, now) : null;
  const eligiblePeople = model.eligible.map((id) => personsById[id]).filter((p): p is Person => !!p);
  const voted = new Set(model.eligible.filter((id) => !model.voters.missing.includes(id)));
  const missingNames = voterNames(model.voters.missing, personsById, myId);
  const starter = poll.startedBy ? personsById[poll.startedBy] : undefined;
  const startedBy = starter ? ` · gestartet von ${starter.name}` : "";
  const mine = model.myVotes.length;
  const requireIdentity = useRequireIdentity();

  async function chooseIdentity() {
    const id = await requireIdentity({ recipientId: gift.personId, reason: "Damit deine Stimme dir zugeordnet wird." });
    if (id && gift.participantIds.includes(id)) onOpenVote();
  }

  async function join() {
    if (!myId) return;
    try {
      await addParticipant(gift.id, myId);
      onOpenVote();
    } catch {
      toast.error("Eintragen hat nicht geklappt – bitte nochmal");
    }
  }

  return (
    <Shell
      tone="voting"
      title={
        <span className={cn(cd?.urgent && "text-status-vote")}>⏱ Abstimmung läuft · {cd ? cd.text : "ohne Frist"}</span>
      }
    >
      <div className="flex items-center gap-2.5">
        <VoterAvatars people={eligiblePeople} voted={voted} />
        <span className="text-meta text-fg-soft">
          {votersLine(model.voters.voted, model.voters.total, missingNames)}
        </span>
      </div>
      {model.canVote ? (
        <>
          <p className={cn("m-0 text-meta", mine === 0 ? "font-semibold text-status-vote" : "text-fg-muted")}>
            {mine === 0 ? "Du hast noch nicht abgestimmt" : `Du hast ${mine} gewählt`}
            {startedBy}
          </p>
          <div className="flex items-center gap-1">
            <Button size="lg" className="flex-1" onClick={onOpenVote}>
              {mine === 0 ? "Jetzt abstimmen" : "Stimmen ändern"}
            </Button>
            <PollOptionsMenu giftId={gift.id} model={model} myId={myId} />
          </div>
        </>
      ) : myId ? (
        <>
          <p className="m-0 text-meta text-fg-muted">Du machst bei diesem Geschenk noch nicht mit{startedBy}.</p>
          <Button size="lg" variant="secondary" className="w-full" onClick={join}>
            Mitmachen & abstimmen
          </Button>
        </>
      ) : (
        <>
          <p className="m-0 text-meta text-fg-muted">Wähle erst, wer du bist, um mitzustimmen{startedBy}.</p>
          <Button size="lg" variant="secondary" className="w-full" aria-haspopup="dialog" onClick={() => void chooseIdentity()}>
            Wer bist du?
          </Button>
        </>
      )}
    </Shell>
  );
}

function ResultNow({ gift, poll, model, ideas, personsById, myId, now, onOpenDecision }: NowCardProps & { poll: Poll }) {
  const confirm = useConfirm();
  const result = model.result ?? { kind: "empty" as const };
  const titleOf = (id: string) => ideas.find((s) => s.id === id)?.title ?? "?";
  const nameOf = (id: string) => personsById[id]?.name;
  const requireIdentity = useRequireIdentity();

  async function decide() {
    if (myId) return onOpenDecision();
    const id = await requireIdentity({ recipientId: gift.personId, reason: "Damit alle sehen, wer entschieden hat." });
    if (id) onOpenDecision();
  }

  async function extend() {
    try {
      await extendPoll(gift.id, DAY);
      toast.success("Abstimmung läuft einen Tag länger");
    } catch {
      toast.error("Verlängern hat nicht geklappt – bitte nochmal");
    }
  }

  async function discard() {
    const ok = await confirm({
      title: "Abstimmung verwerfen?",
      body: "Alle Stimmen dieser Runde gehen verloren. Die Ideen bleiben.",
      confirmLabel: "Verwerfen",
      tone: "danger",
    });
    if (!ok) return;
    discardPoll(gift.id)
      .then(() => toast.success("Abstimmung verworfen"))
      .catch(() => toast.error("Verwerfen hat nicht geklappt – bitte nochmal"));
  }

  return (
    <Shell tone="voting" title={resultHeadline(result, titleOf)}>
      <p className="m-0 text-meta text-fg-muted">
        {endedLine(poll, now, nameOf)} · {model.voters.voted} von {model.voters.total} haben abgestimmt
      </p>
      <Button size="lg" className="w-full" onClick={() => void decide()}>
        <Icon.check /> Entscheidung festlegen
      </Button>
      <div className="flex justify-center gap-1">
        <Button variant="ghost" size="sm" onClick={extend}>
          Verlängern
        </Button>
        <Button variant="ghost" size="sm" className="text-danger" onClick={discard}>
          Verwerfen
        </Button>
      </div>
    </Shell>
  );
}

function selectedOf(gift: Gift, ideas: readonly Suggestion[]): Suggestion[] {
  const ids = gift.selectedSuggestionIds ?? [];
  return ideas.filter((s) => ids.includes(s.id));
}

function DecidedNow({ gift, ideas, personsById, celebrate, onMarkReceived }: NowCardProps) {
  const selected = selectedOf(gift, ideas);
  const participants = gift.participantIds.map((id) => personsById[id]).filter((p): p is Person => !!p);

  function reopen() {
    unconfirmGift(gift.id)
      .then(() => toast.success("Entscheidung aufgehoben"))
      .catch(() => toast.error("Das hat nicht geklappt – bitte nochmal"));
  }

  return (
    <Shell tone="decided" title="✓ Entschieden" celebrate={celebrate}>
      <p className="m-0 text-meta font-semibold text-fg-soft">
        {selectionSummary(selected, participants.filter((p) => p.id !== gift.personId).length)}
      </p>
      {selected.length === 0 && <p className="m-0 text-meta text-fg-muted">Ohne ausgewählte Idee entschieden.</p>}
      {selected.map((s) => (
        <div key={s.id} className="space-y-1.5 border-t border-line-subtle pt-2.5">
          <p className="m-0 text-body font-semibold text-fg">{s.title}</p>
          <p className="m-0 text-meta text-fg-muted">Wer hat bezahlt?</p>
          <PayerChips suggestion={s} participants={participants} />
        </div>
      ))}
      <Button size="lg" className="w-full" onClick={onMarkReceived}>
        <Icon.check /> Als erhalten markieren
      </Button>
      <Button variant="ghost" size="sm" className="w-full" onClick={reopen}>
        Entscheidung ändern
      </Button>
    </Shell>
  );
}

function ReceivedNow({ gift, ideas, personsById, onEditPayments }: NowCardProps) {
  const selected = selectedOf(gift, ideas);
  const participantCount = gift.participantIds.filter((id) => id !== gift.personId).length;
  return (
    <Shell tone="received" title="🎁 Erhalten">
      <p className="m-0 text-meta text-fg-soft">
        {selected.length ? selected.map((s) => s.title).join(", ") : "Ohne ausgewählte Idee abgeschlossen."}
      </p>
      {selected.length > 0 && (
        <p className="m-0 text-meta font-semibold text-fg-soft">{selectionSummary(selected, participantCount)}</p>
      )}
      <PayerTotalsLine selectedSuggestions={selected} personsById={personsById} />
      {selected.length > 0 && (
        <Button variant="ghost" size="sm" className="w-full" onClick={onEditPayments}>
          💶 Wer hat bezahlt?
        </Button>
      )}
    </Shell>
  );
}

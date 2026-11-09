import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { effectiveEndsAt } from "@shared/poll";
import { Button, EmptyState, Icon, IconButton, PageHeader, PhaseStepper, useConfirm, type PhaseKey } from "@/components/ui";
import { whenHistorySettled } from "@/components/ui/sheetStack";
import { GiftMenu } from "@/components/gift/GiftMenu";
import { GiftSkeleton } from "@/components/gift/GiftSkeleton";
import { IdeasSection } from "@/components/gift/IdeasSection";
import { ParticipantsSection } from "@/components/gift/ParticipantsSection";
import { PaymentDialog } from "@/components/gift/PaymentDialog";
import { ShareDialog } from "@/components/gift/ShareDialog";
import { WhatsappLinkSection } from "@/components/gift/WhatsappLinkSection";
import { DecisionSheet } from "@/components/poll/DecisionSheet";
import { NowCard } from "@/components/poll/NowCard";
import { StartSheet } from "@/components/poll/StartSheet";
import { IdentityGate } from "@/components/surprise/IdentityGate";
import { SurpriseScreen } from "@/components/surprise/SurpriseScreen";
import { usePollSheets } from "@/components/poll/usePollSheets";
import { VoteSheet } from "@/components/poll/VoteSheet";
import { GiftWishlist } from "@/components/wishlist/WishAdoptSheet";
import { useGroupId } from "@/lib/auth";
import { giftDate, giftDateLine } from "@/lib/birthdays";
import { withLiveParticipants } from "@/lib/cascade";
import { useMyId, useStore } from "@/lib/hooks";
import { isIdentitySkipped, skipIdentity } from "@/lib/identity";
import { useBack } from "@/lib/nav";
import { giftPhase } from "@/lib/giftPhase";
import { decidedBudgetLine } from "@/lib/money";
import { pollModel } from "@/lib/pollModel";
import { lockMessage, startPollBlocker } from "@/lib/pollOps";
import { markPrompted, votePromptKey } from "@/lib/pollPrompts";
import { sortIdeas } from "@/lib/pollView";
import { surprisePhase } from "@/lib/spoiler";
import { markReceived, startPoll } from "@/lib/storage";
import type { Gift, Person } from "@/lib/types";
import { useNow } from "@/lib/useNow";

// ── Geschenkseite ─────────────────────────────────────────────
// Kopf „Anna · Geburtstag“ + Datum, Phasen-Stepper, Jetzt-Karte mit dem
// nächsten Schritt, Ideen (mit Wunschliste-Streifen), Organisation. Abstimmen und
// Entscheiden passieren in Sheets (src/components/poll/).
export default function GiftDetail() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const back = useBack("/");
  const nav = useNavigate();
  const myId = useMyId();
  const groupId = useGroupId();
  const [skippedNow, setSkippedNow] = useState(false);
  const found = store.gifts.find((g) => g.id === id);
  // Gezählt wird nur, wer noch existiert (verwaiste Teilnehmer aus Altbeständen).
  const gift = found && withLiveParticipants(found, new Set(store.persons.map((p) => p.id)));
  const person = store.persons.find((p) => p.id === gift?.personId);
  const hydrated = store.giftsHydrated && store.personsHydrated && store.suggestionsHydrated && store.pollsHydrated;

  // Bis alle Daten da sind: Platzhalter statt „nicht gefunden“ (B28).
  if (!hydrated) return <GiftSkeleton onBack={back} />;
  if (!gift || !person) {
    return (
      <div>
        <PageHeader onBack={back} title="Geschenk" />
        <EmptyState
          emoji="🎁"
          title="Geschenk nicht gefunden"
          subtitle="Vielleicht wurde es gerade gelöscht."
          action={<Button onClick={() => nav("/", { replace: true })}>Zur Übersicht</Button>}
        />
      </div>
    );
  }
  // Ab hier keine Hooks mehr (Early-Returns). Spoiler-Schutz: die beschenkte
  // Person sieht nur die Überraschungs-Ansicht.
  const surprise = surprisePhase(gift, myId);
  if (surprise !== "none") return <SurpriseScreen gift={gift} person={person} phase={surprise} onBack={back} />;
  // Ohne Identität zuerst fragen – außer „nur ansehen“ gilt schon. Auch bei
  // erhaltenen Geschenken: Preise, Bezahler und nicht gewählte Ideen bleiben
  // der beschenkten Person verborgen.
  const skipped = skippedNow || isIdentitySkipped(groupId);
  if (!myId && !skipped) {
    return (
      <IdentityGate
        recipientId={gift.personId}
        received={gift.status === "received"}
        onBack={back}
        onSkip={() => {
          skipIdentity(groupId);
          setSkippedNow(true);
        }}
      />
    );
  }
  return <GiftView key={gift.id} gift={gift} person={person} onBack={back} />;
}

function GiftView({ gift, person, onBack }: { gift: Gift; person: Person; onBack: () => void }) {
  const { persons, suggestions, polls } = useStore();
  const myId = useMyId();
  const groupId = useGroupId();
  const nav = useNavigate();
  const confirm = useConfirm();
  const poll = polls.find((p) => p.giftId === gift.id);
  const now = useNow(30_000, effectiveEndsAt(poll));

  const ideas = useMemo(() => sortIdeas(suggestions.filter((s) => s.giftId === gift.id)), [suggestions, gift.id]);
  const personsById = useMemo(() => Object.fromEntries(persons.map((p) => [p.id, p])), [persons]);
  const model = pollModel(gift, poll, ideas, myId, now);
  const totalBudget = gift.participantIds.length * gift.budgetPerPerson;
  const decidedTotal = gift.status !== "open" ? giftPhase(gift, poll, ideas, myId, now).total : undefined;
  const selectionLine =
    decidedTotal === undefined
      ? undefined
      : decidedBudgetLine(decidedTotal, gift.participantIds.filter((id) => id !== gift.personId).length, totalBudget);

  const [startOpen, setStartOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const sheets = usePollSheets({
    gift,
    poll,
    ideaIds: ideas.map((s) => s.id),
    myId,
    groupId,
    now,
    // Solange ein eigenes Sheet offen ist, nichts automatisch darüber öffnen.
    suspended: startOpen || directOpen || paymentOpen || shareOpen,
  });

  // Nach dem eigenen Start öffnet das VoteSheet, sobald das Start-Sheet samt
  // History-Eintrag weg ist; nach „Neu starten“ umgekehrt das Start-Sheet.
  const voteAfterStart = useRef(false);
  useEffect(() => {
    if (startOpen || !voteAfterStart.current) return;
    voteAfterStart.current = false;
    void whenHistorySettled().then(sheets.open);
  }, [startOpen, sheets.open]);
  const startAfterClose = useRef(false);
  useEffect(() => {
    if (sheets.kind || !startAfterClose.current) return;
    startAfterClose.current = false;
    setStartOpen(true);
  }, [sheets.kind]);
  // Nach „erhalten“ + Bezahler-Sheet zurück zur Übersicht.
  const homeAfterPayment = useRef(false);
  useEffect(() => {
    if (paymentOpen || !homeAfterPayment.current) return;
    homeAfterPayment.current = false;
    void whenHistorySettled().then(() => nav("/"));
  }, [paymentOpen, nav]);

  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(false), 3500);
    return () => clearTimeout(t);
  }, [celebrate]);

  const selected = ideas.filter((s) => (gift.selectedSuggestionIds ?? []).includes(s.id));
  const participants = gift.participantIds.map((pid) => personsById[pid]).filter((p): p is Person => !!p);
  const occasion = gift.occasion || "Geburtstag";
  const startBlocker = startPollBlocker(gift, ideas.length, myId);
  const adoptBlocked = model.locks.adoptWish.locked ? lockMessage("adoptWish") : null;
  const step: PhaseKey =
    gift.status === "received" ? "received" : gift.status === "confirmed" ? "decided" : model.phase === "none" ? "ideas" : "voting";

  async function start(durationMs: number) {
    if (!myId) return;
    try {
      const round = await startPoll(gift.id, { durationMs, startedBy: myId });
      // Das VoteSheet öffnet gleich ausdrücklich – nicht nochmal automatisch.
      if (groupId) markPrompted(votePromptKey(groupId, gift.id, round));
      voteAfterStart.current = true;
      setStartOpen(false);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Starten hat nicht geklappt – bitte nochmal");
    }
  }

  function decided(close: () => void) {
    close();
    setCelebrate(true);
    toast.success("Entschieden ✓");
  }

  async function receive() {
    const ok = await confirm({
      title: `Geschenk für ${person.name} als erhalten markieren?`,
      body: "Danach ist es abgeschlossen und verschwindet aus der Übersicht.",
      confirmLabel: "Erhalten",
    });
    if (!ok) return;
    try {
      await markReceived(gift.id, myId);
    } catch {
      toast.error("Das hat nicht geklappt – bitte nochmal");
      return;
    }
    toast.success("Geschenk erhalten ✓");
    if (selected.some((s) => !s.paidBy)) {
      homeAfterPayment.current = true;
      setPaymentOpen(true);
    } else nav("/");
  }

  return (
    <div>
      <PageHeader
        onBack={onBack}
        title={`${person.name} · ${occasion}`}
        subtitle={giftDateLine(gift, person)}
        right={
          <div className="flex items-center">
            <IconButton label="Link teilen" onClick={() => setShareOpen(true)}>
              <Icon.share size={18} />
            </IconButton>
            <GiftMenu
              gift={gift}
              personName={person.name}
              ideaCount={ideas.length}
              model={model}
              myId={myId}
              onShare={() => setShareOpen(true)}
            />
          </div>
        }
      />

      {!model.isRecipient && <PhaseStepper current={step} className="px-4 pb-4" />}

      <div className="px-4 pb-5">
        <NowCard
          gift={gift}
          poll={poll}
          model={model}
          ideas={ideas}
          personsById={personsById}
          myId={myId}
          now={now}
          startBlocker={startBlocker}
          celebrate={celebrate}
          onStart={() => setStartOpen(true)}
          onOpenVote={sheets.open}
          onOpenDecision={sheets.open}
          onDirectDecide={() => setDirectOpen(true)}
          onMarkReceived={() => void receive()}
          onEditPayments={() => setPaymentOpen(true)}
        />
      </div>

      <IdeasSection
        gift={gift}
        ideas={ideas}
        model={model}
        personsById={personsById}
        myId={myId}
        onOpenVote={sheets.open}
        wishStrip={
          gift.status === "open" && <GiftWishlist gift={gift} person={person} myId={myId} lockReason={adoptBlocked} />
        }
      />

      <ParticipantsSection
        gift={gift}
        persons={persons}
        me={myId ? personsById[myId] : undefined}
        totalBudget={totalBudget}
        selectionLine={selectionLine}
      />
      <WhatsappLinkSection gift={gift} />
      <div className="pb-24" />

      <StartSheet
        open={startOpen}
        onClose={() => setStartOpen(false)}
        recipientName={person.name}
        occasion={occasion}
        occasionDate={giftDate(gift, person)}
        ideaCount={ideas.length}
        eligibleCount={model.eligible.length}
        blocker={startBlocker}
        onStart={start}
      />
      <VoteSheet
        open={sheets.kind === "vote"}
        onClose={sheets.close}
        giftId={gift.id}
        recipientName={person.name}
        model={model}
        ideas={ideas}
        personsById={personsById}
        myId={myId}
        now={now}
        groupId={groupId}
      />
      <DecisionSheet
        open={sheets.kind === "decision"}
        onClose={sheets.close}
        history={false}
        mode="result"
        gift={gift}
        recipientName={person.name}
        poll={poll}
        model={model}
        ideas={ideas}
        personsById={personsById}
        myId={myId}
        now={now}
        onRestart={() => {
          startAfterClose.current = true;
          sheets.close();
        }}
        onDecided={() => decided(sheets.close)}
      />
      <DecisionSheet
        open={directOpen}
        onClose={() => setDirectOpen(false)}
        mode="direct"
        gift={gift}
        recipientName={person.name}
        poll={poll}
        model={model}
        ideas={ideas}
        personsById={personsById}
        myId={myId}
        now={now}
        onDecided={() => decided(() => setDirectOpen(false))}
      />
      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        selectedSuggestions={selected}
        participants={participants}
      />
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} giftId={gift.id} personName={person.name} />
    </div>
  );
}

import { Button, Icon } from "@/components/ui";
import { closePoll, discardPoll, extendPoll, startPoll } from "@/lib/storage";
import { toast } from "sonner";
import type { Gift, Poll, Suggestion } from "@/lib/types";
import { ClosedPollSummary } from "./ClosedPollSummary";
import { Section } from "./Section";

// ── Abstimmung (starten / läuft / beendet) ────────────────────
export function PollSection({
  gift,
  poll,
  myId,
  pollStatus,
  giftSuggestions,
  voteTally,
  totalVotes,
  winnerId,
  onOpenDetails,
  onAdoptWinner,
}: {
  gift: Gift;
  poll: Poll | undefined;
  myId: string | null;
  pollStatus: Poll["status"] | "none";
  giftSuggestions: Suggestion[];
  voteTally: Record<string, string[]>;
  totalVotes: number;
  winnerId: string | null;
  onOpenDetails: () => void;
  onAdoptWinner: () => void;
}) {
  return (
    <Section title="Abstimmung">
      {pollStatus === "none" && (
        <div className="text-center py-1">
          <Button
            onClick={() => {
              if (giftSuggestions.length === 0) {
                toast.error("Erst Vorschläge anlegen");
                return;
              }
              if (!myId) {
                toast.error("Wähle erst, wer du bist");
                return;
              }
              startPoll(gift.id, { durationMs: 48 * 3_600_000, startedBy: myId })
                .then(() => toast.success("Abstimmung gestartet"))
                .catch((e: Error) => toast.error(e.message));
            }}
            className="w-full"
          >
            <Icon.vote /> Abstimmung starten
          </Button>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 leading-snug">
            Jede Person kann beliebig viele Vorschläge wählen. Stimmen sind sichtbar.
          </p>
        </div>
      )}

      {pollStatus === "active" && (
        <div>
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2.5 bg-violet-100 dark:bg-violet-950"
          >
            <span className="text-lg">🗳️</span>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-violet-800 dark:text-violet-300">
                Abstimmung läuft
              </div>
              <div className="text-xs text-violet-700/80 dark:text-violet-400/80">
                {Object.keys(poll?.votes ?? {}).filter(
                  (pid) => (poll?.votes[pid]?.length ?? 0) > 0,
                ).length}
                {" "}von {gift.participantIds.length} haben abgestimmt
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              closePoll(gift.id, { closedBy: myId, reason: "manual" });
              toast.success("Abstimmung beendet");
            }}
            className="w-full"
          >
            Abstimmung beenden
          </Button>
        </div>
      )}

      {pollStatus === "closed" && (
        <ClosedPollSummary
          poll={poll!}
          tally={voteTally}
          totalVotes={totalVotes}
          winnerId={winnerId}
          suggestions={giftSuggestions}
          onOpenDetails={onOpenDetails}
          onAdoptWinner={onAdoptWinner}
          onReopen={() => {
            if (confirm("Abstimmung wieder öffnen? Bestehende Stimmen bleiben erhalten.")) {
              extendPoll(gift.id, 24 * 3_600_000);
              toast.success("Abstimmung erneut geöffnet");
            }
          }}
          onClear={() => {
            if (confirm("Abstimmung komplett verwerfen? Stimmen gehen verloren.")) {
              discardPoll(gift.id);
              toast.success("Abstimmung verworfen");
            }
          }}
        />
      )}
    </Section>
  );
}

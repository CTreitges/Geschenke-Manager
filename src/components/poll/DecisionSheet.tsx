import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Icon, Sheet, useConfirm } from "@/components/ui";
import type { PollModel } from "@/lib/pollModel";
import { competitionRanks, endedLine, initialDecisionSelection, resultHeadline, selectionSummary } from "@/lib/pollView";
import { decideGift, discardPoll, extendPoll } from "@/lib/storage";
import type { Gift, Person, Poll, Suggestion } from "@/lib/types";
import { normalizeUrl } from "@/lib/url";
import { ChoiceRow } from "./ChoiceRow";

const DAY = 86_400_000;

// ── Entscheidungs-Sheet ───────────────────────────────────────
// Ersetzt Ergebnis-Zusammenfassung, Details-Dialog, „Gewinner übernehmen“
// und „Auswahl bestätigen“. mode "result": nach einer Abstimmung (Sieger
// vorausgewählt, bestehende Auswahl bleibt); mode "direct": ohne Abstimmung.
// „Entscheidung festlegen“ = EIN Batch (decideGift).
export function DecisionSheet({
  open,
  onClose,
  mode,
  gift,
  recipientName,
  poll,
  model,
  ideas,
  personsById,
  myId,
  now,
  history = true,
  onRestart,
  onDecided,
}: {
  open: boolean;
  onClose: () => void;
  mode: "result" | "direct";
  gift: Gift;
  recipientName: string;
  poll: Poll | undefined;
  model: PollModel;
  ideas: readonly Suggestion[];
  personsById: Record<string, Person>;
  myId: string | null;
  now: number;
  /** false, wenn der Offen-Zustand in der URL steht (`?vote=1`). */
  history?: boolean;
  onRestart?: () => void;
  onDecided: () => void;
}) {
  const confirm = useConfirm();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const result = mode === "result" ? model.result : null;

  // Vorauswahl: Sieger + bestehende Auswahl, neu bei jedem Öffnen und bei
  // neuem Ergebnis (später Snapshot, neue Runde) – nach einem eigenen Tipp
  // gehört die Auswahl dem Nutzer.
  const touched = useRef(false);
  const resultKey = JSON.stringify(result);
  useEffect(() => {
    if (!open) {
      touched.current = false;
      return;
    }
    if (touched.current) return;
    setSelected(initialDecisionSelection(result, gift.selectedSuggestionIds ?? [], ideas.map((s) => s.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, poll?.startedAt, resultKey]);

  const byId = new Map(ideas.map((s) => [s.id, s]));
  const ordered =
    mode === "result"
      ? model.ranked.map((r) => byId.get(r.id)).filter((s): s is Suggestion => !!s)
      : [...ideas];
  const ranks = competitionRanks(ordered.map((s) => ({ votes: model.counts[s.id]?.length ?? 0 })));
  const selectedIdeas = ordered.filter((s) => selected.includes(s.id));
  const anyLink = ordered.some((s) => normalizeUrl(s.url));
  const titleOf = (id: string) => byId.get(id)?.title ?? "?";
  const nameOf = (id: string) => personsById[id]?.name;

  function toggle(id: string) {
    touched.current = true;
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function decide() {
    setBusy(true);
    try {
      await decideGift(gift.id, selected, myId);
      onDecided();
    } catch {
      toast.error("Festlegen hat nicht geklappt – bitte nochmal");
    } finally {
      setBusy(false);
    }
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
    try {
      await discardPoll(gift.id);
      onClose();
      toast.success("Abstimmung verworfen");
    } catch {
      toast.error("Verwerfen hat nicht geklappt – bitte nochmal");
    }
  }

  const participantCount = gift.participantIds.filter((id) => id !== gift.personId).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      history={history}
      title={`${mode === "result" ? "Ergebnis" : "Direkt entscheiden"} · für ${recipientName}`}
      footer={
        <>
          <p className="m-0 mb-2 text-meta font-semibold text-fg-soft">
            {selectionSummary(selectedIdeas, participantCount)}
          </p>
          <Button size="lg" className="w-full" disabled={selected.length === 0 || !myId} loading={busy} onClick={decide}>
            <Icon.check /> Entscheidung festlegen
          </Button>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Später
            </Button>
            {mode === "result" && poll && (
              <>
                <Button variant="ghost" size="sm" onClick={extend}>
                  Verlängern
                </Button>
                <Button variant="ghost" size="sm" className="text-danger" onClick={discard}>
                  Verwerfen
                </Button>
              </>
            )}
          </div>
        </>
      }
    >
      {result && poll ? (
        <div className="space-y-1.5">
          <p className="m-0 text-lg font-bold text-fg">{resultHeadline(result, titleOf)}</p>
          <p className="m-0 text-meta text-fg-muted">
            {endedLine(poll, now, nameOf)} · {model.voters.voted} von {model.voters.total} haben abgestimmt
          </p>
          {result.kind === "tie" && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  touched.current = true;
                  setSelected((cur) => [...new Set([...cur, ...result.ids])]);
                }}
              >
                {result.ids.length === 2 ? "Beide nehmen" : "Alle nehmen"}
              </Button>
              <span className="text-meta text-fg-muted">oder unten selbst wählen</span>
            </div>
          )}
          {result.kind === "empty" && (
            <div className="flex flex-wrap gap-2 pt-1">
              {onRestart && (
                <Button variant="secondary" size="sm" onClick={onRestart}>
                  Neu starten
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-danger" onClick={discard}>
                Verwerfen
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="m-0 text-meta text-fg-muted">
          Wählt aus, was ihr kauft – ohne Abstimmung. Mehrere Ideen sind möglich.
        </p>
      )}

      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {ordered.map((s, i) => (
          <ChoiceRow
            key={s.id}
            idea={s}
            author={personsById[s.suggestedBy]}
            pressed={selected.includes(s.id)}
            onToggle={() => toggle(s.id)}
            rank={mode === "result" ? ranks[i] : undefined}
            winner={result?.kind === "winner" && result.id === s.id}
            voters={
              mode === "result"
                ? (model.counts[s.id] ?? []).map((id) => personsById[id]).filter((p): p is Person => !!p)
                : undefined
            }
            votedTotal={model.voters.voted}
            reserveLink={anyLink}
          />
        ))}
      </ul>
      {ordered.length === 0 && <p className="m-0 mt-3 text-meta text-fg-muted">Noch keine Ideen.</p>}
    </Sheet>
  );
}

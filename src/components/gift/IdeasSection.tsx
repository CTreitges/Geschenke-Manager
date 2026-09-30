import { toast } from "sonner";
import { Button, EmptyState, Section } from "@/components/ui";
import type { PollModel } from "@/lib/pollModel";
import { PollLockedError } from "@/lib/pollOps";
import { deleteSuggestion, restoreSuggestion, updateSuggestion } from "@/lib/storage";
import type { Gift, Person, Suggestion } from "@/lib/types";
import { SuggestionAdder } from "./SuggestionAdder";
import { SuggestionCard } from "./SuggestionCard";

function errorText(e: unknown, fallback: string): string {
  return e instanceof PollLockedError ? e.message : fallback;
}

// ── Ideen: Liste (stabil sortiert) + Eingabe bzw. Sperr-Hinweis ─
export function IdeasSection({
  gift,
  ideas,
  model,
  personsById,
  myId,
  onOpenVote,
}: {
  gift: Gift;
  ideas: readonly Suggestion[];
  model: PollModel;
  personsById: Record<string, Person>;
  myId: string | null;
  onOpenVote: () => void;
}) {
  const locked = model.locks.addIdea.locked;
  const editable = gift.status === "open" && !locked;
  const showVotes = model.phase !== "none";
  const winnerId = model.result?.kind === "winner" ? model.result.id : null;
  const selectedIds = gift.selectedSuggestionIds ?? [];

  async function remove(s: Suggestion) {
    try {
      await deleteSuggestion(s.id);
      toast.success("Idee gelöscht", {
        action: {
          label: "Rückgängig",
          onClick: () => {
            restoreSuggestion(s).catch(() => toast.error("Wiederherstellen hat nicht geklappt"));
          },
        },
      });
    } catch (e) {
      toast.error(errorText(e, "Löschen hat nicht geklappt – bitte nochmal"));
    }
  }

  function save(s: Suggestion, patch: Partial<Suggestion>) {
    updateSuggestion(s.id, patch).catch((e) => toast.error(errorText(e, "Speichern hat nicht geklappt – bitte nochmal")));
  }

  return (
    <Section title="Ideen" count={ideas.length} hint={locked ? "🔒 pausiert" : undefined}>
      {ideas.length === 0 ? (
        <EmptyState emoji="💡" title="Noch keine Ideen" />
      ) : (
        <div className="mb-2.5 flex flex-col gap-2">
          {ideas.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              author={personsById[s.suggestedBy]}
              voters={
                showVotes
                  ? (model.counts[s.id] ?? []).map((id) => personsById[id]).filter((p): p is Person => !!p)
                  : undefined
              }
              winner={s.id === winnerId}
              selected={selectedIds.includes(s.id)}
              editable={editable}
              onOpen={model.canVote ? onOpenVote : undefined}
              onSave={(patch) => save(s, patch)}
              onDelete={() => void remove(s)}
            />
          ))}
        </div>
      )}
      {gift.status === "open" &&
        (locked ? (
          <div className="rounded-card border border-line-subtle bg-surface-2 p-3.5">
            <p className="m-0 text-meta text-fg-soft">
              🔒 Neue Ideen sind pausiert, bis die Abstimmung endet – damit alle über dasselbe abstimmen.
            </p>
            {model.canVote && (
              <div className="mt-2 flex justify-end">
                <Button variant="secondary" size="sm" onClick={onOpenVote}>
                  Abstimmung öffnen
                </Button>
              </div>
            )}
          </div>
        ) : (
          <SuggestionAdder giftId={gift.id} recipientId={gift.personId} myId={myId} />
        ))}
    </Section>
  );
}

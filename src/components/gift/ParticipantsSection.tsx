import { Avatar, Icon, Section } from "@/components/ui";
import { setAllParticipants, toggleParticipant } from "@/lib/storage";
import { pickColor } from "@/lib/colors";
import type { Gift, Person } from "@/lib/types";
import { BudgetEditor } from "./BudgetEditor";
import { ParticipantBulkButtons } from "./ParticipantBulkButtons";

// ── Teilnehmer + Budget ───────────────────────────────────────
export function ParticipantsSection({
  gift,
  persons,
  me,
  totalBudget,
}: {
  gift: Gift;
  persons: Person[];
  me: Person | undefined;
  totalBudget: number;
}) {
  return (
    <Section
      title="Teilnehmer"
      hint={`${gift.participantIds.length} dabei`}
      action={
        <ParticipantBulkButtons
          personIds={persons.filter((p) => p.id !== gift.personId).map((p) => p.id)}
          participantIds={gift.participantIds}
          onSet={(ids) => setAllParticipants(gift.id, ids)}
        />
      }
    >
      {!me && (
        <div className="mb-2.5 rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent-text">
          Wähle in den Einstellungen, wer du bist, bevor du teilnimmst oder abstimmst.
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {persons
          .filter((p) => p.id !== gift.personId)
          .map((p) => {
            const joined = gift.participantIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleParticipant(gift.id, p.id)}
                className="inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-meta font-semibold transition-colors"
                style={
                  joined
                    ? {
                        background: `linear-gradient(135deg, ${p.color || pickColor(p.id)}, ${(p.color || pickColor(p.id))}dd)`,
                        color: "#fff",
                        border: "1px solid transparent",
                      }
                    : { background: "transparent" }
                }
              >
                <Avatar person={p} size={22} />
                {p.name}
                {joined && <Icon.check size={14} className="ml-0.5" />}
              </button>
            );
          })}
      </div>
      <BudgetEditor gift={gift} totalBudget={totalBudget} />
    </Section>
  );
}

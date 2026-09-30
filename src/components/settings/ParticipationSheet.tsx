import { Avatar, Sheet, Switch } from "@/components/ui";
import { daysUntilBirthday, formatBirthday } from "@/lib/birthdays";
import { setDefaultParticipation } from "@/lib/storage";
import type { Person } from "@/lib/types";

/** Personen, bei deren Geschenken `me` standardmäßig mitmacht. */
export function participationCount(persons: readonly Person[], meId: string): { active: number; total: number } {
  const others = persons.filter((p) => p.id !== meId);
  return {
    active: others.filter((p) => (p.defaultParticipantIds ?? []).includes(meId)).length,
    total: others.length,
  };
}

/** „Wo mache ich mit?“: pro Person die Standard-Teilnahme an- und abhaken. */
export function ParticipationSheet({
  open,
  onClose,
  me,
  persons,
}: {
  open: boolean;
  onClose: () => void;
  me: Person;
  persons: readonly Person[];
}) {
  const others = persons.filter((p) => p.id !== me.id);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Wo mache ich mit?"
      description="Setzt deine Standard-Teilnahme. Wirkt sofort auf alle offenen und entschiedenen Geschenke der Person."
    >
      {others.length === 0 ? (
        <p className="m-0 py-3 text-meta text-fg-muted">Noch keine anderen Personen in der Gruppe.</p>
      ) : (
        <ul className="m-0 list-none p-0 pb-2">
          {others.map((p) => {
            const on = p.defaultParticipantIds?.includes(me.id) ?? false;
            const days = daysUntilBirthday(p);
            return (
              <li key={p.id} className="flex items-center gap-3 border-t border-line-subtle py-2 first:border-t-0">
                <Avatar person={p} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{p.name}</span>
                  <span className="mt-0.5 block text-xs text-fg-muted">
                    {formatBirthday(p)}
                    {days >= 0 ? ` · in ${days} T.` : ""}
                  </span>
                </span>
                <Switch
                  label={`Bei ${p.name} mitmachen`}
                  checked={on}
                  onChange={() => void setDefaultParticipation(p.id, me.id, !on)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

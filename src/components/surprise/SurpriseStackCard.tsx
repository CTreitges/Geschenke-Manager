import { Avatar, Icon } from "@/components/ui";
import { giftDateLine } from "@/lib/birthdays";
import type { Gift, Person } from "@/lib/types";

/**
 * Stack-Karte meines eigenen Geschenks: nur „Du · Datum“ und „Überraschung
 * läuft“ – keine Teilnehmer, Summe, Status oder Löschen. Tipp → Wunschliste.
 */
export function SurpriseStackCard({ gift, person, onOpen }: { gift: Gift; person: Person; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-card border border-line-subtle bg-surface py-3.5 pl-3 pr-3 text-left shadow-card active:scale-[0.99]"
    >
      <Avatar person={person} size={42} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold tracking-tight text-fg">
          Du <span className="font-medium text-fg-muted">· {giftDateLine(gift, person)}</span>
        </span>
        <span className="mt-0.5 block text-xs font-semibold text-accent-text">🤫 Überraschung läuft</span>
      </span>
      <Icon.chev className="shrink-0 text-fg-muted" />
    </button>
  );
}

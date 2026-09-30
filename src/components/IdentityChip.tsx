import { Link } from "react-router-dom";
import { useStore } from "@/lib/hooks";
import { useIdentity } from "@/lib/auth";
import { useIdentityPrompt } from "./IdentitySheet";
import { Avatar } from "./ui";

// Header-Chip: sichtbar 32 px hoch wie Gruppe und „?“, Trefferfläche 44 px.
export function IdentityChip() {
  const { persons } = useStore();
  const id = useIdentity();
  const { open } = useIdentityPrompt();
  const me = persons.find((p) => p.id === id);
  if (!me) {
    // Ohne Identität auch auf dem Handy mit Text – öffnet das IdentitySheet.
    return (
      <button type="button" onClick={() => void open()} aria-haspopup="dialog" className="inline-flex min-h-tap shrink-0 items-center">
        <span className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-xs font-semibold text-accent-text shadow-sm">
          <span aria-hidden className="hidden text-sm leading-none min-[400px]:inline">
            👋
          </span>
          Wer bist du?
        </span>
      </button>
    );
  }
  return (
    <Link
      to={`/person/${me.id}`}
      className="inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center"
      aria-label={`Mein Profil (${me.name})`}
      title={`Mein Profil (${me.name})`}
    >
      <span className="inline-flex h-8 max-w-[140px] items-center gap-2 rounded-full sm:border sm:border-line sm:bg-surface sm:pl-0.5 sm:pr-3 sm:shadow-sm">
        <Avatar person={me} size={28} />
        <span className="hidden truncate text-xs font-semibold text-fg-soft sm:inline">Ich: {me.name}</span>
      </span>
    </Link>
  );
}

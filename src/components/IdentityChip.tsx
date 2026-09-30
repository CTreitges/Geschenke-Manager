import { Link } from "react-router-dom";
import { useStore } from "@/lib/hooks";
import { useIdentity } from "@/lib/auth";
import { useIdentityPrompt } from "./IdentitySheet";
import { Avatar } from "./ui";

export function IdentityChip() {
  const { persons } = useStore();
  const id = useIdentity();
  const { open } = useIdentityPrompt();
  const me = persons.find((p) => p.id === id);
  if (!me) {
    // Ohne Identität auch auf dem Handy mit Text – öffnet das IdentitySheet.
    return (
      <button
        type="button"
        onClick={() => void open()}
        aria-haspopup="dialog"
        className="min-h-tap inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-xs font-semibold text-accent-text"
      >
        <span aria-hidden className="hidden text-sm leading-none min-[400px]:inline">
          👋
        </span>
        Wer bist du?
      </button>
    );
  }
  return (
    <Link
      to={`/person/${me.id}`}
      className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-1 pr-1.5 sm:pr-3 py-1 inline-flex items-center gap-2 shadow-sm max-w-[140px]"
      aria-label={`Mein Profil (${me.name})`}
      title={`Mein Profil (${me.name})`}
    >
      <Avatar person={me} size={26} />
      <span className="hidden sm:inline text-xs font-semibold text-stone-700 dark:text-stone-200 truncate">
        Ich: {me.name}
      </span>
    </Link>
  );
}

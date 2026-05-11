import { Link } from "react-router-dom";
import { useStore } from "@/lib/hooks";
import { useIdentity } from "@/lib/auth";
import { Avatar } from "./ui";

export function IdentityChip() {
  const { persons } = useStore();
  const id = useIdentity();
  const me = persons.find((p) => p.id === id);
  if (!me) {
    return (
      <Link
        to="/settings"
        className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-400"
        aria-label="Wer bist du?"
        title="Wer bist du?"
      >
        <span className="text-sm leading-none">👋</span>
        <span className="hidden sm:inline">Wer bist du?</span>
      </Link>
    );
  }
  return (
    <Link
      to="/settings"
      className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-1 pr-1.5 sm:pr-3 py-1 inline-flex items-center gap-2 shadow-sm max-w-[140px]"
      aria-label={`Identität: ${me.name}`}
      title={`Identität: ${me.name}`}
    >
      <Avatar person={me} size={26} />
      <span className="hidden sm:inline text-xs font-semibold text-stone-700 dark:text-stone-200 truncate">
        Ich: {me.name}
      </span>
    </Link>
  );
}

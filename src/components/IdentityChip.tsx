import { Link } from "react-router-dom";
import { useStore } from "@/lib/hooks";
import { getIdentity } from "@/lib/auth";
import { Avatar } from "./ui";

export function IdentityChip() {
  const { persons } = useStore();
  const id = getIdentity();
  const me = persons.find((p) => p.id === id);
  if (!me) {
    return (
      <Link
        to="/settings"
        className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-2 pr-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400"
      >
        <span className="text-sm">👋</span> Wer bist du?
      </Link>
    );
  }
  return (
    <Link
      to="/settings"
      className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-1 pr-3 py-1 inline-flex items-center gap-2 shadow-sm"
    >
      <Avatar person={me} size={26} />
      <span className="text-xs font-semibold text-stone-700 dark:text-stone-200">
        Ich: {me.name}
      </span>
    </Link>
  );
}

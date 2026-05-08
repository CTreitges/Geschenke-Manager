import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/lib/hooks";
import { getIdentity } from "@/lib/auth";
import { cn } from "@/lib/cn";

export function IdentityChip() {
  const { persons } = useStore();
  const [tick, setTick] = useState(0);
  // Re-read on focus
  if (typeof window !== "undefined") {
    window.onfocus = () => setTick((t) => t + 1);
  }
  void tick;
  const id = getIdentity();
  const me = persons.find((p) => p.id === id);
  return (
    <Link
      to="/settings"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
        me
          ? "bg-primary-50 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400"
          : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
      )}
    >
      {me ? `Ich: ${me.name}` : "Ich: ?"}
    </Link>
  );
}

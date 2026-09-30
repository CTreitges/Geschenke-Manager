import { Check } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Person } from "@/lib/types";

/**
 * Überlappende Avatare der Wahlberechtigten: mit Häkchen = hat abgestimmt,
 * blass = fehlt noch. Rein dekorativ – den Stand nennt der Text daneben.
 */
export function VoterAvatars({
  people,
  voted,
  size = 28,
}: {
  people: readonly Person[];
  voted: ReadonlySet<string>;
  size?: number;
}) {
  if (people.length === 0) return null;
  return (
    <div aria-hidden className="flex shrink-0 items-center">
      {people.map((p, i) => {
        const done = voted.has(p.id);
        return (
          <span key={p.id} className={cn("relative", i > 0 && "-ml-1.5", !done && "opacity-45")}>
            <Avatar person={p} size={size} ring />
            {done && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-surface ring-2 ring-surface">
                <Check size={10} strokeWidth={3.5} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

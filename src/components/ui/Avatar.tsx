import type { Person } from "@/lib/types";
import { initials, pickColor, readableTextOn } from "@/lib/colors";

// ── Avatar ─────────────────────────────────────────────────────
// Textfarbe aus der Luminanz: Weiß auf dunklen, Fast-Schwarz auf hellen Farben.
export function Avatar({ person, size = 36, ring = false }: { person: Person | null | undefined; size?: number; ring?: boolean }) {
  if (!person) return null;
  const color = person.color || pickColor(person.id || person.name);
  return (
    <div
      className="inline-flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: readableTextOn(color),
        fontSize: size * 0.38,
        letterSpacing: 0.3,
        boxShadow: ring
          ? `0 0 0 2px var(--gm-bg), 0 0 0 ${size > 30 ? 4 : 3}px ${color}`
          : "none",
      }}
    >
      {initials(person.name)}
    </div>
  );
}

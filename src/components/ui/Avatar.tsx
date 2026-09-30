import type { Person } from "@/lib/types";
import { initials, pickColor } from "@/lib/colors";

// ── Avatar ─────────────────────────────────────────────────────
export function Avatar({ person, size = 36, ring = false }: { person: Person | null | undefined; size?: number; ring?: boolean }) {
  if (!person) return null;
  const color = person.color || pickColor(person.id || person.name);
  return (
    <div
      className="inline-flex items-center justify-center font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
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

import { Chip } from "@/components/ui";

/** Chip „🤫 Überraschung“ – statt Zahlen/Status bei Geschenken für mich. */
export function SurpriseBadge({ label = "Überraschung", className }: { label?: string; className?: string }) {
  return (
    <Chip variant="accent" className={className}>
      <span aria-hidden>🤫</span>
      {label}
    </Chip>
  );
}

import { PageHeader, Skeleton } from "@/components/ui";

// Platzhalter, solange Geschenk, Personen, Ideen und Abstimmungen noch laden –
// statt kurz „Geschenk nicht gefunden“ zu zeigen (B28).
export function GiftSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div aria-busy="true">
      <PageHeader onBack={onBack} />
      <span className="sr-only">Geschenk wird geladen …</span>
      <div className="space-y-3 px-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-4 h-10 w-full" />
        <Skeleton className="h-36 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
      </div>
    </div>
  );
}

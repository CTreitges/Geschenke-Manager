import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import {
  DEFAULT_DURATION_PRESET,
  DURATION_PRESETS,
  formatEndsAt,
  type DurationPresetId,
} from "@shared/poll";
import { Button, Icon, Segmented, Sheet } from "@/components/ui";
import { endsTooLate } from "@/lib/pollView";
import { useNow } from "@/lib/useNow";

/** „Anna hat am 15.10. Geburtstag“ bzw. „„Hochzeit“ ist am 2.1.“ */
function occasionText(recipientName: string, occasion: string, date: Date): string {
  const d = `${date.getDate()}.${date.getMonth() + 1}.`;
  return occasion === "Geburtstag" ? `${recipientName} hat am ${d} Geburtstag` : `„${occasion}“ ist am ${d}`;
}

// ── StartSheet: Dauer wählen und Abstimmung starten ───────────
export function StartSheet({
  open,
  onClose,
  recipientName,
  occasion,
  occasionDate,
  ideaCount,
  eligibleCount,
  blocker,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  recipientName: string;
  occasion: string;
  occasionDate: Date | null;
  ideaCount: number;
  eligibleCount: number;
  /** Grund, warum Starten gerade nicht geht (Knopf deaktiviert). */
  blocker: string | null;
  onStart: (durationMs: number) => Promise<void>;
}) {
  const [preset, setPreset] = useState<DurationPresetId>(DEFAULT_DURATION_PRESET);
  const [busy, setBusy] = useState(false);
  const now = useNow(30_000);

  useEffect(() => {
    if (open) setPreset(DEFAULT_DURATION_PRESET);
  }, [open]);

  const durationMs = (DURATION_PRESETS.find((p) => p.id === preset) ?? DURATION_PRESETS[1]).ms;
  const end = now + durationMs;
  const late = endsTooLate(end, occasionDate, now);

  async function submit() {
    setBusy(true);
    try {
      await onStart(durationMs);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Abstimmung starten"
      footer={
        <>
          <Button size="lg" className="w-full" disabled={!!blocker} loading={busy} onClick={submit}>
            <Icon.vote /> Abstimmung starten
          </Button>
          {blocker && (
            <p className="m-0 mt-2 flex items-center gap-1.5 text-meta text-fg-muted">
              <Lock size={14} aria-hidden className="shrink-0" />
              {blocker}
            </p>
          )}
        </>
      }
    >
      <p className="m-0 text-body font-semibold text-fg">Wie lange darf abgestimmt werden?</p>
      <Segmented
        label="Dauer der Abstimmung"
        className="mt-2.5"
        options={DURATION_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={preset}
        onChange={setPreset}
      />
      <p className="m-0 mt-2.5 text-meta font-semibold text-fg-soft">→ {formatEndsAt(end, now)}</p>
      {late && occasionDate && (
        <p className="m-0 mt-2 rounded-tile bg-status-vote-soft px-3 py-2 text-meta text-status-vote">
          ⚠ {occasionText(recipientName, occasion, occasionDate)} – denkt an die Lieferzeit.
        </p>
      )}
      <p className="m-0 mt-3 text-meta text-fg-soft">
        {ideaCount} {ideaCount === 1 ? "Idee" : "Ideen"} · {eligibleCount} {eligibleCount === 1 ? "darf" : "dürfen"}{" "}
        abstimmen
      </p>
      <p className="m-0 mt-2 flex gap-1.5 text-meta text-fg-muted">
        <Lock size={14} aria-hidden className="mt-0.5 shrink-0" />
        Solange die Wahl läuft: keine neuen Ideen, keine Übernahme aus der Wunschliste, kein Bearbeiten.
      </p>
    </Sheet>
  );
}

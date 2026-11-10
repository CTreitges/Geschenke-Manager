import { useEffect, useState } from "react";

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parse(value: string): { day: string; month: string } {
  if (!value) return { day: "", month: "" };
  const parts = value.split("-");
  // Accept "YYYY-MM-DD" (legacy) or "MM-DD". Strip leading zeros so the
  // values match our <option value="1".."12"> set.
  const strip = (s: string) => String(parseInt(s, 10) || "");
  if (parts.length === 3) return { month: strip(parts[1]), day: strip(parts[2]) };
  return { month: strip(parts[0] ?? ""), day: strip(parts[1] ?? "") };
}

/**
 * Birthday picker — Tag + Monat. Year is intentionally not asked because
 * we only need it for the next birthday calculation.
 *
 * Emits "MM-DD".
 */
export function BirthdayPicker({
  value,
  onChange,
  label = "Geburtstag",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const initial = parse(value);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);

  useEffect(() => {
    if (!day || !month) {
      onChange("");
      return;
    }
    onChange(`${pad(+month)}-${pad(+day)}`);
  }, [day, month]);

  return (
    <div>
      <div aria-hidden className="mb-1.5 block pl-0.5 text-meta font-semibold text-fg-muted">
        {label}
      </div>
      <div className="flex gap-2">
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          aria-label={`${label}: Tag`}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line-control bg-surface px-3 text-body text-fg"
        >
          <option value="">Tag</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}.
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label={`${label}: Monat`}
          className="h-11 min-w-0 flex-[1.4] rounded-xl border border-line-control bg-surface px-3 text-body text-fg"
        >
          <option value="">Monat</option>
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

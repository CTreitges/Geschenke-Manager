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
      <label className="block text-[13px] font-semibold text-stone-500 dark:text-stone-400 mb-1.5 pl-0.5">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[15px]"
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
          className="flex-[1.4] min-w-0 h-11 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-[15px]"
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

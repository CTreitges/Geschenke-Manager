import { useState } from "react";
import { formatEuro } from "@/lib/money";
import { updateGift } from "@/lib/storage";
import type { Gift } from "@/lib/types";

// ── Budget editor ─────────────────────────────────────────────
export function BudgetEditor({ gift, totalBudget }: { gift: Gift; totalBudget: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(gift.budgetPerPerson));

  return (
    <div className="px-3.5 py-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-[#F0EBE6] dark:border-[#3A3633] flex items-center justify-between">
      <div className="text-[13px] text-stone-500 dark:text-stone-400">
        <span className="text-[15px] font-bold text-stone-900 dark:text-stone-50">
          {gift.participantIds.length} ×{" "}
          {editing ? (
            <input
              type="number"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (draft) updateGift(gift.id, { budgetPerPerson: parseFloat(draft) });
                setEditing(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-12 px-1 py-0.5 rounded-md text-[15px] font-bold bg-transparent text-stone-900 dark:text-stone-50 outline-none"
              style={{ border: "1px solid #7C3AED" }}
            />
          ) : (
            <span
              onClick={() => {
                setDraft(String(gift.budgetPerPerson));
                setEditing(true);
              }}
              className="cursor-pointer"
              style={{ borderBottom: "1px dashed #7C3AED" }}
            >
              {formatEuro(gift.budgetPerPerson)}
            </span>
          )}
        </span>
        <span className="mx-1.5">=</span>
      </div>
      <div className="text-[22px] font-extrabold tracking-tight text-violet-700 dark:text-violet-300">
        {formatEuro(totalBudget)}
      </div>
    </div>
  );
}

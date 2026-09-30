import { useState } from "react";
import { formatEuro } from "@/lib/money";
import { updateGift } from "@/lib/storage";
import type { Gift } from "@/lib/types";

// ── Budget editor ─────────────────────────────────────────────
export function BudgetEditor({ gift, totalBudget }: { gift: Gift; totalBudget: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(gift.budgetPerPerson));

  return (
    <div className="flex items-center justify-between rounded-xl border border-line-subtle bg-surface-2/60 px-3.5 py-3">
      <div className="text-meta text-fg-muted">
        <span className="text-body font-bold text-fg">
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
              aria-label="Budget pro Person in Euro"
              className="w-12 rounded-md border border-accent bg-transparent px-1 py-0.5 text-body font-bold text-fg outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(String(gift.budgetPerPerson));
                setEditing(true);
              }}
              aria-label={`Budget pro Person ändern (${formatEuro(gift.budgetPerPerson)})`}
              className="border-b border-dashed border-accent font-bold text-fg"
            >
              {formatEuro(gift.budgetPerPerson)}
            </button>
          )}
        </span>
        <span className="mx-1.5">=</span>
      </div>
      <div className="text-title font-extrabold tracking-tight text-accent-text">
        {formatEuro(totalBudget)}
      </div>
    </div>
  );
}

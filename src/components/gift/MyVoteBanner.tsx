import type { Suggestion } from "@/lib/types";

// ── My-vote banner ────────────────────────────────────────────
// Multi-Vote: zeigt alle Vorschläge, für die ich gestimmt habe (mit Komma
// getrennt). Zurücknehmen leert alle eigenen Stimmen auf einmal.
export function MyVoteBanner({
  myVotedSuggestions,
  onClearAll,
}: {
  myVotedSuggestions: Suggestion[];
  onClearAll: () => void;
}) {
  const has = myVotedSuggestions.length > 0;
  return (
    <div
      className="mb-2.5 px-3.5 py-2.5 rounded-xl flex items-center gap-2.5"
      style={{
        background: has ? "rgba(124, 58, 237, 0.08)" : "rgba(245, 158, 11, 0.08)",
        border: `1px solid ${has ? "rgba(124, 58, 237, 0.2)" : "rgba(245, 158, 11, 0.25)"}`,
      }}
    >
      <span className="text-base">{has ? "✓" : "🗳️"}</span>
      <div className="flex-1 text-[13px] min-w-0">
        {has ? (
          <>
            <span className="text-stone-500 dark:text-stone-400">
              Du hast {myVotedSuggestions.length === 1 ? "gewählt:" : `${myVotedSuggestions.length}× gewählt:`}
            </span>{" "}
            <span className="font-semibold text-stone-900 dark:text-stone-50">
              {myVotedSuggestions.map((s) => s.title).join(", ")}
            </span>
            <div className="text-xs text-stone-400 mt-0.5">
              Du darfst beliebig viele Vorschläge wählen — Klick toggelt die
              jeweilige Stimme.
            </div>
          </>
        ) : (
          <span className="font-semibold text-amber-800 dark:text-amber-300">
            Du hast noch nicht gestimmt — wähle einen oder mehrere Vorschläge.
          </span>
        )}
      </div>
      {has && (
        <button
          onClick={onClearAll}
          className="text-xs font-semibold text-violet-700 dark:text-violet-300 px-2 py-1 rounded-md hover:bg-violet-50 dark:hover:bg-violet-950 shrink-0"
        >
          Alle zurücknehmen
        </button>
      )}
    </div>
  );
}

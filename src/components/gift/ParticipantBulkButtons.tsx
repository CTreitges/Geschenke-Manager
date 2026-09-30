// ── Participant bulk buttons ──────────────────────────────────
export function ParticipantBulkButtons({
  personIds,
  participantIds,
  onSet,
}: {
  personIds: string[];
  participantIds: string[];
  onSet: (ids: string[]) => void;
}) {
  const allActive = personIds.length > 0 && personIds.every((id) => participantIds.includes(id));
  return (
    <button
      onClick={() => {
        if (allActive) onSet([]);
        else onSet(personIds);
      }}
      className="text-xs font-semibold text-violet-700 dark:text-violet-400 px-2 py-1 rounded-md hover:bg-violet-50 dark:hover:bg-violet-950"
    >
      {allActive ? "Alle entfernen" : "Alle hinzufügen"}
    </button>
  );
}

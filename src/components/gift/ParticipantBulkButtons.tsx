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
      className="min-h-9 rounded-md px-2 text-xs font-semibold text-accent-text hover:bg-accent-soft"
    >
      {allActive ? "Alle entfernen" : "Alle hinzufügen"}
    </button>
  );
}

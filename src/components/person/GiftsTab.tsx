import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SurpriseBadge } from "@/components/surprise/SurpriseBadge";
import { Button, Chip, EmptyState, Icon, Input, useConfirm } from "@/components/ui";
import { birthdayYearForPerson } from "@/lib/birthdays";
import { useStore } from "@/lib/hooks";
import { formatEuro } from "@/lib/money";
import { addGift, deleteGift } from "@/lib/storage";
import type { Gift, Person } from "@/lib/types";

// ── PersonDetail → Tab „Geschenke“ ────────────────────────────
// `isMe` (eigene Person): laufende Geschenke nur als „Überraschung in
// Planung“ ohne Zahlen, Status und Löschen; kein „Neues Geschenk anlegen“.
export function GiftsTab({ person, stack, past, isMe }: { person: Person; stack: Gift[]; past: Gift[]; isMe: boolean }) {
  const nav = useNavigate();
  const confirm = useConfirm();
  const { settings } = useStore();
  const all = [...stack, ...past];

  const [newGiftOpen, setNewGiftOpen] = useState(false);
  const [newGiftYear, setNewGiftYear] = useState(birthdayYearForPerson(person));
  const [newGiftOccasion, setNewGiftOccasion] = useState("Geburtstag");
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState("");

  function createGift() {
    const occ = newGiftOccasion.trim() || "Geburtstag";
    const finalDate = useCustomDate && customDate ? customDate : undefined;
    // Carry over the last gift's group-chat link for the same person+occasion
    const lastSameKind = [...stack, ...past]
      .filter((g) => (g.occasion ?? "Geburtstag") === occ)
      .sort((a, b) => b.enteredStackAt - a.enteredStackAt)[0];
    addGift({
      personId: person.id,
      year: finalDate ? +finalDate.slice(0, 4) || newGiftYear : newGiftYear,
      status: "open",
      budgetPerPerson: settings.defaultBudget,
      manuallyAdded: true,
      occasion: occ,
      customDate: finalDate,
      whatsappLink: lastSameKind?.whatsappLink,
    });
    toast.success(`Geschenk angelegt`);
    setNewGiftOpen(false);
    setNewGiftOccasion("Geburtstag");
    setUseCustomDate(false);
    setCustomDate("");
  }

  async function removeGift(g: Gift) {
    const ok = await confirm({
      title: `Geschenk ${g.year} für ${person.name} löschen?`,
      body: "Ideen und Abstimmung gehen verloren.",
      confirmLabel: "Löschen",
      tone: "danger",
    });
    if (!ok) return;
    deleteGift(g.id)
      .then(() => toast.success("Gelöscht"))
      .catch(() => toast.error("Löschen hat nicht geklappt – bitte nochmal"));
  }

  const byYear: Record<number, Gift[]> = {};
  all.forEach((g) => {
    (byYear[g.year] ||= []).push(g);
  });
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <div>
      {all.length === 0 ? (
        <EmptyState
          emoji="🎁"
          title="Noch kein Geschenk hier"
          subtitle={isMe ? "Geschenke für dich legen deine Freunde an." : `Lege ein neues Geschenk für ${person.name} an.`}
        />
      ) : (
        years.map((y) => (
          <div key={y} className="mb-4">
            <div className="text-[11px] font-bold tracking-[0.05em] uppercase text-stone-400 mb-2 pl-1">
              {y}
            </div>
            <div className="flex flex-col gap-2">
              {byYear[y].map((g) => {
                // Spoiler-Schutz: eigene laufende Geschenke ohne Details.
                const secret = isMe && g.status !== "received";
                return (
                  <div
                    key={g.id}
                    className="px-3.5 py-3 bg-white dark:bg-stone-800 rounded-2xl border border-[#F0EBE6] dark:border-[#3A3633] flex items-center gap-2.5"
                  >
                    <button
                      onClick={() => nav(`/gift/${g.id}`)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    >
                      <div
                        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                        style={{
                          background:
                            g.status !== "received"
                              ? "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)"
                              : undefined,
                          color: g.status !== "received" ? "#fff" : undefined,
                        }}
                      >
                        {g.status !== "received" ? (
                          <Icon.gift />
                        ) : (
                          <span className="text-stone-500">
                            <Icon.gift />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                          {g.occasion ?? "Geburtstag"} {y}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          {secret
                            ? "🤫 Überraschung in Planung"
                            : g.status !== "received"
                              ? `${g.participantIds.length} Personen · ${formatEuro(g.participantIds.length * g.budgetPerPerson)}`
                              : "erhalten"}
                        </div>
                      </div>
                      {secret ? (
                        <SurpriseBadge label="für dich" />
                      ) : (
                        <Chip variant={g.status === "open" ? "info" : g.status === "confirmed" ? "accent" : "success"}>
                          {g.status === "open" ? "offen" : g.status === "confirmed" ? "bestätigt" : "erhalten"}
                        </Chip>
                      )}
                    </button>
                    {!secret && (
                      <button
                        onClick={() => void removeGift(g)}
                        className="text-stone-500 dark:text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 p-2 rounded-lg shrink-0"
                        aria-label="Geschenk löschen"
                        title="Geschenk löschen"
                      >
                        <Icon.trash />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {isMe ? (
        all.length > 0 && (
          <p className="m-0 mt-1 px-1 text-meta text-fg-muted">Geschenke für dich legen deine Freunde an.</p>
        )
      ) : !newGiftOpen ? (
        <Button
          variant="secondary"
          onClick={() => {
            setNewGiftYear(birthdayYearForPerson(person));
            setNewGiftOpen(true);
          }}
          className="w-full mt-1"
        >
          <Icon.plus /> Neues Geschenk anlegen
        </Button>
      ) : (
        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-[#F0EBE6] dark:border-[#3A3633] p-3.5 mt-1 space-y-2.5">
          <Input
            label="Anlass"
            type="text"
            value={newGiftOccasion}
            onChange={(e) => setNewGiftOccasion(e.target.value)}
            placeholder="z.B. Geburtstag, Reise, Hochzeit"
          />
          <Input
            label="Jahr"
            type="number"
            value={newGiftYear}
            onChange={(e) => setNewGiftYear(parseInt(e.target.value, 10) || newGiftYear)}
            disabled={useCustomDate}
          />
          <label className="flex items-start gap-3 cursor-pointer select-none py-1 px-0.5">
            <input
              type="checkbox"
              checked={useCustomDate}
              onChange={(e) => setUseCustomDate(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-violet-600"
            />
            <span className="text-[14px] text-stone-700 dark:text-stone-200">
              Anderes Datum (statt {person.name}s Geburtstag)
            </span>
          </label>
          {useCustomDate && (
            <Input
              label="Datum"
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setNewGiftOpen(false)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button
              onClick={createGift}
              disabled={useCustomDate && !customDate}
              className="flex-1"
            >
              Anlegen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

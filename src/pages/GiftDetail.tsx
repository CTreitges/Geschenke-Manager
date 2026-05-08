import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, Chip, EmptyState, Input } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import {
  addSuggestion,
  castVote,
  deleteSuggestion,
  markReceived,
  setPollStatus,
  toggleParticipant,
  updateGift,
} from "@/lib/storage";
import { getIdentity } from "@/lib/auth";
import { toast } from "sonner";

export default function GiftDetail() {
  const { id } = useParams<{ id: string }>();
  const { gifts, persons, suggestions, polls } = useStore();
  const nav = useNavigate();

  const gift = gifts.find((g) => g.id === id);
  if (!gift) return <p>Geschenk nicht gefunden.</p>;
  const person = persons.find((p) => p.id === gift.personId);
  if (!person) return <p>Person nicht gefunden.</p>;

  const giftSuggestions = suggestions.filter((s) => s.giftId === gift.id);
  const poll = polls.find((p) => p.giftId === gift.id);
  const pollStatus = poll?.status ?? "none";

  const myId = getIdentity();
  const me = persons.find((p) => p.id === myId);

  return (
    <div>
      <button onClick={() => nav(-1)} className="text-stone-500 mb-3">
        ← zurück
      </button>
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-2xl font-bold tracking-tight">🎁 {person.name} {gift.year}</h1>
        <Badge tone={gift.status === "open" ? "primary" : "success"}>
          {gift.status === "open" ? "offen" : "erhalten"}
        </Badge>
      </div>

      {/* Participants */}
      <section className="mt-6">
        <h2 className="font-semibold mb-3">Teilnehmer</h2>
        {!me && (
          <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 mb-3">
            Wähle in den Einstellungen, wer du bist, bevor du teilnimmst oder abstimmst.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {persons.map((p) => {
            const joined = gift.participantIds.includes(p.id);
            return (
              <Chip
                key={p.id}
                active={joined}
                onClick={() => {
                  toggleParticipant(gift.id, p.id);
                }}
              >
                {joined ? "✓ " : ""}{p.name}
              </Chip>
            );
          })}
        </div>
        <Card className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-stone-500">
              {gift.participantIds.length} ×{" "}
              <input
                type="number"
                value={gift.budgetPerPerson}
                onChange={(e) => updateGift(gift.id, { budgetPerPerson: +e.target.value })}
                className="w-16 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-900 dark:text-stone-100"
              />{" "}
              €
            </div>
            <div className="text-2xl font-bold text-primary-600">
              {gift.participantIds.length * gift.budgetPerPerson} €
            </div>
          </div>
        </Card>
      </section>

      {/* Suggestions */}
      <section className="mt-8">
        <h2 className="font-semibold mb-3">Vorschläge</h2>
        <SuggestionAdder giftId={gift.id} myId={myId} myName={me?.name} />
        <div className="space-y-2 mt-3">
          {giftSuggestions.length === 0 ? (
            <EmptyState icon="💡" title="Noch keine Ideen" />
          ) : (
            giftSuggestions.map((s) => {
              const sug = persons.find((p) => p.id === s.suggestedBy);
              const voters = poll
                ? Object.entries(poll.votes)
                    .filter(([, sId]) => sId === s.id)
                    .map(([pId]) => persons.find((p) => p.id === pId)?.name)
                    .filter(Boolean) as string[]
                : [];
              const myVote = poll && myId ? poll.votes[myId] : null;
              const isMyVote = myVote === s.id;
              return (
                <Card key={s.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{s.title}</div>
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:underline truncate block"
                        >
                          {s.url}
                        </a>
                      )}
                      <div className="text-xs text-stone-500 mt-1">
                        {s.price != null && `${s.price} € · `}
                        von {sug?.name ?? "?"}
                      </div>
                      {pollStatus !== "none" && (
                        <div className="text-xs text-stone-600 dark:text-stone-400 mt-2">
                          {voters.length === 0 ? (
                            <span className="text-stone-400">noch keine Stimmen</span>
                          ) : (
                            <>
                              {voters.length} Stimme{voters.length !== 1 ? "n" : ""}: {voters.join(", ")}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {pollStatus === "active" && myId && (
                        <Button
                          size="sm"
                          variant={isMyVote ? "primary" : "secondary"}
                          onClick={() => {
                            castVote(gift.id, myId, s.id);
                            toast.success("Stimme gespeichert");
                          }}
                        >
                          {isMyVote ? "✓ gewählt" : "Wählen"}
                        </Button>
                      )}
                      <button
                        onClick={() => deleteSuggestion(s.id)}
                        className="text-stone-400 hover:text-red-500 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Poll */}
      <section className="mt-8">
        <h2 className="font-semibold mb-3">Abstimmung</h2>
        {pollStatus === "none" && (
          <Button
            onClick={() => {
              if (giftSuggestions.length === 0) {
                toast.error("Erst Vorschläge anlegen");
                return;
              }
              setPollStatus(gift.id, "active");
              toast.success("Abstimmung gestartet");
            }}
            className="w-full"
          >
            Abstimmung starten
          </Button>
        )}
        {pollStatus === "active" && (
          <Button
            variant="secondary"
            onClick={() => {
              setPollStatus(gift.id, "closed");
              toast.success("Abstimmung beendet");
            }}
            className="w-full"
          >
            Abstimmung beenden
          </Button>
        )}
        {pollStatus === "closed" && (
          <Card>
            <div className="text-sm text-stone-500">Abstimmung beendet.</div>
          </Card>
        )}
      </section>

      {/* Mark received */}
      {gift.status === "open" && (
        <section className="mt-8">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              if (!confirm(`Geschenk für ${person.name} als erhalten markieren?`)) return;
              markReceived(gift.id);
              toast.success("Geschenk erhalten ✓");
              nav("/");
            }}
          >
            ✓ Geschenk erhalten
          </Button>
        </section>
      )}
    </div>
  );
}

function SuggestionAdder({
  giftId,
  myId,
  myName,
}: {
  giftId: string;
  myId: string | null;
  myName?: string;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");

  function add() {
    if (!title.trim()) return;
    if (!myId) {
      toast.error("Wähle erst in den Einstellungen, wer du bist");
      return;
    }
    addSuggestion({
      giftId,
      title: title.trim(),
      url: url.trim() || undefined,
      price: price ? +price : undefined,
      suggestedBy: myId,
    });
    setTitle("");
    setUrl("");
    setPrice("");
    toast.success(`Idee von ${myName} hinzugefügt`);
  }

  return (
    <Card>
      <div className="space-y-2">
        <Input placeholder="Idee teilen…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex gap-2">
          <Input placeholder="Link" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Input
            type="number"
            placeholder="€"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-24"
          />
        </div>
        <Button onClick={add} disabled={!title.trim()} className="w-full">
          Vorschlagen
        </Button>
      </div>
    </Card>
  );
}

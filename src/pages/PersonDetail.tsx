import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Input } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import {
  addWishItem,
  deleteWishItem,
  deletePerson,
  updatePerson,
  addGift,
} from "@/lib/storage";
import { formatBirthday, daysUntilBirthday, formatDaysUntil, birthdayYearForPerson } from "@/lib/birthdays";
import { toast } from "sonner";

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const { persons, wishlist, gifts, settings } = useStore();
  const nav = useNavigate();
  const person = persons.find((p) => p.id === id);
  const [tab, setTab] = useState<"wishlist" | "gifts" | "profile">("wishlist");

  if (!person) {
    return (
      <div>
        <p>Person nicht gefunden.</p>
        <Button onClick={() => nav("/people")} className="mt-4">
          Zurück
        </Button>
      </div>
    );
  }

  const myWishes = wishlist.filter((w) => w.personId === person.id);
  const myGifts = gifts.filter((g) => g.personId === person.id);

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "wishlist", label: "Wunschliste" },
    { id: "gifts", label: "Geschenke" },
    { id: "profile", label: "Profil" },
  ];

  return (
    <div>
      <button onClick={() => nav(-1)} className="text-stone-500 mb-3">
        ← zurück
      </button>
      <h1 className="text-2xl font-bold tracking-tight">{person.name}</h1>
      <p className="text-stone-500 mt-1">
        🎂 {formatBirthday(person)} · {formatDaysUntil(daysUntilBirthday(person))}
      </p>

      <div className="flex gap-2 my-5 border-b border-stone-200 dark:border-stone-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-stone-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "wishlist" && (
        <WishlistTab personId={person.id} items={myWishes} />
      )}

      {tab === "gifts" && (
        <div className="space-y-3">
          {myGifts.length === 0 ? (
            <EmptyState icon="🎁" title="Noch keine Geschenke" />
          ) : (
            myGifts
              .sort((a, b) => b.year - a.year)
              .map((g) => (
                <Card key={g.id} onClick={() => nav(`/gift/${g.id}`)}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">Geschenk {g.year}</div>
                      <div className="text-sm text-stone-500">
                        {g.participantIds.length} Teilnehmer
                      </div>
                    </div>
                    <Badge tone={g.status === "open" ? "primary" : "success"}>
                      {g.status === "open" ? "offen" : "erhalten"}
                    </Badge>
                  </div>
                </Card>
              ))
          )}
          <Button
            variant="secondary"
            onClick={() => {
              addGift({
                personId: person.id,
                year: birthdayYearForPerson(person),
                status: "open",
                budgetPerPerson: settings.defaultBudget,
                manuallyAdded: true,
              });
              toast.success("Geschenk angelegt");
            }}
            className="w-full"
          >
            + Neues Geschenk
          </Button>
        </div>
      )}

      {tab === "profile" && <ProfileTab person={person} />}
    </div>
  );
}

function WishlistTab({ personId, items }: { personId: string; items: ReturnType<typeof useStore>["wishlist"] }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");

  function add() {
    if (!title.trim()) return;
    addWishItem({
      personId,
      title: title.trim(),
      url: url.trim() || undefined,
      price: price ? +price : undefined,
    });
    setTitle("");
    setUrl("");
    setPrice("");
    toast.success("Wunsch hinzugefügt");
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="space-y-2">
          <Input
            placeholder="Was wünschst du dir?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex gap-2">
            <Input placeholder="Link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Input
              type="number"
              placeholder="€"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-24"
            />
          </div>
          <Button onClick={add} disabled={!title.trim()} className="w-full">
            Hinzufügen
          </Button>
        </div>
      </Card>
      {items.length === 0 ? (
        <EmptyState icon="💭" title="Noch keine Wünsche" hint="Leg los!" />
      ) : (
        items.map((w) => (
          <Card key={w.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{w.title}</div>
                {w.url && (
                  <a
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:underline truncate block"
                  >
                    {w.url}
                  </a>
                )}
                {w.price != null && (
                  <div className="text-xs text-stone-500 mt-1">{w.price} €</div>
                )}
              </div>
              <button
                onClick={() => deleteWishItem(w.id)}
                className="text-stone-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

function ProfileTab({ person }: { person: ReturnType<typeof useStore>["persons"][0] }) {
  const nav = useNavigate();
  const [name, setName] = useState(person.name);
  const [bd, setBd] = useState(person.birthday);
  const [email, setEmail] = useState(person.email ?? "");

  function save() {
    updatePerson(person.id, {
      name: name.trim(),
      birthday: bd,
      email: email.trim() || undefined,
    });
    toast.success("Gespeichert");
  }

  function remove() {
    if (!confirm(`${person.name} wirklich löschen? Alle Geschenke + Wünsche gehen verloren.`)) return;
    deletePerson(person.id);
    toast.success("Gelöscht");
    nav("/people");
  }

  return (
    <div className="space-y-3">
      <Card>
        <label className="block text-sm font-medium mb-1">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <label className="block text-sm font-medium mt-3 mb-1">Geburtstag</label>
        <Input type="date" value={bd} onChange={(e) => setBd(e.target.value)} />
        <label className="block text-sm font-medium mt-3 mb-1">E-Mail</label>
        <Input
          type="email"
          value={email}
          placeholder="optional"
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={save} className="w-full mt-4">
          Speichern
        </Button>
      </Card>
      <Button variant="danger" onClick={remove} className="w-full">
        Person löschen
      </Button>
    </div>
  );
}

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, Card, Chip, EmptyState, Icon, Input, PageHeader } from "@/components/ui";
import { BirthdayPicker } from "@/components/BirthdayPicker";
import { useStore } from "@/lib/hooks";
import {
  addGift,
  addWishItem,
  deleteGift,
  deletePerson,
  deleteWishItem,
  updatePerson,
} from "@/lib/storage";
import {
  ageOnNextBirthday,
  birthdayYearForPerson,
  daysUntilBirthday,
  formatBirthday,
} from "@/lib/birthdays";
import type { WishlistItem, Person } from "@/lib/types";
import { getIdentity, setIdentity } from "@/lib/auth";
import { formatRelativeDate } from "@/lib/dates";
import { toast } from "sonner";

type Tab = "wishlist" | "gifts" | "profile";

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const { persons, wishlist, gifts } = useStore();
  const nav = useNavigate();
  const person = persons.find((p) => p.id === id);
  const [tab, setTab] = useState<Tab>("wishlist");

  if (!person) {
    return (
      <div className="px-4 py-8">
        <p>Person nicht gefunden.</p>
        <Button onClick={() => nav("/people")} className="mt-4">Zurück</Button>
      </div>
    );
  }

  const myWishes = wishlist.filter((w) => w.personId === person.id);
  const myGifts = gifts.filter((g) => g.personId === person.id);
  const stack = myGifts.filter((g) => g.status === "open");
  const past = myGifts.filter((g) => g.status === "received");

  const tabs: { id: Tab; label: string }[] = [
    { id: "wishlist", label: "Wunschliste" },
    { id: "gifts", label: "Geschenke" },
    { id: "profile", label: "Profil" },
  ];

  return (
    <div>
      <PageHeader
        onBack={() => nav(-1)}
        title={person.name}
        subtitle={`${formatBirthday(person)} · in ${daysUntilBirthday(person)} Tagen`}
      />

      {/* Hero strip */}
      <div className="px-5 pb-3.5 flex items-center gap-3.5">
        <Avatar person={person} size={64} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-stone-500 dark:text-stone-400 font-medium">
            {ageOnNextBirthday(person) ? `wird ${ageOnNextBirthday(person)} · ` : ""}
            {person.email || "keine Mail"}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {stack.length > 0 && <Chip variant="accent">{stack.length} im Stack</Chip>}
            <Chip variant="neutral">{myWishes.length} Wünsche</Chip>
            <Chip variant="neutral">{past.length} erhalten</Chip>
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div className="mx-5 p-1 rounded-xl bg-[#F5F1ED] dark:bg-stone-800 flex gap-0.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
              tab === t.id
                ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-50 shadow-sm"
                : "text-stone-500 dark:text-stone-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 pb-24">
        {tab === "wishlist" && <WishlistTab personId={person.id} person={person} items={myWishes} />}
        {tab === "gifts" && <GiftsTab person={person} stack={stack} past={past} />}
        {tab === "profile" && <ProfileTab person={person} />}
      </div>
    </div>
  );
}

function WishlistTab({ personId, person, items }: { personId: string; person: Person; items: WishlistItem[] }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [showExtra, setShowExtra] = useState(false);

  function add() {
    if (!text.trim()) return;
    addWishItem({
      personId,
      title: text.trim(),
      url: url.trim() || undefined,
      price: price ? +price : undefined,
    });
    toast.success("Wunsch hinzugefügt");
    setText("");
    setUrl("");
    setPrice("");
    setShowExtra(false);
  }

  return (
    <div>
      <Card className="p-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg pl-1">✨</span>
          <input
            placeholder={`Was wünscht sich ${person.name}?`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="flex-1 px-1 py-2.5 text-[15px] border-none outline-none bg-transparent text-stone-900 dark:text-stone-50"
          />
          {!showExtra && text && (
            <button
              onClick={() => setShowExtra(true)}
              className="text-xs font-semibold text-violet-700 dark:text-violet-400 px-1"
            >
              + Details
            </button>
          )}
          <button
            onClick={add}
            disabled={!text.trim()}
            className="rounded-[10px] w-9 h-9 flex items-center justify-center text-white"
            style={{
              background: text.trim()
                ? "linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)"
                : "#D6D3D1",
            }}
          >
            <Icon.plus size={18} />
          </button>
        </div>
        {showExtra && (
          <div className="flex gap-2 mt-2.5 pl-7">
            <Input placeholder="Link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-[2] py-2 text-[13px]" />
            <Input placeholder="€" value={price} onChange={(e) => setPrice(e.target.value)} type="number" className="flex-1 py-2 text-[13px]" />
          </div>
        )}
      </Card>

      {items.length === 0 ? (
        <EmptyState
          emoji="📝"
          title="Noch keine Wünsche — leg los!"
          subtitle="Schreib einfach rein, was dir vorschwebt. Auch lose Ideen helfen."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {[...items].sort((a, b) => b.createdAt - a.createdAt).map((it) => (
            <div
              key={it.id}
              className="px-3.5 py-3.5 bg-white dark:bg-stone-800 rounded-2xl border border-[#F0EBE6] dark:border-[#3A3633] flex items-start gap-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-semibold text-stone-900 dark:text-stone-50 leading-snug">
                  {it.title}
                </div>
                <div className="flex gap-2.5 mt-1.5 items-center text-xs flex-wrap">
                  {it.price != null && (
                    <span className="text-violet-700 dark:text-violet-400 font-semibold">
                      {it.price} €
                    </span>
                  )}
                  {it.url && (
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-500 dark:text-stone-400 no-underline flex items-center gap-1"
                    >
                      <Icon.link /> Link
                    </a>
                  )}
                  <span className="text-stone-400">
                    {formatRelativeDate(it.createdAt) || "—"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => deleteWishItem(it.id)}
                className="text-stone-400 hover:text-red-500 p-1"
              >
                <Icon.trash />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GiftsTab({
  person,
  stack,
  past,
}: {
  person: Person;
  stack: import("@/lib/types").Gift[];
  past: import("@/lib/types").Gift[];
}) {
  const nav = useNavigate();
  const { settings } = useStore();
  const all = [...stack, ...past];

  const [newGiftOpen, setNewGiftOpen] = useState(false);
  const [newGiftYear, setNewGiftYear] = useState(birthdayYearForPerson(person));

  function createGift() {
    addGift({
      personId: person.id,
      year: newGiftYear,
      status: "open",
      budgetPerPerson: settings.defaultBudget,
      manuallyAdded: true,
    });
    toast.success(`Geschenk ${newGiftYear} angelegt`);
    setNewGiftOpen(false);
  }

  function removeGift(g: import("@/lib/types").Gift) {
    if (
      !confirm(
        `Geschenk ${g.year} für ${person.name} wirklich löschen?\n\nVorschläge + Abstimmung gehen verloren.`,
      )
    )
      return;
    deleteGift(g.id);
    toast.success("Gelöscht");
  }

  const byYear: Record<number, typeof all> = {};
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
          subtitle={`Lege ein neues Geschenk für ${person.name} an.`}
        />
      ) : (
        years.map((y) => (
          <div key={y} className="mb-4">
            <div className="text-[11px] font-bold tracking-[0.05em] uppercase text-stone-400 mb-2 pl-1">
              {y}
            </div>
            <div className="flex flex-col gap-2">
              {byYear[y].map((g) => (
                <div
                  key={g.id}
                  className="px-3.5 py-3 bg-white dark:bg-stone-800 rounded-2xl border border-[#F0EBE6] dark:border-[#3A3633] flex items-center gap-2.5"
                >
                  <button
                    onClick={() => g.status === "open" && nav(`/gift/${g.id}`)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                  >
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{
                        background:
                          g.status === "open"
                            ? "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)"
                            : undefined,
                        color: g.status === "open" ? "#fff" : undefined,
                      }}
                    >
                      {g.status === "open" ? (
                        <Icon.gift />
                      ) : (
                        <span className="text-stone-500">
                          <Icon.gift />
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                        Geschenk {y}
                      </div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        {g.status === "open"
                          ? `${g.participantIds.length} Personen · ${g.participantIds.length * g.budgetPerPerson} €`
                          : "erhalten"}
                      </div>
                    </div>
                    <Chip variant={g.status === "open" ? "info" : "success"}>
                      {g.status === "open" ? "offen" : "erhalten"}
                    </Chip>
                  </button>
                  <button
                    onClick={() => removeGift(g)}
                    className="text-stone-300 hover:text-red-500 p-1.5 shrink-0"
                    aria-label="Geschenk löschen"
                    title="Geschenk löschen"
                  >
                    <Icon.trash />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {!newGiftOpen ? (
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
            label="Jahr"
            type="number"
            value={newGiftYear}
            onChange={(e) => setNewGiftYear(parseInt(e.target.value, 10) || newGiftYear)}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setNewGiftOpen(false)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button onClick={createGift} className="flex-1">
              Anlegen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileTab({ person }: { person: Person }) {
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
    const isSelf = getIdentity() === person.id;
    const msg = isSelf
      ? `${person.name} wirklich löschen?\n\nDas ist deine aktuelle Identität — danach bist du wieder „niemand" und kannst dich neu zuordnen.\n\nAlle Geschenke + Wünsche werden mitgelöscht.`
      : `${person.name} wirklich löschen? Alle Geschenke + Wünsche gehen verloren.`;
    if (!confirm(msg)) return;
    deletePerson(person.id);
    if (isSelf) setIdentity(null);
    toast.success("Gelöscht");
    nav("/people");
  }

  return (
    <div>
      <Card className="p-0 overflow-hidden">
        <div className="p-3.5 flex flex-col gap-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <BirthdayPicker value={bd} onChange={setBd} />
          <Input label="E-Mail" type="email" placeholder="optional" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={save} className="w-full mt-1">Speichern</Button>
        </div>
      </Card>
      <Button variant="danger" onClick={remove} className="w-full mt-3.5">
        <Icon.trash /> Person löschen
      </Button>
    </div>
  );
}

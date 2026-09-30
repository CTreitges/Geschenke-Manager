import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, Card, Chip, EmptyState, Icon, Input, PageHeader, useConfirm } from "@/components/ui";
import { BirthdayPicker } from "@/components/BirthdayPicker";
import { GiftsTab } from "@/components/person/GiftsTab";
import { SurpriseBadge } from "@/components/surprise/SurpriseBadge";
import { useStore } from "@/lib/hooks";
import { mySurpriseGiftIds } from "@/lib/spoiler";
import {
  addWishItem,
  deletePerson,
  deleteWishItem,
  sendTestMailCF,
  updatePerson,
} from "@/lib/storage";
import {
  ageOnNextBirthday,
  daysUntilBirthday,
  formatBirthday,
} from "@/lib/birthdays";
import type { WishlistItem, Person } from "@/lib/types";
import { getIdentity, setIdentity, useIdentity } from "@/lib/auth";
import { formatRelativeDate } from "@/lib/dates";
import { toast } from "sonner";

type Tab = "wishlist" | "gifts" | "profile";

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const { persons, wishlist, gifts } = useStore();
  const nav = useNavigate();
  const person = persons.find((p) => p.id === id);
  const [tab, setTab] = useState<Tab>("wishlist");
  const isMe = useIdentity() === id;

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
  // Stack = offen + bestätigt; past = erhalten.
  const stack = myGifts.filter((g) => g.status === "open" || g.status === "confirmed");
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
            {stack.length > 0 &&
              (isMe ? <SurpriseBadge label="Überraschung läuft" /> : <Chip variant="accent">{stack.length} im Stack</Chip>)}
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
        {tab === "gifts" && <GiftsTab person={person} stack={stack} past={past} isMe={isMe} />}
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
          <span className="text-lg pl-1 shrink-0">✨</span>
          <input
            placeholder={`Was wünscht sich ${person.name}?`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="flex-1 min-w-0 px-1 py-2.5 border-none outline-none bg-transparent text-stone-900 dark:text-stone-50"
          />
          <button
            onClick={add}
            disabled={!text.trim()}
            className="rounded-[10px] w-9 h-9 shrink-0 flex items-center justify-center text-white"
            style={{
              background: text.trim()
                ? "linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)"
                : "#D6D3D1",
            }}
          >
            <Icon.plus size={18} />
          </button>
        </div>
        {!showExtra && text && (
          <button
            onClick={() => setShowExtra(true)}
            className="block w-full mt-1 py-1 pl-7 text-left text-[12px] font-semibold text-violet-700 dark:text-violet-400"
          >
            + Link / Preis
          </button>
        )}
        {showExtra && (
          <div className="flex gap-2 mt-2.5 pl-7">
            <Input placeholder="Link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-[2] py-2" />
            <Input placeholder="€" value={price} onChange={(e) => setPrice(e.target.value)} type="number" className="flex-1 py-2" />
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

function ProfileTab({ person }: { person: Person }) {
  const nav = useNavigate();
  const confirm = useConfirm();
  const { gifts } = useStore();
  const [name, setName] = useState(person.name);
  const [bd, setBd] = useState(person.birthday);
  const [email, setEmail] = useState(person.email ?? "");
  const [remindersOn, setRemindersOn] = useState(person.emailOptIn !== false);
  const [testing, setTesting] = useState(false);

  async function sendTest() {
    if (testing) return;
    setTesting(true);
    try {
      await sendTestMailCF(person.id);
      toast.success(`Test-Mail an ${person.email} verschickt — kann 1-2 min dauern`);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "Unbekannter Fehler";
      toast.error(`Test-Mail fehlgeschlagen: ${msg}`);
    } finally {
      setTesting(false);
    }
  }

  function save() {
    const trimmedEmail = email.trim();
    updatePerson(person.id, {
      name: name.trim(),
      birthday: bd,
      email: trimmedEmail || undefined,
      // Only persist optIn when there's a mail to send to. Clearing the
      // mail also clears the flag — keeps state tidy.
      emailOptIn: trimmedEmail ? remindersOn : undefined,
    });
    toast.success("Gespeichert");
  }

  async function remove() {
    const isSelf = getIdentity() === person.id;
    // Warnen statt verbieten: eine laufende Planung geht mit verloren.
    const planning = mySurpriseGiftIds(gifts, person.id).size > 0;
    const body = [
      planning &&
        (isSelf
          ? "Für dich läuft gerade eine Überraschung – die Planung deiner Freunde geht dabei verloren."
          : `Für ${person.name} wird gerade geplant – Ideen und Abstimmung gehen dabei verloren.`),
      isSelf && "Das ist deine aktuelle Identität – danach kannst du dich neu zuordnen.",
      "Alle Geschenke, Ideen und Wünsche werden mitgelöscht.",
    ]
      .filter(Boolean)
      .join(" ");
    const ok = await confirm({ title: `${person.name} wirklich löschen?`, body, confirmLabel: "Löschen", tone: "danger" });
    if (!ok) return;
    try {
      await deletePerson(person.id);
    } catch {
      toast.error("Löschen hat nicht geklappt – bitte nochmal");
      return;
    }
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
          {email.trim() && (
            <label className="flex items-start gap-3 px-1 py-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remindersOn}
                onChange={(e) => setRemindersOn(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-violet-600"
              />
              <span className="text-[13px] text-stone-600 dark:text-stone-300 leading-snug">
                <b>Geburtstags-Erinnerung per Mail</b>
                <br />
                <span className="text-stone-500 dark:text-stone-400">
                  60 / 30 / 14 Tage vor dem Geburtstag — Folge-Erinnerungen entfallen, sobald eine Wunschliste angelegt ist.
                </span>
              </span>
            </label>
          )}
          <Button onClick={save} className="w-full mt-1">Speichern</Button>
        </div>
      </Card>
      {person.email && (
        <Button
          variant="secondary"
          onClick={sendTest}
          disabled={testing}
          className="w-full mt-3"
        >
          {testing ? "Sende Test-Mail…" : `🧪 Test-Mail an ${person.email} senden`}
        </Button>
      )}
      <Button variant="danger" onClick={() => void remove()} className="w-full mt-3.5">
        <Icon.trash /> Person löschen
      </Button>
    </div>
  );
}

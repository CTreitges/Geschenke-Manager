import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Button, Card, Chip, Icon, Input, PageHeader, useConfirm } from "@/components/ui";
import { BirthdayPicker } from "@/components/BirthdayPicker";
import { GiftsTab } from "@/components/person/GiftsTab";
import { SurpriseBadge } from "@/components/surprise/SurpriseBadge";
import { WishlistView } from "@/components/wishlist/WishlistView";
import { useStore } from "@/lib/hooks";
import { mySurpriseGiftIds } from "@/lib/spoiler";
import {
  deletePerson,
  sendTestMailCF,
  updatePerson,
} from "@/lib/storage";
import {
  ageOnNextBirthday,
  daysUntilBirthday,
  formatBirthday,
} from "@/lib/birthdays";
import type { Person } from "@/lib/types";
import { getIdentity, setIdentity, useIdentity } from "@/lib/auth";
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

  const myWishes = wishlist.filter((w) => w.personId === person.id && !w.fulfilledAt);
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
        {tab === "wishlist" && <WishlistView person={person} isOwner={isMe} />}
        {tab === "gifts" && <GiftsTab person={person} stack={stack} past={past} isMe={isMe} />}
        {tab === "profile" && <ProfileTab person={person} />}
      </div>
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
                  60 / 30 / 14 Tage vor dem Geburtstag — Folge-Erinnerungen entfallen, solange eigene Wünsche aus den letzten 4 Monaten auf der Liste stehen.
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

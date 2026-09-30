import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { Avatar, Button, Card, Chip, EmptyState, Icon, Input, PageHeader, Segmented, Skeleton, useConfirm } from "@/components/ui";
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
import { ageOnNextBirthday, daysUntilBirthday, formatBirthday, formatDaysUntil } from "@/lib/birthdays";
import type { Person } from "@/lib/types";
import { getIdentity, setIdentity, useIdentity } from "@/lib/auth";
import { useBack, useLeave } from "@/lib/nav";
import { isNewEmail } from "@/lib/onboarding";
import { isSkipped } from "@/lib/stack";
import { toast } from "sonner";

type Tab = "wishlist" | "gifts" | "profile";
const TABS: { value: Tab; label: string }[] = [
  { value: "wishlist", label: "Wunschliste" },
  { value: "gifts", label: "Geschenke" },
  { value: "profile", label: "Profil" },
];

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const { persons, wishlist, gifts, personsHydrated } = useStore();
  const nav = useNavigate();
  const back = useBack("/people");
  const person = persons.find((p) => p.id === id);
  // Tab steht in der URL (?tab=gifts), damit Zurück vom Geschenk wieder dort landet.
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t.value === params.get("tab"))?.value ?? "wishlist";
  const setTab = (t: Tab) => setParams(t === "wishlist" ? {} : { tab: t }, { replace: true });
  const isMe = useIdentity() === id;

  // Bis die Personen geladen sind: Platzhalter statt „nicht gefunden“ (B28).
  if (!personsHydrated) {
    return (
      <div aria-busy="true">
        <PageHeader onBack={back} />
        <span className="sr-only">Person wird geladen …</span>
        <div className="flex items-center gap-3.5 px-5">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    );
  }
  if (!person) {
    return (
      <div>
        <PageHeader onBack={back} title="Person" />
        <EmptyState
          emoji="👥"
          title="Person nicht gefunden"
          subtitle="Vielleicht wurde sie gerade gelöscht."
          action={<Button onClick={() => nav("/people", { replace: true })}>Zu den Personen</Button>}
        />
      </div>
    );
  }

  const myWishes = wishlist.filter((w) => w.personId === person.id && !w.fulfilledAt);
  const myGifts = gifts.filter((g) => g.personId === person.id);
  // Stack = offen + bestätigt (inkl. ausgesetzter, für „Wieder aufnehmen“); past = erhalten.
  const stack = myGifts.filter((g) => g.status === "open" || g.status === "confirmed");
  const past = myGifts.filter((g) => g.status === "received");
  const activeCount = stack.filter((g) => !isSkipped(g)).length;

  return (
    <div>
      <PageHeader
        onBack={back}
        title={person.name}
        subtitle={`${formatBirthday(person)} · ${formatDaysUntil(daysUntilBirthday(person))}`}
      />

      {/* Hero strip */}
      <div className="flex items-center gap-3.5 px-5 pb-3.5">
        <Avatar person={person} size={64} />
        <div className="min-w-0 flex-1">
          {(ageOnNextBirthday(person) || person.email) && (
            <div className="truncate text-meta font-medium text-fg-muted">
              {[ageOnNextBirthday(person) && `wird ${ageOnNextBirthday(person)}`, person.email].filter(Boolean).join(" · ")}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {activeCount > 0 &&
              (isMe ? <SurpriseBadge label="Überraschung läuft" /> : <Chip variant="accent">{activeCount} in Planung</Chip>)}
            <Chip variant="neutral">{myWishes.length} Wünsche</Chip>
            <Chip variant="neutral">{past.length} erhalten</Chip>
          </div>
        </div>
      </div>

      <Segmented label={`Bereiche von ${person.name}`} value={tab} onChange={setTab} options={TABS} className="mx-5" />

      <div className="px-4 py-4 pb-24">
        {tab === "wishlist" && <WishlistView person={person} isOwner={isMe} />}
        {tab === "gifts" && <GiftsTab person={person} stack={stack} past={past} isMe={isMe} />}
        {tab === "profile" && <ProfileTab person={person} />}
      </div>
    </div>
  );
}

function ProfileTab({ person }: { person: Person }) {
  const leave = useLeave("/people");
  const confirm = useConfirm();
  const { gifts } = useStore();
  const [name, setName] = useState(person.name);
  const [bd, setBd] = useState(person.birthday);
  const [email, setEmail] = useState(person.email ?? "");
  const [remindersOn, setRemindersOn] = useState(person.emailOptIn !== false);
  const [testing, setTesting] = useState(false);
  // Kontext-Hinweis statt des früheren Test-Mail-Dialogs in der First-Run-Kette.
  const [testMailHint, setTestMailHint] = useState(false);

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
    setTestMailHint(isNewEmail(person.email, trimmedEmail));
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
    // Erst zurück, dann löschen – sonst steht kurz „nicht gefunden“ da und
    // Zurück führt wieder auf die gelöschte Person (B13).
    leave(() =>
      deletePerson(person.id)
        .then(() => {
          if (isSelf) setIdentity(null);
          toast.success(`${person.name} gelöscht`);
        })
        .catch(() => toast.error("Löschen hat nicht geklappt – bitte nochmal")),
    );
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
              <span className="text-meta leading-snug text-fg-soft">
                <b>Geburtstags-Erinnerung per Mail</b>
                <br />
                <span className="text-fg-muted">
                  60 / 30 / 14 Tage vor dem Geburtstag — Folge-Erinnerungen entfallen, solange eigene Wünsche aus den letzten 4 Monaten auf der Liste stehen.
                </span>
              </span>
            </label>
          )}
          <Button onClick={save} className="w-full mt-1">Speichern</Button>
        </div>
      </Card>
      {testMailHint && (
        <p role="status" className="m-0 mt-3 rounded-tile border border-accent/30 bg-accent-soft px-3 py-2.5 text-meta text-fg-soft">
          <strong className="text-accent-text">Tipp:</strong> Schick einmal eine Test-Mail und markiere sie als „Kein Spam“ –
          dann landen die Geburtstags-Erinnerungen sicher im Posteingang.
        </p>
      )}
      {person.email && (
        <Button
          variant="secondary"
          onClick={sendTest}
          disabled={testing}
          className="w-full mt-3"
        >
          <FlaskConical size={16} aria-hidden />
          {testing ? "Sende Test-Mail…" : `Test-Mail an ${person.email} senden`}
        </Button>
      )}
      <Button variant="danger" onClick={() => void remove()} className="w-full mt-3.5">
        <Icon.trash /> Person löschen
      </Button>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Avatar, Button, Chip, Icon, PageHeader } from "@/components/ui";
import { pickColor } from "@/lib/colors";

export default function Tutorial() {
  return (
    <div>
      <PageHeader title="So funktioniert's" subtitle="Alles, was du wissen musst — in 9 Schritten" />

      {/* Hero intro */}
      <div className="px-4 pb-5">
        <div
          className="relative overflow-hidden rounded-3xl text-white px-5 py-6"
          style={{
            background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
            boxShadow:
              "0 18px 36px -12px rgba(124,58,237,0.45), inset 0 0 0 1px rgba(255,255,255,0.2)",
          }}
        >
          <div className="text-5xl mb-2.5">🎁</div>
          <h1 className="m-0 text-[24px] font-extrabold tracking-tight leading-tight mb-2">
            Geschenke ohne Chaos.
          </h1>
          <p className="text-[14px] leading-[1.5] opacity-95">
            Eine Trust-basierte App für deine Freunde. Kein Login, kein Account — nur ein
            geteiltes Passwort. Jede Person sieht alles und kann alles bearbeiten.
            Beim ersten Öffnen landest du automatisch hier — danach erreichst du das Tutorial
            jederzeit über das <strong>?</strong> oben rechts oder die Einstellungen.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 space-y-4 pb-6">
        <Step
          n={1}
          icon="👋"
          title="Sag, wer du bist"
          body={
            <>
              <p>
                Tippe oben rechts auf <strong>„Wer bist du?"</strong> oder geh in die{" "}
                <Link to="/settings" className="text-violet-700 dark:text-violet-400 font-semibold">
                  Einstellungen
                </Link>{" "}
                → <strong>„Wer bin ich?"</strong> und wähle dich.
              </p>
              <p>
                Wichtig für: deine Stimmen, Vorschläge und Wünsche werden danach dir zugeordnet.
              </p>
            </>
          }
          mock={<MockTopBar />}
        />

        <Step
          n={2}
          icon="👥"
          title="Personen anlegen"
          body={
            <>
              <p>
                <Link to="/people" className="text-violet-700 dark:text-violet-400 font-semibold">
                  Personen
                </Link>{" "}
                → orangenes <strong>+</strong> rechts unten. Pro Person reichen <strong>Name + Tag/Monat</strong> —
                Jahr ist nicht nötig.
              </p>
              <p>E-Mail ist optional, brauchst du nur, falls du später Erinnerungen schicken lassen willst.</p>
            </>
          }
          mock={<MockPeopleGrid />}
        />

        <Step
          n={3}
          icon="📚"
          title="Die Übersicht"
          body={
            <>
              <p>
                Auf der Startseite. <strong>30 Tage vor jedem Geburtstag</strong> taucht die Person automatisch
                hier auf — <strong>nach Geburtstag sortiert</strong>, der nächste oben.
              </p>
              <p>
                Pro Karte: Avatar, Name, Geburtstag mit kleinem Jahr, Teilnehmer-Chip, Budget-Chip
                und ein kleines 🗑 zum Löschen, falls dieses Jahr keins gebraucht wird. Manuell
                hinzufügen geht über das <strong>+</strong> rechts unten (z.B. um ein vergessenes
                Vorjahres-Geschenk nachzutragen).
              </p>
            </>
          }
          mock={<MockStackCard />}
        />

        <Step
          n={4}
          icon="📝"
          title="Wunschliste pflegen"
          body={
            <>
              <p>
                Eigene Wünsche unter dem <strong>Wunschliste</strong>-Tab — wird nur sichtbar, wenn du
                deine Identität gesetzt hast. Wünsche von anderen sieht man auf der jeweiligen
                Person-Detail-Seite.
              </p>
              <p>
                Pro Wunsch: Titel reicht. Optional Link + Preis — gut, wenn jemand grade konkret
                stöbert.
              </p>
            </>
          }
          mock={<MockWishItem />}
        />

        <Step
          n={5}
          icon="🎁"
          title="Geschenk vorbereiten"
          body={
            <>
              <p>
                In der Übersicht auf eine Karte tippen — du landest im <strong>Geschenk-Detail</strong>.
              </p>
              <p>Drei Sektionen:</p>
              <ul className="list-disc list-inside space-y-1 mt-1 ml-1 text-[13px] leading-[1.6]">
                <li>
                  <strong>Teilnehmer</strong> — wer macht mit. Bei vielen klick <em>„Alle hinzufügen"</em>.
                </li>
                <li>
                  <strong>Vorschläge</strong> — Ideen mit Link/Preis. Über das ✏-Icon kann jeder
                  später Titel/Link/Preis anpassen, das ✕ löscht.
                </li>
                <li>
                  <strong>Abstimmung</strong> — wenn ihr nicht einig seid.
                </li>
              </ul>
              <p className="mt-2">
                Das <strong>Live-Budget</strong> (<em>Anzahl × Betrag pro Kopf</em>) hilft beim Limit
                im Auge behalten.
              </p>
            </>
          }
          mock={<MockBudget />}
        />

        <Step
          n={6}
          icon="🗳️"
          title="Abstimmen"
          body={
            <>
              <p>
                <strong>Abstimmung starten</strong> klicken → jeder Teilnehmer sieht einen Stimm-Kreis
                rechts an jedem Vorschlag. <strong>Eine Stimme pro Person</strong>, sofort sichtbar
                (transparente Wahl).
              </p>
              <p>
                Stimme ändern? Einfach auf einen anderen Vorschlag klicken — der Banner oben zeigt
                jederzeit, für was du gerade gestimmt hast.
              </p>
              <p>
                Beim <strong>Beenden</strong> kompakte Übersicht mit Top-Vorschlag + Prozenten;
                <em> Details</em>-Klick öffnet Modal mit allen Vorschlägen + Bars + Voter-Avataren.
              </p>
            </>
          }
          mock={<MockVoteCircle />}
        />

        <Step
          n={7}
          icon="✅"
          title="Auswahl + Kauf"
          body={
            <>
              <p>
                Nach der Abstimmung könnt ihr Vorschläge mit der lila <strong>Checkbox links</strong>{" "}
                als <em>„wir nehmen das"</em> markieren. <strong>Mehrere gleichzeitig sind erlaubt</strong> —
                die App rechnet die <strong>theoretische Gesamtsumme</strong> live, listet die ausgewählten
                Titel mit Preisen und erlaubt einzelnes Entfernen.
              </p>
              <p>
                Auch nach geschlossener Abstimmung könnt ihr die Auswahl bearbeiten oder die Abstimmung
                wieder öffnen — das Ergebnis bleibt erhalten.
              </p>
              <p>
                Ist alles besorgt: ganz unten <strong>„✓ Geschenk erhalten"</strong> — verschwindet aus der
                Übersicht, bleibt unter <em>Person → Geschenke</em> in der Historie.
              </p>
            </>
          }
          mock={<MockSelected />}
        />

        <Step
          n={8}
          icon="🗑️"
          title="Aufräumen"
          body={
            <>
              <p>An jeder Stelle gibt's ein Lösch-Icon:</p>
              <ul className="list-disc list-inside space-y-1 mt-1 ml-1 text-[13px] leading-[1.6]">
                <li>
                  <strong>Übersicht-Karte:</strong> 🗑 rechts.
                </li>
                <li>
                  <strong>Geschenk-Detail:</strong> roter Knopf ganz unten.
                </li>
                <li>
                  <strong>Vorschlag:</strong> ✕ auf der Karte (✏ = bearbeiten).
                </li>
                <li>
                  <strong>Wunsch / Person:</strong> 🗑 in der jeweiligen Liste.
                </li>
              </ul>
              <p className="mt-2">
                Löschen ist <em>endgültig</em>, daher gibt's überall einen kurzen Bestätigungs-Dialog.
                Wenn du dich selbst (deine Identität) löschst, wird der Identitäts-Schlüssel
                automatisch zurückgesetzt — kein Geist-Account.
              </p>
            </>
          }
        />

        <Step
          n={9}
          icon="💬"
          title="Feedback"
          body={
            <>
              <p>
                Was nervt? Was fehlt? Unter{" "}
                <Link to="/feedback" className="text-violet-700 dark:text-violet-400 font-semibold">
                  Einstellungen → Feedback
                </Link>{" "}
                kannst du Wünsche eintragen. Alle sehen alles, jeder kann editieren oder als
                erledigt markieren — Trust-Prinzip wie überall.
              </p>
            </>
          }
        />

        {/* Trust principle reminder */}
        <div className="rounded-2xl px-4 py-4 mt-2 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900">
          <div className="text-[15px] font-bold text-violet-700 dark:text-violet-300 mb-1">
            🤝 Trust-Prinzip
          </div>
          <p className="text-[13px] leading-[1.55] text-stone-700 dark:text-stone-300">
            Es gibt keine echten Accounts. Identität ist nur ein Label, das du selber wählst. Jeder
            mit dem Gruppen-Passwort kann alles. Das ist <strong>so gewollt</strong> — wir wollen
            kein Permission-System für Menschen, denen wir Geschenke kaufen.
          </p>
        </div>
      </div>

      <div className="px-4 pb-24">
        <Button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} variant="secondary" className="w-full">
          ↑ Zurück nach oben
        </Button>
      </div>
    </div>
  );
}

// ── Step block ────────────────────────────────────────────────
function Step({
  n,
  icon,
  title,
  body,
  mock,
}: {
  n: number;
  icon: string;
  title: string;
  body: React.ReactNode;
  mock?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-stone-800 rounded-[20px] border border-[#F0EBE6] dark:border-[#3A3633] overflow-hidden">
      <div className="flex items-stretch">
        <div
          className="flex flex-col items-center justify-start pt-4 pb-4 w-14 shrink-0 text-white"
          style={{ background: "linear-gradient(180deg, #4F46E5, #7C3AED)" }}
        >
          <div className="text-[11px] font-bold tracking-[0.1em] opacity-90">SCHRITT</div>
          <div className="text-[28px] font-extrabold leading-none mt-1">{n}</div>
          <div className="text-2xl mt-2">{icon}</div>
        </div>
        <div className="flex-1 px-4 py-4 min-w-0">
          <h3 className="m-0 mb-2 text-[16px] font-bold text-stone-900 dark:text-stone-50 tracking-tight">
            {title}
          </h3>
          <div className="text-[13px] leading-[1.55] text-stone-600 dark:text-stone-300 space-y-1.5">
            {body}
          </div>
        </div>
      </div>
      {mock && (
        <div className="border-t border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/40 px-4 py-3">
          {mock}
        </div>
      )}
    </div>
  );
}

// ── Mocks (CSS-rendered, no real screenshots) ─────────────────
const ANNA = { id: "demo-anna", name: "Anna", birthday: "06-15", color: pickColor("Anna"), createdAt: 0 };
const BEN = { id: "demo-ben", name: "Ben", birthday: "07-02", color: pickColor("Ben"), createdAt: 0 };

function MockTopBar() {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[13px] font-semibold text-stone-900 dark:text-stone-50">🎁 Geschenke</div>
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-500 flex items-center justify-center text-[11px] font-bold">
          ?
        </div>
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-1 pr-3 py-1 inline-flex items-center gap-2">
          <Avatar person={ANNA} size={22} />
          <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-200">Ich: Anna</span>
        </div>
      </div>
    </div>
  );
}

function MockPeopleGrid() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[ANNA, BEN].map((p) => (
        <div
          key={p.id}
          className="p-3 bg-white dark:bg-stone-800 rounded-[14px] border border-[#F0EBE6] dark:border-[#3A3633] flex flex-col gap-1.5"
        >
          <Avatar person={p} size={28} />
          <div className="text-[12px] font-bold text-stone-900 dark:text-stone-50">{p.name}</div>
          <Chip variant="accent" className="self-start">in 12 T.</Chip>
        </div>
      ))}
    </div>
  );
}

function MockStackCard() {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2.5 bg-white dark:bg-stone-800 rounded-[14px] border border-[#F0EBE6] dark:border-[#3A3633]">
      <Avatar person={BEN} size={32} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-stone-900 dark:text-stone-50">
          Ben <span className="text-stone-400 font-medium">· 2. Jul</span>{" "}
          <span className="text-[9px] font-semibold text-stone-400 tracking-wide">2026</span>
        </div>
        <div className="text-[11px] text-stone-500">in 12 T. · seit 5 T. im Stack</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-1">
          <Chip variant="neutral" className="text-[10px]">3 👥</Chip>
          <Chip variant="accent" className="text-[10px]">30 €</Chip>
        </div>
        <div className="w-5 h-5 rounded-full border border-stone-200 dark:border-stone-700 text-stone-400 flex items-center justify-center text-[10px]">
          🗑
        </div>
      </div>
    </div>
  );
}

function MockWishItem() {
  return (
    <div className="px-3 py-2.5 bg-white dark:bg-stone-800 rounded-[14px] border border-[#F0EBE6] dark:border-[#3A3633]">
      <div className="text-[13px] font-semibold text-stone-900 dark:text-stone-50">Gute Kopfhörer</div>
      <div className="flex gap-2.5 mt-1 items-center text-[11px]">
        <span className="text-violet-700 dark:text-violet-300 font-semibold">120 €</span>
        <span className="text-stone-400 inline-flex items-center gap-0.5">
          <Icon.link size={11} /> Link
        </span>
      </div>
    </div>
  );
}

function MockBudget() {
  return (
    <div className="px-3 py-2.5 rounded-[12px] bg-stone-50 dark:bg-stone-800/60 border border-[#F0EBE6] dark:border-[#3A3633] flex items-center justify-between">
      <div className="text-[12px]">
        <span className="text-[14px] font-bold text-stone-900 dark:text-stone-50">3 ×</span>{" "}
        <span
          className="font-semibold text-stone-900 dark:text-stone-50"
          style={{ borderBottom: "1px dashed #7C3AED" }}
        >
          10 €
        </span>{" "}
        <span className="mx-0.5">=</span>
      </div>
      <div className="text-[18px] font-extrabold text-violet-700 dark:text-violet-300 tabular-nums">30 €</div>
    </div>
  );
}

function MockVoteCircle() {
  return (
    <div className="space-y-1.5">
      <div
        className="px-3 py-2 rounded-[10px] flex items-center gap-2"
        style={{
          background: "rgba(124, 58, 237, 0.08)",
          border: "1px solid rgba(124, 58, 237, 0.2)",
        }}
      >
        <span className="text-sm">✓</span>
        <div className="text-[12px] flex-1">
          <span className="text-stone-500 dark:text-stone-400">Du hast gewählt:</span>{" "}
          <span className="font-semibold text-stone-900 dark:text-stone-50">Kopfhörer</span>
        </div>
      </div>
      <div className="px-3 py-2 rounded-[10px] bg-white dark:bg-stone-800 border border-[#F0EBE6] dark:border-[#3A3633] flex items-center gap-2">
        <div className="flex-1 text-[13px] font-bold text-stone-900 dark:text-stone-50">Kopfhörer</div>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
        >
          <Icon.check size={12} />
        </div>
      </div>
    </div>
  );
}

function MockSelected() {
  return (
    <div className="px-3 py-2.5 rounded-[12px] bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] font-bold text-violet-700 dark:text-violet-300">2 ausgewählt</div>
        <div className="text-[16px] font-extrabold text-violet-700 dark:text-violet-300 tabular-nums">45 €</div>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-stone-700 dark:text-stone-200">Kopfhörer</span>
          <span className="text-violet-700 dark:text-violet-300 font-semibold">25 €</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-stone-700 dark:text-stone-200">Karte</span>
          <span className="text-violet-700 dark:text-violet-300 font-semibold">20 €</span>
        </div>
      </div>
    </div>
  );
}

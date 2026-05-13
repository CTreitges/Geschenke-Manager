import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Button, Chip, Icon, PageHeader } from "@/components/ui";
import { pickColor } from "@/lib/colors";
import {
  CURRENT_DATE,
  CURRENT_VERSION,
  PATCH_NOTES,
  formatPatchDate,
} from "@/lib/patchnotes";

const PATCH_PAGE = 3;

export default function Tutorial() {
  const [visibleNotes, setVisibleNotes] = useState(PATCH_PAGE);
  const shownNotes = PATCH_NOTES.slice(0, visibleNotes);
  const remaining = Math.max(0, PATCH_NOTES.length - shownNotes.length);
  const nextChunk = Math.min(PATCH_PAGE, remaining);

  return (
    <div>
      <PageHeader
        title="So funktioniert's"
        subtitle="Alles drin, in 10 kleinen Schritten"
        right={
          <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 tabular-nums whitespace-nowrap">
            {CURRENT_VERSION} · {formatPatchDate(CURRENT_DATE)}
          </span>
        }
      />

      {/* Patch notes */}
      <div className="px-4 pb-5">
        <div className="rounded-2xl bg-white dark:bg-stone-800 border border-[#F0EBE6] dark:border-[#3A3633] overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-700">
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50">
                Was ist neu?
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                Kurz prüfen, ob sich's lohnt nochmal reinzuschauen.
              </div>
            </div>
            <div className="text-2xl shrink-0">✨</div>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-700">
            {shownNotes.map((note, i) => (
              <div key={note.version} className="px-4 py-3">
                <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                  <div
                    className={
                      i === 0
                        ? "text-[13px] font-extrabold text-violet-700 dark:text-violet-300 tabular-nums"
                        : "text-[13px] font-bold text-stone-500 dark:text-stone-400 tabular-nums"
                    }
                  >
                    {note.version}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {formatPatchDate(note.date)}
                  </div>
                  {i === 0 && (
                    <span className="text-[10px] font-bold tracking-wide uppercase text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/40">
                      neu
                    </span>
                  )}
                </div>
                <ul className="list-disc list-inside text-[13px] leading-[1.55] text-stone-700 dark:text-stone-200 space-y-0.5 marker:text-stone-400">
                  {note.highlights.map((h, j) => (
                    <li key={j}>{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {remaining > 0 && (
            <button
              onClick={() => setVisibleNotes((v) => v + PATCH_PAGE)}
              className="w-full px-4 py-3 text-[13px] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 border-t border-stone-100 dark:border-stone-700 flex items-center justify-center gap-1.5"
            >
              {nextChunk} {nextChunk === 1 ? "ältere Version" : "ältere Versionen"} laden
              <Icon.chev size={12} className="rotate-90" />
            </button>
          )}
        </div>
      </div>

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
            Eine Trust-basierte App für deinen Freundeskreis. Jede Gruppe hat
            eine eigene ID + Passwort — du kannst zwischen mehreren Gruppen
            wechseln, eigene neu anlegen oder beitreten. Beim ersten Öffnen
            landest du automatisch hier — das Tutorial erreichst du jederzeit
            wieder über das <strong>?</strong> oben rechts oder die{" "}
            <em>Einstellungen</em>.
          </p>
          <p className="text-[13px] leading-[1.5] opacity-95 mt-2">
            📲 Wenn dein Browser fragt, ob du die App{" "}
            <strong>installieren</strong> willst — sag ja. Nur dann gibt's
            Push-Benachrichtigungen zu anstehenden Geburtstagen und einen
            sauberen Standalone-Look ohne Browser-Leiste.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 space-y-4 pb-6">
        <Step
          n={1}
          icon="👥"
          title="Gruppen — eine oder mehrere"
          body={
            <>
              <p>
                Beim Login gibst du <strong>Gruppen-ID + Passwort</strong> ein.
                Über <em>„+ Neue Gruppe erstellen"</em> legst du eine eigene
                Gruppe an (ID frei wählbar, 3–30 Zeichen, plus eigenes
                Passwort).
              </p>
              <p>
                Oben rechts in der App ist ein <strong>Gruppen-Pill</strong>{" "}
                mit der aktiven ID. Tipp drauf → Dropdown mit all deinen
                gespeicherten Gruppen. Aktiv ist hervorgehoben, ein Klick
                wechselt sofort (ohne erneute Passwort-Eingabe — der Trust
                wurde beim ersten Login gesetzt).
              </p>
              <p>
                Im Dropdown rechts hinter jedem Namen ein <strong>🗑</strong>{" "}
                zum <em>Entfernen aus deiner Liste</em> (Daten bleiben auf
                dem Server). Unten <em>„+ Gruppe hinzufügen"</em> bringt dich
                wieder zur Erstellen-/Beitreten-Seite.
              </p>
              <p>
                Eine ganze Gruppe <strong>komplett vom Server löschen</strong>{" "}
                geht in den{" "}
                <Link to="/settings" className={LINK}>
                  Einstellungen
                </Link>{" "}
                unter <em>Gruppe → „Gruppe löschen"</em> — wird mit Passwort
                bestätigt (siehe Schritt 9).
              </p>
              <p>
                <strong>Auf weiteren Geräten?</strong> Entweder Gruppen-ID +
                Passwort nochmal eintippen — oder einmal{" "}
                <strong>„Mit Google anmelden"</strong> auf dem Login-Screen,
                dann tauchen deine Gruppen automatisch auf jedem Gerät mit
                demselben Google-Konto auf, ohne erneute Passwort-Eingabe.
                Anonyme Nutzung bleibt aber voll möglich.
              </p>
            </>
          }
          mock={<MockGroupSwitcherDropdown />}
        />

        <Step
          n={2}
          icon="👋"
          title="Sag, wer du bist"
          body={
            <>
              <p>
                Tippe oben rechts auf <strong>„Wer bist du?"</strong> oder geh in die{" "}
                <Link to="/settings" className={LINK}>
                  Einstellungen
                </Link>{" "}
                → <strong>„Wer bin ich?"</strong> und wähle dich aus den Personen aus.
              </p>
              <p>
                Wichtig: deine Stimmen, Vorschläge und Wünsche werden danach dir zugeordnet.
                Wechseln kannst du jederzeit — die Identität ist nur ein Label im Browser
                (kein echtes Login). Sie ist <strong>pro Gruppe</strong> getrennt:
                wechselst du die Gruppe, ist die Identität dort separat.
              </p>
            </>
          }
          mock={<MockTopBar />}
        />

        <Step
          n={3}
          icon="👥"
          title="Personen anlegen, bearbeiten, löschen"
          body={
            <>
              <p>
                <Link to="/people" className={LINK}>
                  Personen
                </Link>{" "}
                → violetter <strong>+</strong> rechts unten. Pro Person reichen{" "}
                <strong>Name + Tag/Monat</strong>. Jahr ist nicht nötig — wir wollen ja nur
                wissen, wann's wieder soweit ist.
              </p>
              <p>
                Tipp auf eine Person → <strong>Profil</strong>-Tab → Felder ändern und{" "}
                <em>Speichern</em>, oder Person komplett löschen (kaskadiert auch ihre
                Geschenke + Wünsche). Wenn du dich selbst löschst, wird deine Identität
                automatisch zurückgesetzt.
              </p>
              <p>
                <strong>E-Mail (optional)</strong> — wenn hinterlegt, bekommt die Person
                automatisch eine Erinnerung <strong>60 / 30 / 14 Tage</strong> vor ihrem
                Geburtstag, eine Wunschliste zu schreiben. Ein Klick auf den Link in der Mail
                führt sie ohne Passwort direkt rein. Abbestellen ist in jeder Mail möglich,
                und die Folge-Erinnerungen entfallen sowieso, sobald die Wunschliste etwas
                enthält.
              </p>
              <p>
                <strong>🧪 Einmal Test-Mail schicken</strong> — direkt nach dem Eintragen der
                E-Mail im <em>Profil</em>-Tab den Knopf <em>„Test-Mail an … senden"</em>{" "}
                klicken. Die Person bekommt eine echte Mail (mit funktionierendem Link)
                und sollte sie kurz im Posteingang öffnen und als <strong>„Kein Spam"</strong>{" "}
                markieren — sonst landen die späteren Geburtstags-Erinnerungen womöglich
                im Junk-Ordner. Einmal markieren reicht, die folgenden kommen dann sauber rein.
              </p>
            </>
          }
          mock={<MockPeopleGrid />}
        />

        <Step
          n={4}
          icon="📚"
          title="Die Übersicht"
          body={
            <>
              <p>
                Auf der Startseite. <strong>30 Tage vor dem Geburtstag</strong> erscheint
                jede Person automatisch hier — sortiert nach <strong>nächstem Geburtstag</strong>,
                der nächste oben. Das Geschenk-Jahr steht klein am Titel.
              </p>
              <p>
                Pro Karte: Avatar, Name + Datum + Jahr, Tage-Counter („in&nbsp;13&nbsp;T."),
                Teilnehmer-Chip, Budget-Chip und ein 🗑 zum Entfernen, falls dieses Jahr
                kein Geschenk gemacht wird.
              </p>
              <p>
                Manuell hinzufügen geht über das <strong>+</strong> rechts unten — z.B. um
                ein vergessenes Vorjahres-Geschenk nachzutragen oder ein zweites Geschenk
                im selben Jahr.
              </p>
              <p>
                Unter dem Stack: Button <strong>📦 Alte Geschenke</strong> mit allen
                erhaltenen Geschenken in chronologischer Reihenfolge. Pro Eintrag siehst
                du den Anlass, das Datum und die Gesamtsumme — Klick zeigt das volle
                Detail inkl. <em>wer was bezahlt hat</em>.
              </p>
            </>
          }
          mock={<MockStackCard />}
        />

        <Step
          n={5}
          icon="✨"
          title="Wunschliste pflegen — jederzeit"
          body={
            <>
              <p>
                Eigene Wünsche unter dem{" "}
                <Link to="/wishlist" className={LINK}>
                  Wunschliste
                </Link>
                -Tab. <strong>Identität noch nicht gesetzt?</strong> Kein Problem — direkt
                dort tippst du dich mit einem Klick aus der Personenliste rein, ohne Umweg
                über die Einstellungen. Wünsche von anderen findest du auf der jeweiligen
                Person-Detail-Seite unter dem Tab <em>Wunschliste</em> — und auch dort kann
                jeder ohne Identitäts-Pflicht reinschreiben.
              </p>
              <p>
                Pro Wunsch reicht ein <strong>Titel</strong>. Optional: <em>Link</em> +{" "}
                <em>Preis</em> unter <strong>+ Details</strong>. Jeder Wunsch zeigt
                automatisch, <strong>wann er hinzugefügt wurde</strong> („gerade eben",
                „vor 2 Std.", „gestern" oder das Datum). Neueste Wünsche stehen oben,
                löschen über das 🗑 rechts.
              </p>
            </>
          }
          mock={<MockWishItem />}
        />

        <Step
          n={6}
          icon="🎁"
          title="Geschenk-Detail im Überblick"
          body={
            <>
              <p>
                In der Übersicht auf eine Karte tippen → Geschenk-Detail mit personalisiertem
                Banner (in der Avatar-Farbe der Person).
              </p>
              <p>Sektionen, von oben nach unten:</p>
              <ul className="list-disc list-inside space-y-1 mt-1 ml-1 text-[13px] leading-[1.6]">
                <li>
                  <strong>💬 Gruppen-Link</strong> — z.B. WhatsApp-Einladung pro Geschenk
                  hinterlegen, alle finden direkt rein. Wird beim nächsten Jahr für die
                  gleiche Person + gleichen Anlass automatisch übernommen.
                </li>
                <li>
                  <strong>Teilnehmer</strong> — wer macht mit. Chip antippen = ein/aus.
                  Bei vielen Klick auf <em>„Alle hinzufügen"</em> rechts. Direkt drunter
                  das Live-Budget (<em>Anzahl × Betrag pro Kopf</em>); das Pro-Kopf-Feld
                  ist mit gestricheltem Unterstrich klickbar editierbar.
                </li>
                <li>
                  <strong>Wunschliste von [Person]</strong> — alle Wünsche der beschenkten
                  Person mit Preis, Link und Zeitstempel. Tipp auf{" "}
                  <strong>„Übernehmen"</strong> → der Wunsch landet als Vorschlag im Pool,
                  bekommt ein kleines <em>🎁&nbsp;Wunschzettel</em>-Label und zeigt
                  danach <em>„übernommen"</em>, damit ihr nichts doppelt reinpackt.
                </li>
                <li>
                  <strong>Vorschläge</strong> — Ideen sammeln mit Titel, optional Link/Preis.
                  Pro Karte: <strong>Lila Checkbox links</strong> für die Auswahl
                  (sichtbar für alle als <em>„✓ Für Gesamtsumme ausgewählt"</em>),{" "}
                  <strong>✏</strong> zum Bearbeiten,{" "}
                  <strong>✕</strong> zum Löschen.
                </li>
                <li>
                  <strong>Abstimmung</strong> — siehe Schritt 7.
                </li>
              </ul>
              <p>
                <strong>📅 Anlass + Datum</strong> — beim Anlegen kannst du frei eingeben:
                z.B. <em>„Reise"</em>, <em>„Hochzeit"</em>, <em>„Jubiläum"</em>. Default ist{" "}
                <em>Geburtstag</em>. Per Checkbox <em>„Anderes Datum"</em> kannst du den
                Stack-Termin vom Person-Geburtstag entkoppeln.
              </p>
              <p>
                <strong>💶 Nach „Geschenk erhalten"</strong> öffnet sich automatisch der
                Dialog <em>„Wer hat was bezahlt?"</em>. Pro Vorschlag wählst du den
                Bezahler aus der Teilnehmer-Liste — die Zusammenfassung (wer zahlt wie
                viel) bleibt oben im Geschenk-Detail sichtbar und kann jederzeit
                nachbearbeitet werden.
              </p>
              <p>
                Ganz unten: roter <em>Geschenk löschen</em>-Knopf, falls ihr es doch nicht
                verfolgen wollt — funktioniert auch für vergangene Geschenke.
              </p>
            </>
          }
          mock={<MockWishlistAdopt />}
        />

        <Step
          n={7}
          icon="🗳️"
          title="Abstimmen — und die eigene Stimme bearbeiten"
          body={
            <>
              <p>
                <strong>„Abstimmung starten"</strong> klicken → jeder Teilnehmer sieht
                rechts an jedem Vorschlag einen Stimm-Kreis. <strong>Eine Stimme pro
                Person</strong>, sofort sichtbar (transparente Wahl, keine Geheimwahl).
              </p>
              <p>
                Oben in der Vorschläge-Sektion ein Banner <em>„Du hast gewählt: …"</em> mit
                Knopf <strong>Zurücknehmen</strong>. Klick auf einen anderen Vorschlag =
                Stimme ändern. Alles bleibt für alle live sichtbar.
              </p>
              <p>
                <strong>„Abstimmung beenden"</strong> zeigt ein kompaktes Ergebnis mit
                Top-Vorschlag und Prozenten; <em>Details</em> öffnet ein Modal mit allen
                Vorschlägen + Bars + Voter-Avataren. Optional auch{" "}
                <em>„Wieder öffnen"</em> oder <em>„Verwerfen"</em>.
              </p>
            </>
          }
          mock={<MockVoteCircle />}
        />

        <Step
          n={8}
          icon="✅"
          title="Auswahl + Kauf"
          body={
            <>
              <p>
                Unabhängig von der Abstimmung könnt ihr Vorschläge mit der lila Checkbox
                links als <strong>„wir nehmen das"</strong> markieren — auch{" "}
                <strong>mehrere</strong>. Die App listet die Auswahl mit Titeln und Preisen,
                rechnet die <strong>theoretische Gesamtsumme</strong> live und erlaubt
                einzelnes Entfernen.
              </p>
              <p>
                Das funktioniert auch nach geschlossener Abstimmung — Auswahl bearbeiten,
                Vorschläge ändern, Stimmen-Ergebnis bleibt erhalten und ist über{" "}
                <em>Details</em> jederzeit nachschlagbar.
              </p>
              <p>
                Ist alles besorgt: ganz unten <strong>„✓ Geschenk erhalten"</strong> — das
                Geschenk verschwindet aus der Übersicht und bleibt unter{" "}
                <em>Person → Geschenke</em> in der Historie.
              </p>
            </>
          }
          mock={<MockSelected />}
        />

        <Step
          n={9}
          icon="⚙️"
          title="Einstellungen"
          body={
            <>
              <p>
                In der{" "}
                <Link to="/settings" className={LINK}>
                  Einstellungen
                </Link>
                -Seite findest du:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-1 ml-1 text-[13px] leading-[1.6]">
                <li>
                  <strong>Konto</strong> — zeigt, ob du gerade <em>anonym</em>{" "}
                  (Gerät-gebunden) bist oder <em>mit Google</em> verknüpft
                  (E-Mail wird angezeigt). Verknüpfen geht hier mit einem Klick;
                  Abmelden ebenso. Mit Google synchronisiert sich deine
                  Mitgliedschaft automatisch auf jedes Gerät mit demselben
                  Konto.
                </li>
                <li>
                  <strong>📲 App installieren</strong> — wenn dein Browser einen
                  Install-Prompt zeigt, einmal annehmen. Auf iOS: Safari →
                  Teilen-Knopf → <em>„Zum Home-Bildschirm"</em>. Erst dann ist
                  die App standalone (eigenes Icon, kein Browser-UI, eigener
                  Splashscreen).
                </li>
                <li>
                  <strong>🔔 Push-Benachrichtigungen</strong> — Toggle aktiviert
                  eine Push aufs Handy, sobald eine Person in den{" "}
                  <em>30-Tage-Stack</em> rutscht. Funktioniert nur in der
                  installierten App und nach einmaliger Erlaubnis im
                  System-Dialog. Pro Gruppe getrennt einschaltbar.
                </li>
                <li>
                  <strong>Gruppe</strong> — aktive Gruppen-ID + <em>„Gruppe löschen"</em>
                  (rot). Letzteres entfernt Personen, Geschenke, Vorschläge, Wunschlisten
                  und Abstimmungen <strong>unwiderruflich</strong> vom Server. Bestätigung
                  per Passwort-Eingabe; danach Wechsel zur nächsten gespeicherten Gruppe
                  (oder zurück zum Login).
                </li>
                <li>
                  <strong>Wer bin ich?</strong> — Identität wechseln (siehe Schritt 2)
                </li>
                <li>
                  <strong>Wo mache ich mit?</strong> — Liste aller offenen Geschenke
                  anderer Personen mit einem Toggle pro Eintrag. Anhaken = mitmachen,
                  abhaken = raus. Spart das Hin- und Herklicken durch die Stack-Karten,
                  wenn du dich für mehrere Geschenke auf einmal entscheiden willst.
                </li>
                <li>
                  <strong>Default-Budget pro Person</strong> — wird bei neuen Geschenken
                  automatisch übernommen, pro Geschenk individuell überschreibbar
                </li>
                <li>
                  <strong>Dark Mode</strong> — ist <em>Standard</em>; Toggle hier umschalten,
                  wirkt sofort
                </li>
                <li>
                  <strong>Passwort ändern</strong> — altes + neues angeben (gilt für die
                  aktive Gruppe)
                </li>
                <li>
                  <strong>Hilfe → So funktioniert's</strong> & <strong>Feedback</strong>{" "}
                  (siehe Schritt 10)
                </li>
                <li>
                  <strong>Abmelden</strong> — meldet diesen Browser ab und leert die
                  Gruppen-Liste auf diesem Gerät
                </li>
              </ul>
            </>
          }
        />

        <Step
          n={10}
          icon="💬"
          title="Feedback geben"
          body={
            <>
              <p>
                Was nervt? Was fehlt? Was wäre cool? Unter{" "}
                <Link to="/feedback" className={LINK}>
                  Einstellungen → Feedback
                </Link>{" "}
                kannst du Wünsche, Ideen, Bugs eintragen. Feedback ist{" "}
                <strong>gruppenübergreifend</strong> — egal in welcher Gruppe du gerade
                bist, alle sehen dieselbe Inbox. Jeder kann editieren oder als{" "}
                <em>erledigt</em> markieren — Trust-Prinzip wie überall.
              </p>
              <p>
                Wenn deine Identität gesetzt ist, wird das Feedback dir zugeordnet (kleiner
                Avatar). Sonst landet es als <em>anonym</em> in der Liste — auch das ist
                völlig okay.
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
            Innerhalb einer Gruppe gibt es keine echten Rollen. Identität ist nur
            ein Label, das du selber wählst. Jeder mit dem Gruppen-Passwort kann
            alles. Das ist <strong>so gewollt</strong> — wir wollen kein
            Permission-System für Menschen, denen wir Geschenke kaufen.
          </p>
          <p className="text-[12px] leading-[1.55] text-stone-600 dark:text-stone-400 mt-1.5">
            Daten anderer Gruppen sind seit v1.2.0 backend-seitig abgeschottet —
            ohne Passwort kommt da niemand rein. Google-Login ist optional und
            verknüpft nur dein Gerät mit einem stabilen Konto.
          </p>
        </div>
      </div>

      <div className="px-4 pb-24">
        <Button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          variant="secondary"
          className="w-full"
        >
          ↑ Zurück nach oben
        </Button>
      </div>
    </div>
  );
}

const LINK = "text-violet-700 dark:text-violet-400 font-semibold";

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
      <div className="flex items-center gap-1">
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-2 pr-1.5 py-1 inline-flex items-center gap-1">
          <Icon.users size={11} />
          <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-200">Jeg</span>
          <Icon.chev size={10} className="rotate-90 text-stone-400" />
        </div>
        <div className="w-6 h-6 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-500 flex items-center justify-center text-[11px] font-bold">
          ?
        </div>
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-1 pr-2 py-1 inline-flex items-center gap-1">
          <Avatar person={ANNA} size={20} />
          <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-200">Anna</span>
        </div>
      </div>
    </div>
  );
}

function MockGroupSwitcherDropdown() {
  const rowBase =
    "px-2.5 py-1.5 flex items-center gap-1.5 text-[11px]";
  return (
    <div className="flex gap-2">
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-2 pr-1.5 py-1 inline-flex items-center gap-1 self-start">
        <Icon.users size={11} />
        <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-200">Jeg</span>
        <Icon.chev size={10} className="rotate-90 text-stone-400" />
      </div>
      <div className="flex-1 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-md overflow-hidden">
        <div className="px-2.5 pt-1.5 pb-1 text-[9px] font-bold tracking-[0.05em] uppercase text-stone-400">
          Deine Gruppen
        </div>
        <div className={`${rowBase} bg-violet-50 dark:bg-violet-950/40`}>
          <Icon.check size={11} className="text-violet-700 dark:text-violet-300" />
          <span className="flex-1 font-bold text-stone-900 dark:text-stone-50">Jeg</span>
          <Icon.trash size={11} className="text-stone-300" />
        </div>
        <div className={rowBase}>
          <span className="w-2.5" />
          <span className="flex-1 text-stone-700 dark:text-stone-200">familie-müller</span>
          <Icon.trash size={11} className="text-stone-300" />
        </div>
        <div className="border-t border-stone-100 dark:border-stone-700" />
        <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
          <Icon.plus size={11} /> Gruppe hinzufügen
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
      <div className="flex gap-2.5 mt-1 items-center text-[11px] flex-wrap">
        <span className="text-violet-700 dark:text-violet-300 font-semibold">120 €</span>
        <span className="text-stone-400 inline-flex items-center gap-0.5">
          <Icon.link size={11} /> Link
        </span>
        <span className="text-stone-400">vor 2 Tagen</span>
      </div>
    </div>
  );
}

function MockWishlistAdopt() {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold tracking-wide text-stone-400 uppercase pl-0.5">
        Wunschliste von Anna
      </div>
      <div
        className="px-3 py-2 rounded-[12px] flex items-start gap-2"
        style={{
          background: "rgba(245, 158, 11, 0.06)",
          border: "1px solid rgba(245, 158, 11, 0.25)",
        }}
      >
        <span className="text-base leading-none mt-0.5">🎁</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-stone-900 dark:text-stone-50">
            Gute Kopfhörer
          </div>
          <div className="flex gap-2 mt-0.5 text-[10px] items-center flex-wrap">
            <span className="text-violet-700 dark:text-violet-300 font-semibold">120 €</span>
            <span className="text-stone-400">vor 2 Tagen</span>
          </div>
        </div>
        <div
          className="px-2 py-1 rounded-md text-[10px] font-semibold text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
        >
          Übernehmen
        </div>
      </div>
      <div className="text-[10px] font-bold tracking-wide text-stone-400 uppercase pt-1 pl-0.5">
        Vorschläge
      </div>
      <div className="px-3 py-2 rounded-[12px] bg-white dark:bg-stone-800 border border-[#F0EBE6] dark:border-[#3A3633] flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-[4px] flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
        >
          <Icon.check size={10} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-stone-900 dark:text-stone-50">
            Gute Kopfhörer
          </div>
          <div className="flex gap-1.5 text-[10px] items-center flex-wrap">
            <span className="text-violet-700 dark:text-violet-300 font-semibold">120 €</span>
            <span className="text-stone-400">von Ben</span>
            <span className="text-amber-700 dark:text-amber-400 font-semibold">
              🎁 Wunschzettel
            </span>
          </div>
        </div>
      </div>
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
        <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">
          Zurücknehmen
        </span>
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

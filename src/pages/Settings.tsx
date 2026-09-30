import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CURRENT_VERSION, CURRENT_DATE, formatPatchDate } from "@/lib/patchnotes";
import { Avatar, Button, Card, Chip, Dialog, Icon, Input, PageHeader, Toggle } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { useIdentityPrompt } from "@/components/IdentitySheet";
import {
  changePasswordCF,
  deleteGroupCF,
  setActiveGroup,
  setDefaultParticipation,
  updateSettings,
} from "@/lib/storage";
import { signInWithGoogle, signOutAndReanon, useFirebaseUser } from "@/lib/firebase";
import {
  enablePushForGroup,
  sendTestPush,
  setPushPrefs,
  unregisterPushOnLogout,
  usePushState,
} from "@/lib/messaging";
import { pushPlatform, type PushPlatform } from "@/lib/pushState";
import {
  getCachedInstallPrompt,
  isStandalonePWA,
  onInstallPromptChange,
  tryInstallPwa,
  wasPwaInstalledEver,
} from "@/lib/pwa";
import { daysUntilBirthday, formatBirthday } from "@/lib/birthdays";
import {
  getKnownGroups,
  removeKnownGroup,
  setAuthed,
  setGroupId,
  useGroupId,
  useIdentity,
} from "@/lib/auth";
import { toast } from "sonner";

export default function Settings() {
  const { persons, settings } = useStore();
  const identityPrompt = useIdentityPrompt();
  const nav = useNavigate();
  const identity = useIdentity() ?? "";
  const groupId = useGroupId();
  const me = persons.find((p) => p.id === identity);
  const fbUser = useFirebaseUser();
  const [budget, setBudget] = useState(settings.defaultBudget);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  // (alte myParticipations-Logik durch person.defaultParticipantIds ersetzt.)

  useEffect(() => {
    setBudget(settings.defaultBudget);
  }, [settings.defaultBudget]);

  async function chooseIdentity() {
    const result = await identityPrompt.open();
    if (result.kind === "picked") toast.success(`Du bist jetzt ${result.name}`);
  }

  function toggleDark() {
    const next = !settings.darkMode;
    updateSettings({ darkMode: next });
    if (next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  async function changePassword() {
    if (!oldPw || !newPw || !groupId) return;
    try {
      await changePasswordCF(groupId, oldPw, newPw);
      setOldPw("");
      setNewPw("");
      toast.success("Passwort geändert");
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "functions/permission-denied") {
        toast.error("Aktuelles Passwort falsch");
      } else {
        console.error(err);
        toast.error("Passwort ändern fehlgeschlagen");
      }
    }
  }

  function logout() {
    // Push-Token dieses Geräts abmelden (liest den Merker sofort, der Rest läuft im Hintergrund).
    void unregisterPushOnLogout();
    setActiveGroup(null);
    setAuthed(false);
    nav("/login");
  }

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function signOutGoogle() {
    if (!confirm("Bei Google abmelden? Du wirst danach wieder anonym auf diesem Gerät und musst der Gruppe ggf. mit Passwort erneut beitreten.")) {
      return;
    }
    setLinkingGoogle(true);
    try {
      setActiveGroup(null);
      setAuthed(false);
      await signOutAndReanon();
      toast.success("Bei Google abgemeldet");
      nav("/login");
    } catch (err) {
      console.error(err);
      toast.error("Abmelden fehlgeschlagen");
    } finally {
      setLinkingGoogle(false);
    }
  }

  async function linkGoogle() {
    setLinkingGoogle(true);
    try {
      const outcome = await signInWithGoogle("settings");
      if (outcome.kind === "redirect") {
        // PWA-Modus — Browser lädt jetzt neu, App.tsx übernimmt nach Reload.
        return;
      }
      const result = outcome.result;
      if (result.linked) {
        toast.success("Mit Google verknüpft 🎉");
      } else if (result.switched) {
        toast.message("Anderes Google-Konto übernommen", {
          description: "Tritt der Gruppe einmal mit Passwort bei — dann ist auch dieses Konto Mitglied.",
        });
        setAuthed(false);
        nav("/login");
      } else {
        toast.success("Mit Google angemeldet");
      }
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // silent
      } else if (code === "auth/operation-not-allowed") {
        toast.error("Google-Login ist im Firebase-Projekt noch nicht aktiviert");
      } else {
        console.error(err);
        toast.error("Verknüpfung fehlgeschlagen");
      }
    } finally {
      setLinkingGoogle(false);
    }
  }

  async function confirmDeleteGroup() {
    if (!groupId) return;
    if (!deletePw) {
      toast.error("Passwort eingeben");
      return;
    }
    setDeleteBusy(true);
    try {
      try {
        await deleteGroupCF(groupId, deletePw);
      } catch (err) {
        const code = (err as { code?: string })?.code ?? "";
        if (code === "functions/permission-denied") {
          toast.error("Falsches Passwort");
        } else {
          console.error(err);
          toast.error("Löschen fehlgeschlagen");
        }
        return;
      }
      removeKnownGroup(groupId);
      toast.success(`Gruppe „${groupId}" gelöscht`);
      const remaining = getKnownGroups();
      setDeleteOpen(false);
      setDeletePw("");
      if (remaining.length > 0) {
        setGroupId(remaining[0]);
      } else {
        setActiveGroup(null);
        setAuthed(false);
        nav("/login");
      }
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Einstellungen" />

      <div className="px-4 pb-24">
        <Group title="Konto">
          <Row
            label={
              fbUser?.isAnonymous === false
                ? `Google · ${fbUser.email ?? "verknüpft"}`
                : "Anonym (Gerät-gebunden)"
            }
            hint={
              fbUser?.isAnonymous === false
                ? "Du bist mit Google angemeldet — alle Geräte mit diesem Google-Konto teilen Mitgliedschaft."
                : "Verknüpfe mit Google, um auf weiteren Geräten ohne Neu-Beitritt rein zu kommen."
            }
            icon={<Icon.lock />}
          >
            {fbUser?.isAnonymous === false ? (
              <button
                onClick={signOutGoogle}
                disabled={linkingGoogle}
                className="text-xs font-semibold text-red-600 dark:text-red-300 px-2.5 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
              >
                {linkingGoogle ? "Melde ab…" : "Abmelden"}
              </button>
            ) : (
              <button
                onClick={linkGoogle}
                disabled={linkingGoogle}
                className="text-xs font-semibold text-violet-700 dark:text-violet-300 px-2.5 py-1.5 rounded-md hover:bg-violet-50 dark:hover:bg-violet-950 disabled:opacity-50"
              >
                {linkingGoogle ? "Verknüpfe…" : "Mit Google verknüpfen"}
              </button>
            )}
          </Row>
        </Group>

        <Group title="Gruppe">
          <Row label="Aktive Gruppe" hint="Teile ID + Passwort mit deinen Freunden" icon={<Icon.users />}>
            <span className="text-sm font-bold text-stone-900 dark:text-stone-50 tabular-nums">
              {groupId ?? "—"}
            </span>
          </Row>
          <Row
            label="Gruppe löschen"
            hint="Personen, Geschenke + Abstimmungen unwiderruflich entfernen"
            icon={<Icon.trash />}
            danger
            onClick={() => {
              setDeletePw("");
              setDeleteOpen(true);
            }}
          >
            <Icon.chev className="text-stone-400" />
          </Row>
        </Group>

        <Group title="Wer bin ich?">
          <div className="p-3.5">
            <button
              type="button"
              onClick={() => void chooseIdentity()}
              aria-haspopup="dialog"
              className="flex min-h-14 w-full items-center gap-3 text-left"
            >
              {me ? (
                <Avatar person={me} size={40} />
              ) : (
                <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-lg">
                  👋
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-fg">{me ? me.name : "Noch nicht gewählt"}</span>
                <span className="block text-meta text-fg-muted">Deine Stimmen, Ideen und Wünsche laufen unter diesem Namen.</span>
              </span>
              <span className="shrink-0 text-meta font-semibold text-accent-text">{me ? "Ändern" : "Auswählen"}</span>
            </button>
            <p className="m-0 mt-2 text-xs text-fg-muted">
              🤫 Deine Wahl schützt auch vor Spoilern: Geschenke für dich siehst du nicht.
            </p>
          </div>
        </Group>

        <Group
          title={me ? `Wo macht ${me.name} mit?` : "Meine Teilnahmen"}
          collapsible
          defaultOpen={false}
          collapsedSummary={
            me
              ? (() => {
                  const active = persons.filter(
                    (p) =>
                      p.id !== me.id &&
                      (p.defaultParticipantIds ?? []).includes(me.id),
                  ).length;
                  const total = Math.max(0, persons.length - 1);
                  return `Bei ${active} von ${total} Personen aktiv`;
                })()
              : "Identität wählen, um Teilnahmen zu setzen"
          }
          hint="Tippen zum Bearbeiten"
        >
          {!me ? (
            <div className="px-3.5 py-3 text-[13px] text-stone-500 dark:text-stone-400 leading-snug">
              Wähle oben „Wer bin ich?" — danach kannst du hier pro Person
              an- und abhaken, ob du bei ihren Geschenken mitmachst.
            </div>
          ) : persons.filter((p) => p.id !== me.id).length === 0 ? (
            <div className="px-3.5 py-3 text-[13px] text-stone-500 dark:text-stone-400 leading-snug">
              Noch keine anderen Personen in der Gruppe.
            </div>
          ) : (
            <>
              <div className="px-3.5 py-2.5 text-[12px] text-stone-500 dark:text-stone-400 border-b border-[#F5F1ED] dark:border-stone-700">
                Toggle setzt deine Standard-Teilnahme. Wirkt sofort auf alle
                offenen und bestätigten Geschenke der Person.
              </div>
              {persons
                .filter((p) => p.id !== me.id)
                .map((p, i) => {
                  const isDefault =
                    p.defaultParticipantIds?.includes(me.id) ?? false;
                  const days = daysUntilBirthday(p);
                  return (
                    <div
                      key={p.id}
                      className={`px-3.5 py-3 flex items-center gap-3 ${
                        i > 0
                          ? "border-t border-[#F5F1ED] dark:border-stone-700"
                          : ""
                      }`}
                    >
                      <Avatar person={p} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                          {p.name}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          {formatBirthday(p)}
                          {days != null && days >= 0
                            ? ` · in ${days} T.`
                            : ""}
                        </div>
                      </div>
                      <Toggle
                        on={isDefault}
                        onChange={() =>
                          setDefaultParticipation(p.id, me.id, !isDefault)
                        }
                      />
                    </div>
                  );
                })}
            </>
          )}
        </Group>

        <Group title="Geschenke">
          <Row label="Default-Budget pro Person" hint="Für neue Geschenke">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                onBlur={() => {
                  updateSettings({ defaultBudget: budget });
                  toast.success("Gespeichert");
                }}
                className="w-16 px-2 py-1.5 text-right rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-semibold outline-none"
              />
              <span className="text-stone-500 dark:text-stone-400">€</span>
            </div>
          </Row>
        </Group>

        <Group title="Aussehen">
          <Row label="Dark Mode" icon={<Icon.moon />}>
            <Toggle on={settings.darkMode} onChange={toggleDark} />
          </Row>
        </Group>

        <Group title="Hilfe">
          <Row label="So funktioniert's" hint="Step-by-Step Tutorial" icon={<Icon.gift />} onClick={() => nav("/tutorial")}>
            <Icon.chev className="text-stone-400" />
          </Row>
          <Row label="Feedback" hint="Wünsche, Ideen, Bugs" icon={<Icon.mail />} onClick={() => nav("/feedback")}>
            <Icon.chev className="text-stone-400" />
          </Row>
        </Group>

        <PwaInstallGroup />

        <Group title="Mitteilungen">
          <NotificationsBlock groupId={groupId} />
        </Group>

        <Group title="Sicherheit">
          <Row label="Passwort ändern" icon={<Icon.lock />}>
            <Icon.chev className="text-stone-400" />
          </Row>
          <div className="px-3.5 pb-3.5 -mt-2 flex flex-col gap-2">
            <Input
              type="password"
              placeholder="Aktuelles Passwort"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Neues Passwort"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <button
              onClick={changePassword}
              disabled={!oldPw || !newPw}
              className="text-sm font-semibold text-violet-700 dark:text-violet-400 disabled:opacity-50"
            >
              Passwort ändern
            </button>
          </div>
          <Row label="Abmelden" icon={<Icon.x />} onClick={logout} danger />
        </Group>

        <div className="text-center py-5 pb-1.5 text-[11px] text-stone-400 space-y-0.5">
          <div>Geschenke-Manager · {CURRENT_VERSION} · {formatPatchDate(CURRENT_DATE)}</div>
          <div className="text-stone-300 dark:text-stone-600">Build {new Date(__BUILD_TIME__).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          if (!deleteBusy) {
            setDeleteOpen(false);
            setDeletePw("");
          }
        }}
        title={`Gruppe „${groupId}" löschen?`}
        footer={
          <div className="flex gap-2 pt-1 pb-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteOpen(false);
                setDeletePw("");
              }}
              disabled={deleteBusy}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteGroup}
              disabled={deleteBusy || !deletePw}
              className="flex-1"
            >
              {deleteBusy ? "Lösche…" : "Endgültig löschen"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 pb-2">
          <div className="text-[13px] leading-[1.55] text-stone-700 dark:text-stone-200">
            Das löscht <strong>alle Personen, Geschenke, Vorschläge,
            Wunschlisten und Abstimmungen</strong> dieser Gruppe vom Server.
            Andere Mitglieder verlieren ebenfalls den Zugriff. Diese Aktion ist
            <strong> nicht umkehrbar</strong>.
          </div>
          <div className="text-[12px] text-stone-500 dark:text-stone-400">
            Feedback bleibt erhalten — es ist gruppenübergreifend.
          </div>
          <Input
            type="password"
            placeholder="Gruppen-Passwort zur Bestätigung"
            value={deletePw}
            onChange={(e) => setDeletePw(e.target.value)}
            autoFocus
          />
        </div>
      </Dialog>
    </>
  );
}

/** Anleitung, wie man blockierte Mitteilungen wieder erlaubt. */
function deniedHelp(platform: PushPlatform): string {
  if (platform === "ios") {
    return "Blockiert – so geht's: iPhone-Einstellungen → Mitteilungen → Geschenke → „Mitteilungen erlauben“.";
  }
  if (platform === "android") {
    return "Blockiert – so geht's: App-Symbol lange drücken → App-Info → Benachrichtigungen → erlauben (im Browser: Schloss-Symbol → Berechtigungen).";
  }
  return "Blockiert – so geht's: Schloss-Symbol links neben der Adresse → Benachrichtigungen → Zulassen, dann Seite neu laden.";
}

function NotificationsBlock({ groupId }: { groupId: string | null }) {
  const { state, prefs } = usePushState(groupId);
  const [busy, setBusy] = useState<null | "setup" | "stack" | "polls" | "test">(null);
  const platform = pushPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  const ready = state === "on" && !!groupId;

  // Direkt aus dem Tap: enablePushForGroup fragt als Erstes die Berechtigung an.
  async function setup() {
    if (!groupId || busy) return;
    setBusy("setup");
    try {
      await enablePushForGroup(groupId);
      toast.success("Mitteilungen aktiv 🔔");
    } catch (err) {
      console.error(err);
      toast.error((err as Error)?.message ?? "Einrichten fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  async function togglePref(kind: "stack" | "polls") {
    if (!groupId || busy) return;
    setBusy(kind);
    try {
      // Beide Werte explizit schreiben: sonst würde „Geburtstage aus“ über
      // notifyPolls ?? notifyStack auch die Abstimmungen abschalten.
      await setPushPrefs(groupId, {
        notifyStack: kind === "stack" ? !prefs.stack : prefs.stack,
        notifyPolls: kind === "polls" ? !prefs.polls : prefs.polls,
      });
    } catch (err) {
      console.error(err);
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  async function testPush() {
    if (!groupId || busy) return;
    setBusy("test");
    try {
      const sent = await sendTestPush(groupId);
      if (sent > 0) toast.success(sent === 1 ? "An 1 Gerät verschickt" : `An ${sent} Geräte verschickt`);
      else toast.error("Kein Gerät erreicht – richte Mitteilungen auf diesem Gerät neu ein");
    } catch (err) {
      console.error(err);
      toast.error("Test-Push fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  }

  let deviceHint: string;
  let deviceAction: ReactNode;
  if (!groupId) {
    deviceHint = "Erst einer Gruppe beitreten";
    deviceAction = <Chip variant="neutral">—</Chip>;
  } else if (state === null) {
    deviceHint = "Prüfe dieses Gerät …";
    deviceAction = <Chip variant="neutral">prüfe…</Chip>;
  } else if (state === "on") {
    deviceHint = `Mitteilungen für die Gruppe „${groupId}“ kommen auf dieses Gerät.`;
    deviceAction = <Chip variant="success">✓ aktiv</Chip>;
  } else if (state === "off") {
    deviceHint = "Einmal erlauben, dann kommen Mitteilungen auf dieses Gerät.";
    deviceAction = (
      <Button size="sm" onClick={setup} disabled={busy !== null}>
        {busy === "setup" ? "…" : "Einrichten"}
      </Button>
    );
  } else if (state === "denied") {
    deviceHint = deniedHelp(platform);
    deviceAction = <Chip variant="neutral">blockiert</Chip>;
  } else if (state === "needs-install") {
    deviceHint =
      "Auf dem iPhone kommen Mitteilungen nur, wenn die App auf dem Home-Bildschirm liegt: Safari → Teilen → „Zum Home-Bildschirm“, dann von dort öffnen.";
    deviceAction = <Chip variant="info">erst installieren</Chip>;
  } else {
    deviceHint = "Dieser Browser unterstützt keine Mitteilungen.";
    deviceAction = <Chip variant="neutral">nicht verfügbar</Chip>;
  }

  return (
    <>
      <Row label="Dieses Gerät" hint={deviceHint} icon={<span aria-hidden="true">🔔</span>}>
        {deviceAction}
      </Row>
      <Row
        label="Geburtstage"
        hint="30 Tage vorher, wenn jemand in den Stack rutscht"
        icon={<span aria-hidden="true">🎂</span>}
      >
        <label className="contents">
          <span className="sr-only">Geburtstage</span>
          <Toggle on={ready && prefs.stack} onChange={() => togglePref("stack")} disabled={!ready || busy !== null} />
        </label>
      </Row>
      <Row
        label="Abstimmungen"
        hint="Start und Erinnerung – nie für dein eigenes Geschenk"
        icon={<span aria-hidden="true">🗳️</span>}
      >
        <label className="contents">
          <span className="sr-only">Abstimmungen</span>
          <Toggle on={ready && prefs.polls} onChange={() => togglePref("polls")} disabled={!ready || busy !== null} />
        </label>
      </Row>
      <Row label="Test-Push senden" hint="Prüft, ob Mitteilungen ankommen" icon={<span aria-hidden="true">📨</span>}>
        <Button variant="secondary" size="sm" onClick={testPush} disabled={!ready || busy !== null}>
          {busy === "test" ? "…" : "Senden"}
        </Button>
      </Row>
      <div className="px-3.5 pb-3 pt-1 text-xs text-stone-500 dark:text-stone-400">
        ℹ️ Ohne „Wer bin ich?“ keine Abstimmungs-Pushes (Spoiler-Schutz).
      </div>
    </>
  );
}

function PwaInstallGroup() {
  const [hasPrompt, setHasPrompt] = useState(!!getCachedInstallPrompt());
  const [installedEver, setInstalledEver] = useState(wasPwaInstalledEver());
  const [installing, setInstalling] = useState(false);
  const standalone = isStandalonePWA();

  useEffect(() => {
    return onInstallPromptChange(() => {
      setHasPrompt(!!getCachedInstallPrompt());
      setInstalledEver(wasPwaInstalledEver());
    });
  }, []);

  // App läuft als installierte PWA → Bereich komplett ausblenden.
  if (standalone) return null;

  async function handleInstall() {
    if (!hasPrompt) {
      toast.message("Dein Browser bietet gerade keinen Direkt-Install", {
        description:
          "Android/Edge/Chrome: Menü → „App installieren“. iPhone/iPad: Safari → Teilen → „Zum Home-Bildschirm“.",
      });
      return;
    }
    setInstalling(true);
    try {
      const outcome = await tryInstallPwa();
      if (outcome === "accepted") {
        toast.success("App installiert 🎉");
        setInstalledEver(true);
      } else if (outcome === "dismissed") {
        toast.message("Installation abgebrochen");
      } else {
        toast.error("Installieren nicht möglich");
      }
    } finally {
      setInstalling(false);
    }
  }

  if (installedEver) {
    return (
      <Group title="App">
        <Row
          label="App ist installiert"
          hint="Öffne sie über das Icon auf dem Startbildschirm oder Dock — dort gibt's auch Push-Benachrichtigungen."
          icon={<Icon.check />}
        >
          <Chip variant="accent">✓ aktiv</Chip>
        </Row>
      </Group>
    );
  }

  return (
    <Group title="App">
      <Row
        label="App installieren"
        hint={
          hasPrompt
            ? "Eigenes Icon, Vollbild-Modus, Push-Benachrichtigungen."
            : "iPhone/iPad: Safari → Teilen → „Zum Home-Bildschirm“. Android: Menü → „App installieren“."
        }
        icon={<Icon.gift />}
      >
        <Button
          onClick={handleInstall}
          variant={hasPrompt ? "primary" : "secondary"}
          size="sm"
          disabled={installing}
        >
          {installing ? "…" : hasPrompt ? "📲 Installieren" : "So geht's"}
        </Button>
      </Row>
    </Group>
  );
}

function Group({
  title,
  children,
  collapsible,
  defaultOpen = true,
  hint,
  collapsedSummary,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  hint?: string;
  /** Text, der in der einzelnen Zeile innerhalb der Karte angezeigt wird,
   *  wenn die Gruppe zugeklappt ist. Wirkt zusammen mit `collapsible`. */
  collapsedSummary?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!collapsible) {
    return (
      <div className="mb-4">
        <div className="text-[11px] font-bold tracking-[0.05em] uppercase text-stone-400 px-3.5 pt-1.5 pb-1.5">
          {title}
        </div>
        <Card className="p-0 overflow-hidden">{children}</Card>
      </div>
    );
  }
  // Collapsible mit sichtbarer Karte — Header bleibt einheitlich zu den
  // anderen Settings-Gruppen, die erste Zeile der Karte ist klickbar
  // (Aufklapp-Toggle) und zeigt im zugeklappten Zustand eine knappe
  // Zusammenfassung.
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold tracking-[0.05em] uppercase text-stone-400 px-3.5 pt-1.5 pb-1.5">
        {title}
      </div>
      <Card className="p-0 overflow-hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full px-3.5 py-3 flex items-center gap-3 text-left hover:bg-stone-50 dark:hover:bg-stone-700/40 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">
              {open ? "Zuklappen" : (collapsedSummary ?? "Aufklappen")}
            </div>
            {!open && hint && (
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {hint}
              </div>
            )}
          </div>
          <Icon.chev
            size={16}
            className={`text-stone-400 transition-transform shrink-0 ${
              open ? "rotate-[270deg]" : "rotate-90"
            }`}
          />
        </button>
        {open && (
          <div className="border-t border-[#F5F1ED] dark:border-stone-700">
            {children}
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({
  label,
  hint,
  icon,
  children,
  onClick,
  danger,
}: {
  label: string;
  hint?: string;
  icon?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`px-3.5 py-3 flex items-center gap-3 border-t border-[#F5F1ED] dark:border-stone-700 first:border-t-0 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {icon && (
        <div
          className={`w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 ${
            danger
              ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
              : "bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-200"
          }`}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-semibold ${
            danger ? "text-red-700 dark:text-red-300" : "text-stone-900 dark:text-stone-50"
          }`}
        >
          {label}
        </div>
        {hint && <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  );
}


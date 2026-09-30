import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleUserRound, KeyRound, LogOut, Moon, Trash2, UserRoundCheck, UsersRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { CURRENT_VERSION, CURRENT_DATE, formatPatchDate } from "@/lib/patchnotes";
import { Avatar, Button, Icon, PageHeader, Switch, useConfirm } from "@/components/ui";
import { HelpEntries, useInstallApp } from "@/components/HelpMenu";
import { useIdentityPrompt } from "@/components/IdentitySheet";
import { DeleteGroupSheet } from "@/components/settings/DeleteGroupSheet";
import { NotificationsBlock } from "@/components/settings/NotificationsBlock";
import { ParticipationSheet, participationCount } from "@/components/settings/ParticipationSheet";
import { PasswordSheet } from "@/components/settings/PasswordSheet";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsGroup";
import { useMyId, useStore } from "@/lib/hooks";
import { setActiveGroup, updateSettings } from "@/lib/storage";
import { signInWithGoogle, signOutAndReanon, useFirebaseUser } from "@/lib/firebase";
import { unregisterPushOnLogout } from "@/lib/messaging";
import { getKnownGroups, removeKnownGroup, setAuthed, setGroupId, useGroupId } from "@/lib/auth";

// Einstellungen: Du → Mitteilungen → Gruppe → Darstellung → Konto → Hilfe → Gefahrenzone.
export default function Settings() {
  const { persons, settings, members } = useStore();
  const identityPrompt = useIdentityPrompt();
  const confirm = useConfirm();
  const nav = useNavigate();
  const identity = useMyId() ?? "";
  const groupId = useGroupId();
  const me = persons.find((p) => p.id === identity);
  const fbUser = useFirebaseUser();
  const { canInstall, install, guide } = useInstallApp();
  const [budget, setBudget] = useState(settings.defaultBudget);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [sheet, setSheet] = useState<null | "participation" | "password" | "delete">(null);

  useEffect(() => {
    setBudget(settings.defaultBudget);
  }, [settings.defaultBudget]);

  const participation = me ? participationCount(persons, me.id) : null;
  const claimed = members.filter((m) => !!m.identityPersonId).length;
  const googleLinked = fbUser?.isAnonymous === false;

  async function chooseIdentity() {
    const result = await identityPrompt.open();
    if (result.kind === "picked") toast.success(`Du bist jetzt ${result.name}`);
  }

  function toggleDark() {
    const next = !settings.darkMode;
    updateSettings({ darkMode: next });
    document.documentElement.classList.toggle("dark", next);
  }

  function saveBudget() {
    if (budget === settings.defaultBudget) return;
    updateSettings({ defaultBudget: budget });
    toast.success("Gespeichert");
  }

  async function leaveOnThisDevice() {
    const ok = await confirm({
      title: `Gruppe „${groupId}“ auf diesem Gerät verlassen?`,
      body: "Mitteilungen für dieses Gerät werden abgemeldet. Mit Gruppen-ID und Passwort kommst du jederzeit wieder rein.",
      confirmLabel: "Verlassen",
      tone: "danger",
    });
    if (!ok) return;
    // Push-Token dieses Geräts abmelden (liest den Merker sofort, der Rest läuft im Hintergrund).
    void unregisterPushOnLogout();
    setActiveGroup(null);
    setAuthed(false);
    nav("/login");
  }

  async function unlinkGoogle() {
    const ok = await confirm({
      title: "Google-Konto trennen?",
      body: "Du bist danach wieder anonym auf diesem Gerät und musst der Gruppe ggf. mit Passwort erneut beitreten.",
      confirmLabel: "Trennen",
    });
    if (!ok) return;
    setLinkingGoogle(true);
    try {
      setActiveGroup(null);
      setAuthed(false);
      await signOutAndReanon();
      toast.success("Google-Konto getrennt");
      nav("/login");
    } catch (err) {
      console.error(err);
      toast.error("Trennen fehlgeschlagen");
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

  function afterGroupDeleted() {
    if (!groupId) return;
    removeKnownGroup(groupId);
    setSheet(null);
    const remaining = getKnownGroups();
    if (remaining.length > 0) {
      setGroupId(remaining[0]);
    } else {
      setActiveGroup(null);
      setAuthed(false);
      nav("/login");
    }
  }

  return (
    <>
      <PageHeader title="Einstellungen" />

      <div className="px-4 pb-24">
        <SettingsGroup title="Du">
          <button
            type="button"
            onClick={() => void chooseIdentity()}
            aria-haspopup="dialog"
            className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2/60"
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
          <p className="m-0 px-3.5 pb-3 text-xs text-fg-muted">
            <span aria-hidden>🤫 </span>Deine Wahl schützt auch vor Spoilern: Geschenke für dich siehst du nicht.
          </p>
          {me && participation ? (
            <SettingsRow
              label="Wo mache ich mit?"
              hint={`Bei ${participation.active} von ${participation.total} Personen dabei`}
              icon={<UsersRound size={18} />}
              onClick={() => setSheet("participation")}
              opensDialog
            />
          ) : (
            <SettingsRow
              label="Wo mache ich mit?"
              hint="Erst „Wer bin ich?“ wählen, dann pro Person an- und abhaken."
              icon={<UsersRound size={18} />}
            />
          )}
        </SettingsGroup>

        <SettingsGroup title="Mitteilungen">
          <NotificationsBlock groupId={groupId} />
        </SettingsGroup>

        {/* Gruppen-IDs unterscheiden Groß/Klein – nicht in Versalien setzen */}
        <SettingsGroup
          title={
            <>
              Gruppe <span className="normal-case">„{groupId ?? "—"}“</span>
            </>
          }
        >
          <SettingsRow label="Gruppen-ID" hint="Teile ID + Passwort mit deinen Freunden" icon={<Icon.users size={18} />}>
            <span className="text-sm font-bold tabular-nums text-fg">{groupId ?? "—"}</span>
          </SettingsRow>
          <SettingsRow label="Standard-Budget pro Person" hint="Für neue Geschenke" icon={<Wallet size={18} />}>
            <span className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                aria-label="Standard-Budget pro Person in Euro"
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                onBlur={saveBudget}
                className="w-20 rounded-tile border border-line-control bg-surface px-2 py-1.5 text-right font-semibold text-fg outline-none focus:border-accent"
              />
              <span className="text-fg-muted">€</span>
            </span>
          </SettingsRow>
          <SettingsRow
            label={`${members.length} ${members.length === 1 ? "Konto" : "Konten"} beigetreten`}
            hint={`${claimed} davon mit „Wer bin ich?“ · ${persons.length} Personen angelegt`}
            icon={<UserRoundCheck size={18} />}
          />
        </SettingsGroup>

        <SettingsGroup title="Darstellung">
          <SettingsRow label="Dunkler Modus" hint="Gilt für die ganze Gruppe" icon={<Moon size={18} />}>
            <Switch label="Dunkler Modus" checked={settings.darkMode} onChange={toggleDark} />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Konto">
          <SettingsRow
            label={googleLinked ? `Google · ${fbUser?.email ?? "verknüpft"}` : "Nicht mit Google verknüpft"}
            hint={
              googleLinked
                ? "Alle Geräte mit diesem Google-Konto teilen die Mitgliedschaft."
                : "Verknüpfe mit Google, um auf weiteren Geräten ohne Neu-Beitritt reinzukommen."
            }
            icon={<CircleUserRound size={18} />}
          >
            {googleLinked ? (
              <Button variant="secondary" size="sm" onClick={() => void unlinkGoogle()} loading={linkingGoogle}>
                Trennen
              </Button>
            ) : (
              <Button size="sm" onClick={() => void linkGoogle()} loading={linkingGoogle}>
                Verknüpfen
              </Button>
            )}
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Hilfe">
          {/* dieselben Einträge wie das Hilfe-Sheet („?“) */}
          <div className="p-1.5">
            <HelpEntries go={(to) => nav(to)} onInstall={canInstall ? () => void install() : undefined} />
          </div>
        </SettingsGroup>

        <SettingsGroup title="Gefahrenzone" tone="danger">
          <SettingsRow
            label="Passwort ändern"
            hint="Wer schon drin ist, bleibt angemeldet"
            icon={<KeyRound size={18} />}
            onClick={() => setSheet("password")}
            opensDialog
          />
          <SettingsRow
            label="Gruppe auf diesem Gerät verlassen"
            hint="Zurück geht's mit Gruppen-ID und Passwort"
            icon={<LogOut size={18} />}
            onClick={() => void leaveOnThisDevice()}
            opensDialog
            danger
          />
          <SettingsRow
            label="Gruppe endgültig löschen"
            hint="Personen, Geschenke und Abstimmungen für alle entfernen"
            icon={<Trash2 size={18} />}
            onClick={() => setSheet("delete")}
            opensDialog
            danger
          />
        </SettingsGroup>

        <div className="space-y-0.5 pb-1.5 pt-2 text-center text-2xs text-fg-muted">
          <div>
            Geschenke-Manager · {CURRENT_VERSION} · {formatPatchDate(CURRENT_DATE)}
          </div>
          <div>
            Build{" "}
            {new Date(__BUILD_TIME__).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {me && (
        <ParticipationSheet open={sheet === "participation"} onClose={() => setSheet(null)} me={me} persons={persons} />
      )}
      <PasswordSheet open={sheet === "password"} onClose={() => setSheet(null)} groupId={groupId} />
      <DeleteGroupSheet open={sheet === "delete"} onClose={() => setSheet(null)} groupId={groupId} onDeleted={afterGroupDeleted} />
      {guide}
    </>
  );
}

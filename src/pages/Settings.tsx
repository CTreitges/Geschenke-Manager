import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Button, Card, Chip, Dialog, Icon, Input, PageHeader, Toggle } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { changePasswordCF, deleteGroupCF, setActiveGroup, toggleParticipant, updateSettings } from "@/lib/storage";
import { signInWithGoogle, signOutAndReanon, useFirebaseUser } from "@/lib/firebase";
import {
  disablePushForGroup,
  enablePushForGroup,
  isPushSupported,
  usePushEnabled,
} from "@/lib/messaging";
import {
  getCachedInstallPrompt,
  isStandalonePWA,
  onInstallPromptChange,
  tryInstallPwa,
  wasPwaInstalledEver,
} from "@/lib/pwa";
import { pickColor } from "@/lib/colors";
import { daysUntilBirthday } from "@/lib/birthdays";
import {
  getKnownGroups,
  removeKnownGroup,
  setAuthed,
  setGroupId,
  setIdentity,
  useGroupId,
  useIdentity,
} from "@/lib/auth";
import { toast } from "sonner";

export default function Settings() {
  const { persons, gifts, settings } = useStore();
  const nav = useNavigate();
  const identity = useIdentity() ?? "";
  const groupId = useGroupId();
  const me = persons.find((p) => p.id === identity);
  const fbUser = useFirebaseUser();
  const [budget, setBudget] = useState(settings.defaultBudget);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  const myParticipations = useMemo(() => {
    if (!me) return [];
    return gifts
      .filter(
        (g) =>
          (g.status === "open" || g.status === "confirmed") &&
          g.personId !== me.id,
      )
      .map((g) => ({ gift: g, person: persons.find((p) => p.id === g.personId) }))
      .filter((x): x is { gift: typeof gifts[number]; person: typeof persons[number] } => !!x.person)
      .sort((a, b) => {
        const da = daysUntilBirthday(a.person) ?? 9999;
        const db = daysUntilBirthday(b.person) ?? 9999;
        return da - db;
      });
  }, [gifts, persons, me]);

  useEffect(() => {
    setBudget(settings.defaultBudget);
  }, [settings.defaultBudget]);

  function pickIdentity(id: string) {
    setIdentity(id || null);
    const p = persons.find((x) => x.id === id);
    if (p) toast.success(`Du bist jetzt ${p.name}`);
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
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-2 leading-snug">
              Beeinflusst, wem deine Stimmen, Vorschläge und Wünsche zugeordnet werden.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {persons.length === 0 && (
                <p className="text-sm text-stone-400">Lege erst eine Person an.</p>
              )}
              {persons.map((p) => {
                const active = identity === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => pickIdentity(p.id)}
                    className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[13px] font-semibold border transition-colors"
                    style={
                      active
                        ? {
                            background: `linear-gradient(135deg, ${p.color || pickColor(p.id)}, ${(p.color || pickColor(p.id))}dd)`,
                            color: "#fff",
                            border: "1px solid transparent",
                          }
                        : { background: "transparent" }
                    }
                  >
                    <Avatar person={p} size={22} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </Group>

        <Group title={me ? `Wo macht ${me.name} mit?` : "Meine Teilnahmen"}>
          {!me ? (
            <div className="px-3.5 py-3 text-[13px] text-stone-500 dark:text-stone-400 leading-snug">
              Wähle oben „Wer bin ich?" — danach kannst du hier pro Geschenk
              an- und abhaken, ob du mitmachst.
            </div>
          ) : myParticipations.length === 0 ? (
            <div className="px-3.5 py-3 text-[13px] text-stone-500 dark:text-stone-400 leading-snug">
              Aktuell keine offenen Geschenke. Sobald 30 Tage vor einem
              Geburtstag eines im Stack landet, taucht es hier auf.
            </div>
          ) : (
            myParticipations.map(({ gift: g, person: p }, i) => {
              const joined = g.participantIds.includes(me.id);
              const days = daysUntilBirthday(p);
              return (
                <div
                  key={g.id}
                  className={`px-3.5 py-3 flex items-center gap-3 ${
                    i > 0 ? "border-t border-[#F5F1ED] dark:border-stone-700" : ""
                  }`}
                >
                  <Avatar person={p} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                      {p.name}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Geschenk {g.year}
                      {days != null && days >= 0 ? ` · in ${days} T.` : ""}
                      {` · ${g.participantIds.length} dabei`}
                    </div>
                  </div>
                  <Toggle
                    on={joined}
                    onChange={() => toggleParticipant(g.id, me.id)}
                  />
                </div>
              );
            })
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
          <PushNotificationsRow groupId={groupId} />
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

        <div className="text-center py-5 pb-1.5 text-[11px] text-stone-400">
          Geschenke-Manager · v0.4 · trust-based
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

function PushNotificationsRow({ groupId }: { groupId: string | null }) {
  const enabled = usePushEnabled(groupId);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isPushSupported().then((s) => {
      if (!cancelled) setSupported(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (!groupId || busy) return;
    setBusy(true);
    try {
      if (enabled) {
        await disablePushForGroup(groupId);
        toast.success("Benachrichtigungen aus");
      } else {
        await enablePushForGroup(groupId);
        setPermission(Notification.permission);
        toast.success("Benachrichtigungen aktiv 🔔");
      }
    } catch (err) {
      console.error(err);
      const msg = (err as Error)?.message ?? "Fehlgeschlagen";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (supported === null) {
    return (
      <Row
        label="Push-Benachrichtigungen"
        hint="Wenn jemand in den 30-Tage-Stack rutscht"
        icon={<Icon.mail />}
      >
        <Chip variant="neutral">prüfe…</Chip>
      </Row>
    );
  }

  if (!supported) {
    return (
      <Row
        label="Push-Benachrichtigungen"
        hint="Auf diesem Gerät / Browser nicht unterstützt"
        icon={<Icon.mail />}
      >
        <Chip variant="neutral">nicht verfügbar</Chip>
      </Row>
    );
  }

  if (permission === "denied") {
    return (
      <Row
        label="Push-Benachrichtigungen"
        hint="Im Browser blockiert — Berechtigung in den Browser-Settings freigeben"
        icon={<Icon.mail />}
      >
        <Chip variant="neutral">blockiert</Chip>
      </Row>
    );
  }

  if (!groupId) {
    return (
      <Row
        label="Push-Benachrichtigungen"
        hint="Erst einer Gruppe beitreten"
        icon={<Icon.mail />}
      >
        <Chip variant="neutral">—</Chip>
      </Row>
    );
  }

  return (
    <Row
      label="Push-Benachrichtigungen"
      hint="Sobald jemand in den 30-Tage-Stack rutscht, kommt eine Push-Nachricht."
      icon={<Icon.mail />}
    >
      <Toggle on={!!enabled} onChange={toggle} disabled={busy} />
    </Row>
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold tracking-[0.05em] uppercase text-stone-400 px-3.5 pt-1.5 pb-1.5">
        {title}
      </div>
      <Card className="p-0 overflow-hidden">{children}</Card>
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

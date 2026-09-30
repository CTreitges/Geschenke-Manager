import { useState, type ReactNode } from "react";
import { Cake, Send, Smartphone, Vote } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Switch } from "@/components/ui";
import { enablePushForGroup, sendTestPush, setPushPrefs, usePushState } from "@/lib/messaging";
import { pushPlatform, type PushPlatform } from "@/lib/pushState";
import { SettingsRow } from "./SettingsGroup";

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

/** Einstellungen → Mitteilungen: Gerät einrichten, Schalter Geburtstage/Abstimmungen, Test-Push. */
export function NotificationsBlock({ groupId }: { groupId: string | null }) {
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
      <Button size="sm" onClick={setup} loading={busy === "setup"} disabled={busy !== null}>
        Einrichten
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
      <SettingsRow label="Dieses Gerät" hint={deviceHint} icon={<Smartphone size={18} />}>
        {deviceAction}
      </SettingsRow>
      <SettingsRow label="Geburtstage" hint="30 Tage vorher, wenn jemand in die Übersicht rutscht" icon={<Cake size={18} />}>
        <Switch label="Geburtstage" checked={ready && prefs.stack} onChange={() => togglePref("stack")} disabled={!ready || busy !== null} />
      </SettingsRow>
      <SettingsRow label="Abstimmungen" hint="Start und Erinnerung – nie für dein eigenes Geschenk" icon={<Vote size={18} />}>
        <Switch label="Abstimmungen" checked={ready && prefs.polls} onChange={() => togglePref("polls")} disabled={!ready || busy !== null} />
      </SettingsRow>
      <SettingsRow label="Test-Push senden" hint="Prüft, ob Mitteilungen ankommen" icon={<Send size={18} />}>
        <Button variant="secondary" size="sm" onClick={testPush} loading={busy === "test"} disabled={!ready || busy !== null}>
          Senden
        </Button>
      </SettingsRow>
      <p className="m-0 border-t border-line-subtle px-3.5 py-2.5 text-xs text-fg-muted">
        Ohne „Wer bin ich?“ keine Abstimmungs-Pushes (Spoiler-Schutz).
      </p>
    </>
  );
}

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button, Dialog } from "./ui";
import { isAuthed } from "@/lib/auth";

const TIP_KEY = "gm:test-mail-tip-seen:v1";
const TUTORIAL_KEY = "gm:tutorial-seen:v5";
const PWA_TIP_KEY = "gm:pwa-install-tip-seen:v1";

/**
 * One-time follow-up after the first-run tutorial. Reminds the user to send
 * themselves a test mail and to flag it as "not spam" so the real birthday
 * reminders later don't get quarantined. Sets a localStorage flag once
 * dismissed so it never shows again.
 */
export function TestMailTipDialog() {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const loc = useLocation();

  // Re-evaluate as soon as the PWA-install tip closes — otherwise this
  // dialog would only pop up at the next navigation.
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener("gm:pwa-install-tip-closed", handler);
    return () => window.removeEventListener("gm:pwa-install-tip-closed", handler);
  }, []);

  useEffect(() => {
    // Don't surface on the tutorial itself or while still on auth pages.
    if (loc.pathname === "/tutorial" || loc.pathname.startsWith("/login") || loc.pathname.startsWith("/m/")) return;
    if ((loc.state as Record<string, unknown>)?.fromShareLink) return;
    if (!isAuthed()) return;
    if (localStorage.getItem(TIP_KEY) === "yes") return;
    // Only after the tutorial has been auto-opened (and presumably read).
    if (localStorage.getItem(TUTORIAL_KEY) !== "yes") return;
    // Wait until the PWA-install tip has run (or self-marked as not needed),
    // so the two dialogs don't pop up at the same time.
    if (localStorage.getItem(PWA_TIP_KEY) !== "yes") return;
    setOpen(true);
  }, [loc.pathname, tick]);

  function close() {
    localStorage.setItem(TIP_KEY, "yes");
    setOpen(false);
  }

  return (
    <Dialog open={open} onClose={close} title="🧪 Letzter Tipp: Test-Mail">
      <div className="space-y-3 text-[15px] leading-snug text-stone-700 dark:text-stone-200 px-5 pb-2">
        <p>
          Trag in deinem <strong>Profil</strong> deine E-Mail-Adresse ein
          und klick auf <strong>„🧪 Test-Mail an … senden"</strong>.
        </p>
        <p>
          Wenn die Mail in deinem Postfach landet — kurz öffnen und als{" "}
          <strong>„Kein Spam"</strong> markieren. Sonst rutschen die echten
          Geburtstags-Erinnerungen später vielleicht in den Junk-Ordner.
        </p>
        <p className="text-[13px] text-stone-500 dark:text-stone-400">
          Macht idealerweise jeder Empfänger einmal. Danach kommen alle
          Erinnerungen sauber rein.
        </p>
      </div>
      <div className="px-5 pb-2 pt-3">
        <Button onClick={close} className="w-full">
          Verstanden, los geht's
        </Button>
      </div>
    </Dialog>
  );
}

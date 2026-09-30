import { useEffect, useState } from "react";
import { Toaster } from "sonner";

// Unten mittig über der Tab-Bar (h-16 = 64 px) inkl. Safe-Area. sonner nutzt
// unter 600 px Breite mobileOffset, deshalb beide setzen.
const OFFSET = { bottom: "calc(88px + env(safe-area-inset-bottom))" };

function hasDarkClass(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

/** Folgt der Klasse .dark am <html>, die App.tsx aus dem Gruppen-Setting darkMode setzt. */
function useDarkClass(): boolean {
  const [dark, setDark] = useState(hasDarkClass);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => observer.disconnect();
  }, []);
  return dark;
}

// Kein richColors: Erfolg/Fehler leuchten sonst grün/rot, auch im Dark Mode.
export function AppToaster() {
  const dark = useDarkClass();
  return (
    <Toaster
      theme={dark ? "dark" : "light"}
      position="bottom-center"
      offset={OFFSET}
      mobileOffset={OFFSET}
      duration={2600}
    />
  );
}

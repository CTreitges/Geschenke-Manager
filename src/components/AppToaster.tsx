import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { openSheetCount, subscribeSheets } from "./ui/sheetStack";

// Normal unten mittig über der Tab-Bar (h-16 = 64 px) inkl. Safe-Area.
// Solange ein Sheet offen ist oder das Tutorial läuft, oben – unten lägen die
// Toasts sonst über Sheet-Knöpfen bzw. Weiter/Überspringen.
// sonner nutzt unter 600 px Breite mobileOffset, deshalb beide setzen.
const BOTTOM = { bottom: "calc(88px + env(safe-area-inset-bottom))" };
const TOP = { top: "calc(16px + env(safe-area-inset-top))" };

/** Wo Toasts erscheinen: oben bei offenem Sheet oder im Tutorial, sonst unten. */
export function toasterPlacement(openSheets: number, pathname: string): "top" | "bottom" {
  return openSheets > 0 || pathname === "/tutorial" ? "top" : "bottom";
}

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
  const openSheets = useSyncExternalStore(subscribeSheets, openSheetCount, () => 0);
  const top = toasterPlacement(openSheets, useLocation().pathname) === "top";
  return (
    <Toaster
      theme={dark ? "dark" : "light"}
      position={top ? "top-center" : "bottom-center"}
      offset={top ? TOP : BOTTOM}
      mobileOffset={top ? TOP : BOTTOM}
      duration={2600}
    />
  );
}

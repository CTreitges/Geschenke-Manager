import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PwaInstallTipDialog } from "./PwaInstallTipDialog";
import { useIdentity } from "@/lib/auth";
import { useStore } from "@/lib/hooks";
import {
  markInstallTipSeen,
  markStepShown,
  nextOnboardingStep,
  readOnboardingFlags,
} from "@/lib/onboarding";
import { isStandalonePWA, wasPwaInstalledEver } from "@/lib/pwa";

type OnboardingFlowProps = {
  /**
   * Schritt „Wer bist du?“: öffnet das IdentitySheet (verdrahtet in App.tsx).
   * Die Aufruferin kümmert sich um die Antwort – „Später“ bzw. Schließen ohne
   * Auswahl ruft `markIdentityAsked()`, eine Auswahl setzt die Identität.
   */
  onNeedIdentity: () => void;
};

/**
 * Erster Start: zeigt höchstens EINEN Onboarding-Schritt pro App-Start und
 * nur auf „/“ (Tutorial → Identität → Install-Tipp, siehe nextOnboardingStep).
 * Direkt nach dem First-Run-Tutorial folgt ggf. noch die Identität.
 * Sitzungen, die per Share- oder Magic-Link begannen, werden nie unterbrochen.
 */
export function OnboardingFlow({ onNeedIdentity }: OnboardingFlowProps) {
  const nav = useNavigate();
  const location = useLocation();
  const identity = useIdentity();
  const { persons, personsHydrated } = useStore();
  const [installOpen, setInstallOpen] = useState(false);
  // Pro History-Eintrag höchstens einmal entscheiden (StrictMode, Re-Renders).
  const handledKey = useRef<string | null>(null);

  const afterTutorial = (location.state as { fromTutorial?: boolean } | null)?.fromTutorial === true;

  useEffect(() => {
    if (location.pathname !== "/" || handledKey.current === location.key) return;
    // Für die Frage nach der Identität muss die Personenliste da sein.
    if (!personsHydrated) return;
    handledKey.current = location.key;

    const step = nextOnboardingStep({
      ...readOnboardingFlags(),
      pathname: location.pathname,
      hasIdentity: !!identity,
      personsCount: persons.length,
      installed: isStandalonePWA() || wasPwaInstalledEver(),
      afterTutorial,
    });
    if (afterTutorial) nav("/", { replace: true, state: null }); // Signal verbrauchen
    if (!step) return;
    markStepShown();

    if (step === "tutorial") {
      nav("/tutorial", { replace: true, state: { firstRun: true } });
    } else if (step === "identity") {
      onNeedIdentity();
    } else if (step === "install-tip") {
      setInstallOpen(true);
    }
  }, [location.pathname, location.key, afterTutorial, personsHydrated, identity, persons.length, nav, onNeedIdentity]);

  return (
    <PwaInstallTipDialog
      open={installOpen}
      onClose={() => {
        markInstallTipSeen();
        setInstallOpen(false);
      }}
    />
  );
}

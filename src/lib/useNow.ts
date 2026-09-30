import { useEffect, useState } from "react";

/**
 * Aktuelle Zeit für Countdowns ohne Sekunden-Ticker: tickt alle
 * `intervalMs`, sofort beim Zurückkehren in den Tab (visibilitychange)
 * und – falls `wakeAt` gesetzt ist – genau zu diesem Zeitpunkt, damit eine
 * Frist ohne Verzögerung als abgelaufen gilt.
 */
export function useNow(intervalMs = 30_000, wakeAt?: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  useEffect(() => {
    if (wakeAt == null) return;
    const delay = wakeAt - Date.now();
    // setTimeout verträgt höchstens ~24,8 Tage; weiter entfernte Fristen holt das Intervall.
    if (delay < 0 || delay > 2_000_000_000) return;
    const id = setTimeout(() => setNow(Date.now()), delay + 50);
    return () => clearTimeout(id);
  }, [wakeAt]);

  return now;
}

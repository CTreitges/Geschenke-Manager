import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";
import { whenHistorySettled } from "./sheetStack";

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: roter Aktions-Button, Fokus startet auf „Abbrechen“. */
  tone?: "default" | "danger";
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Ersatz für window.confirm():
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Löschen?", confirmLabel: "Löschen", tone: "danger" }))) return;
 * Esc, Backdrop, ✕ und Android-Zurück ergeben false.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm() braucht einen <ConfirmProvider> (src/main.tsx).");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const answerRef = useRef<(() => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    // Eine noch offene Rückfrage gilt als abgebrochen, eine beantwortete wird zugestellt.
    resolveRef.current?.(false);
    answerRef.current?.();
    answerRef.current = null;
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const settle = (value: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    answerRef.current = resolve ? () => resolve(value) : null;
    setOptions(null);
  };

  // Antwort erst zustellen, wenn das Sheet weg ist und sein History-Eintrag
  // abgeräumt wurde – sonst würde ein navigate() direkt nach dem await vom
  // asynchronen history.back() wieder rückgängig gemacht.
  useEffect(() => {
    if (options !== null) return;
    const answer = answerRef.current;
    if (!answer) return;
    answerRef.current = null;
    void whenHistorySettled().then(answer);
  }, [options]);

  const danger = options?.tone === "danger";
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={options !== null}
        onClose={() => settle(false)}
        title={options?.title}
        initialFocusRef={danger ? cancelRef : confirmRef}
        footer={
          <div className="flex gap-2.5">
            <Button ref={cancelRef} variant="secondary" size="lg" className="flex-1" onClick={() => settle(false)}>
              {options?.cancelLabel ?? "Abbrechen"}
            </Button>
            <Button
              ref={confirmRef}
              variant={danger ? "danger" : "primary"}
              size="lg"
              className="flex-1"
              onClick={() => settle(true)}
            >
              {options?.confirmLabel ?? "Bestätigen"}
            </Button>
          </div>
        }
      >
        {options?.body != null && <div className="text-body text-fg-soft">{options.body}</div>}
      </Sheet>
    </ConfirmContext.Provider>
  );
}

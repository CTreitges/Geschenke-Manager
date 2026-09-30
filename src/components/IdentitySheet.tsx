import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BirthdayPicker } from "@/components/BirthdayPicker";
import { Avatar, Button, Icon, Input, Sheet } from "@/components/ui";
import { whenHistorySettled } from "@/components/ui/sheetStack";
import { getIdentity, setIdentity, useGroupId, useIdentity } from "@/lib/auth";
import { pickColor } from "@/lib/colors";
import { useFirebaseUser } from "@/lib/firebase";
import { useStore } from "@/lib/hooks";
import { claimedPersonIds, identityToRestore } from "@/lib/identity";
import { addPerson } from "@/lib/storage";
import type { ID, Person } from "@/lib/types";

// ── „Wer bist du?“ als Bottom-Sheet ───────────────────────────
// Ersetzt die früheren Picker (ShareGift, Wunschliste, Einstellungen).
// Programmatisch öffnen:
//   const { open } = useIdentityPrompt();
//   const result = await open({ onLater: markIdentityAsked });
// Die Auswahl setzt das Sheet selbst (setIdentity) – erst wenn es samt
// History-Eintrag geschlossen ist, damit ein navigate() danach nicht
// vom asynchronen history.back() überholt wird.

export type IdentityResult = { kind: "picked"; personId: ID } | { kind: "later" } | { kind: "dismissed" };

export type IdentityPromptOptions = {
  /** Satz unter dem Titel: warum wir gerade fragen. */
  reason?: string;
  /** Beschenkte Person des offenen Geschenks → Marker „🎂 Geburtstagskind“. */
  recipientId?: ID;
  /** Beschriftung des Auswegs unten (Standard „Später“). */
  laterLabel?: string;
  /** Wird bei „Später“ UND beim Schließen ohne Auswahl aufgerufen (z. B. markIdentityAsked). */
  onLater?: () => void;
};

type OpenFn = (options?: IdentityPromptOptions) => Promise<IdentityResult>;

const IdentityContext = createContext<OpenFn | null>(null);

export function useIdentityPrompt(): { open: OpenFn } {
  const open = useContext(IdentityContext);
  if (!open) throw new Error("useIdentityPrompt() braucht einen <IdentityProvider> (src/main.tsx).");
  return { open };
}

/**
 * Für Aktionen, die eine Identität brauchen (Idee, Abstimmen, Übernehmen):
 * liefert die aktuelle Identität oder fragt erst – danach läuft die Aktion
 * weiter. null = abgebrochen oder die beschenkte Person wurde gewählt.
 */
export function useRequireIdentity(): (options?: IdentityPromptOptions) => Promise<ID | null> {
  const { open } = useIdentityPrompt();
  return useCallback(
    async (options) => {
      const current = getIdentity();
      if (current) return current;
      const result = await open(options);
      if (result.kind !== "picked" || result.personId === options?.recipientId) return null;
      return result.personId;
    },
    [open],
  );
}

type Pending = { options: IdentityPromptOptions; resolve: (r: IdentityResult) => void };

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const answerRef = useRef<(() => void) | null>(null);
  useIdentityCloudRestore();

  const open = useCallback<OpenFn>((options = {}) => {
    return new Promise<IdentityResult>((resolve) => {
      setPending((prev) => {
        prev?.resolve({ kind: "dismissed" }); // eine offene Frage gilt als abgebrochen
        return { options, resolve };
      });
    });
  }, []);

  function settle(result: IdentityResult) {
    if (!pending) return;
    const { options, resolve } = pending;
    answerRef.current = () => {
      if (result.kind === "picked") setIdentity(result.personId);
      else options.onLater?.();
      resolve(result);
    };
    setPending(null);
  }

  // Antwort erst nach dem Schließen zustellen (siehe Kopfkommentar).
  useEffect(() => {
    if (pending !== null) return;
    const answer = answerRef.current;
    if (!answer) return;
    answerRef.current = null;
    void whenHistorySettled().then(answer);
  }, [pending]);

  return (
    <IdentityContext.Provider value={open}>
      {children}
      <Sheet open={pending !== null} onClose={() => settle({ kind: "dismissed" })} title="Wer bist du?">
        {pending && <IdentityPicker options={pending.options} onDone={settle} />}
      </Sheet>
    </IdentityContext.Provider>
  );
}

type Step = { kind: "pick" } | { kind: "confirm"; person: Person } | { kind: "create" };

function IdentityPicker({ options, onDone }: { options: IdentityPromptOptions; onDone: (r: IdentityResult) => void }) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  if (step.kind === "confirm") {
    return (
      <ConfirmStep
        person={step.person}
        onYes={() => onDone({ kind: "picked", personId: step.person.id })}
        onBack={() => setStep({ kind: "pick" })}
      />
    );
  }
  if (step.kind === "create") {
    return <CreateStep onCreated={(id) => onDone({ kind: "picked", personId: id })} onBack={() => setStep({ kind: "pick" })} />;
  }
  return (
    <PickStep
      options={options}
      onPick={(person) => setStep({ kind: "confirm", person })}
      onCreate={() => setStep({ kind: "create" })}
      onLater={() => onDone({ kind: "later" })}
    />
  );
}

function PickStep({
  options,
  onPick,
  onCreate,
  onLater,
}: {
  options: IdentityPromptOptions;
  onPick: (p: Person) => void;
  onCreate: () => void;
  onLater: () => void;
}) {
  const { persons, members, personsHydrated } = useStore();
  const myId = useIdentity();
  const user = useFirebaseUser();
  const claimed = claimedPersonIds(members, user?.uid);
  const sorted = [...persons].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const anyClaimed = sorted.some((p) => claimed.has(p.id) && p.id !== myId);

  return (
    <div className="pb-2">
      <p className="m-0 mb-3 text-meta text-fg-muted">
        {options.reason ?? "Damit dir niemand aus Versehen deine Überraschung verrät und deine Stimmen richtig zählen."}
      </p>
      {!personsHydrated ? (
        <p className="m-0 py-6 text-center text-meta text-fg-muted">Lade Personen …</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Personen">
          {sorted.map((p) => {
            const isMe = p.id === myId;
            const taken = !isMe && claimed.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-card border border-line-subtle bg-surface px-3 py-2 text-left active:scale-[0.99]"
                >
                  <Avatar person={p} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-fg">{p.name}</span>
                    {p.id === options.recipientId && <span className="block text-xs text-fg-muted">🎂 Geburtstagskind</span>}
                  </span>
                  {isMe && <span className="text-xs font-semibold text-accent-text">Das bist du</span>}
                  {taken && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                      <span aria-hidden className="h-2 w-2 rounded-full bg-status-done" />
                      schon vergeben
                    </span>
                  )}
                  <Icon.chev className="shrink-0 text-fg-muted" />
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={onCreate}
              className="flex min-h-14 w-full items-center gap-3 rounded-card border border-dashed border-line px-3 py-2 text-left text-body font-semibold text-accent-text"
            >
              <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
                <Icon.plus size={18} />
              </span>
              Ich bin noch nicht dabei → Person anlegen
            </button>
          </li>
        </ul>
      )}
      {anyClaimed && (
        <p className="m-0 mt-3 flex items-start gap-1.5 text-xs text-fg-muted">
          <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-status-done" />
          „schon vergeben“: Jemand hat sich auf einem anderen Gerät schon so eingetragen. Du kannst die Person trotzdem
          wählen, zum Beispiel auf deinem zweiten Gerät.
        </p>
      )}
      <Button variant="ghost" className="mt-3 w-full" onClick={onLater}>
        {options.laterLabel ?? "Später"}
      </Button>
    </div>
  );
}

function ConfirmStep({ person, onYes, onBack }: { person: Person; onYes: () => void; onBack: () => void }) {
  return (
    <div className="pb-2">
      <div className="flex items-center gap-3 rounded-card bg-surface-2 p-3">
        <Avatar person={person} size={44} />
        <p className="m-0 text-body font-bold text-fg">Du bist {person.name}?</p>
      </div>
      <p className="m-0 mt-3 text-body text-fg-soft">
        Dann blenden wir Geschenkideen für {person.name} vor dir aus.
      </p>
      <div className="mt-4 flex gap-2.5">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onBack}>
          Zurück
        </Button>
        <Button size="lg" className="flex-1" onClick={onYes} autoFocus>
          Ja, das bin ich
        </Button>
      </div>
    </div>
  );
}

function CreateStep({ onCreated, onBack }: { onCreated: (id: ID) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  async function create() {
    if (!trimmed || !birthday || busy) return;
    setBusy(true);
    try {
      const id = await addPerson({ name: trimmed, birthday, color: pickColor(trimmed) });
      onCreated(id);
    } catch {
      toast.error("Anlegen hat nicht geklappt – bitte nochmal");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 pb-2">
      <p className="m-0 text-meta text-fg-muted">Leg dich kurz an – deine Freunde sehen dich dann in der Gruppe.</p>
      <Input label="Dein Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <BirthdayPicker value={birthday} onChange={setBirthday} label="Dein Geburtstag" />
      <div className="flex gap-2.5 pt-1">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onBack}>
          Zurück
        </Button>
        <Button size="lg" className="flex-1" disabled={!trimmed || !birthday} loading={busy} onClick={() => void create()}>
          Anlegen
        </Button>
      </div>
    </div>
  );
}

/**
 * Cloud-Restore: Ist lokal keine Identität gesetzt, das eigene Member-Doc
 * kennt aber eine (noch existierende) Person, wird sie einmal pro Gruppe
 * und App-Start übernommen – z. B. neues Gerät mit Google-Konto.
 */
function useIdentityCloudRestore() {
  const groupId = useGroupId();
  const localId = useIdentity();
  const user = useFirebaseUser();
  const { members, persons, personsHydrated } = useStore();
  const decided = useRef<string | null>(null);

  useEffect(() => {
    if (!groupId || !personsHydrated || decided.current === groupId) return;
    if (localId) {
      decided.current = groupId; // lokal gewählt → nie mehr überschreiben
      return;
    }
    const restore = identityToRestore({ localId, uid: user?.uid, members, persons });
    if (!restore) return; // Member-Doc evtl. noch nicht da → weiter warten
    decided.current = groupId;
    setIdentity(restore);
  }, [groupId, localId, user, members, persons, personsHydrated]);
}

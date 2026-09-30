import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getKnownGroups,
  removeKnownGroup,
  setAuthed,
  setGroupId,
  useGroupId,
  useKnownGroups,
} from "@/lib/auth";
import { setActiveGroup } from "@/lib/storage";
import { Dialog, Icon, IconButton, useConfirm } from "./ui";
import { cn } from "@/lib/cn";

export function GroupSwitcher() {
  const [open, setOpen] = useState(false);
  const activeId = useGroupId();
  const known = useKnownGroups();
  const nav = useNavigate();
  const confirm = useConfirm();

  function pick(id: string) {
    if (id !== activeId) setGroupId(id);
    setOpen(false);
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: `Gruppe „${id}“ aus deiner Liste entfernen?`,
      body: "Die Daten bleiben auf dem Server – du kannst dich später mit ID + Passwort wieder einloggen.",
      confirmLabel: "Entfernen",
      tone: "danger",
    });
    if (!ok) return;
    removeKnownGroup(id);
    if (id === activeId) {
      const remaining = getKnownGroups();
      if (remaining.length > 0) {
        setGroupId(remaining[0]);
      } else {
        setActiveGroup(null);
        setAuthed(false);
        nav("/login");
      }
    }
  }

  return (
    <>
      {/* Trefferfläche 44 px, sichtbar eine 32-px-Pille wie „?“ und der Identitäts-Chip */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Gruppe wechseln (${activeId ?? "keine"})`}
        className="inline-flex min-h-tap min-w-0 items-center"
      >
        <span className="inline-flex h-8 min-w-0 max-w-[112px] items-center gap-1.5 rounded-full border border-line bg-surface pl-2.5 pr-2 shadow-sm active:scale-[0.98]">
          <Icon.users size={14} className="shrink-0 text-fg-muted" />
          <span className="truncate text-xs font-semibold text-fg-soft">{activeId ?? "—"}</span>
          <Icon.chev size={12} className="shrink-0 rotate-90 text-fg-muted" />
        </span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Gruppen">
        <div className="space-y-1.5">
          {known.length === 0 ? (
            <p className="m-0 px-1 py-2 text-sm text-fg-muted">Keine gespeicherten Gruppen auf diesem Gerät.</p>
          ) : (
            known.map((g) => {
              const active = g === activeId;
              return (
                <div
                  key={g}
                  className={cn(
                    "flex items-center gap-1 rounded-btn border pl-1",
                    active ? "border-accent/40 bg-accent-soft" : "border-line-subtle bg-surface",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => pick(g)}
                    aria-current={active ? "true" : undefined}
                    className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 px-2 text-left"
                  >
                    <Icon.users size={16} className={active ? "text-accent-text" : "text-fg-muted"} />
                    <span className={cn("flex-1 truncate text-body", active ? "font-bold text-fg" : "font-semibold text-fg-soft")}>
                      {g}
                    </span>
                    {active && (
                      <span className="rounded-md bg-surface/60 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-accent-text">
                        aktiv
                      </span>
                    )}
                  </button>
                  <IconButton label={`Gruppe ${g} aus der Liste entfernen`} size="sm" onClick={() => void remove(g)}>
                    <Icon.trash size={16} />
                  </IconButton>
                </div>
              );
            })
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              nav("/login");
            }}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-btn border-2 border-dashed border-accent/40 px-3 py-3 text-sm font-semibold text-accent-text hover:bg-accent-soft active:scale-[0.99]"
          >
            <Icon.plus size={16} /> Gruppe hinzufügen
          </button>
        </div>
      </Dialog>
    </>
  );
}

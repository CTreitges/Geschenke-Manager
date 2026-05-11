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
import { Dialog, Icon } from "./ui";
import { cn } from "@/lib/cn";

export function GroupSwitcher() {
  const [open, setOpen] = useState(false);
  const activeId = useGroupId();
  const known = useKnownGroups();
  const nav = useNavigate();

  function pick(id: string) {
    if (id !== activeId) setGroupId(id);
    setOpen(false);
  }

  function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !confirm(
        `Gruppe „${id}" aus deiner Liste entfernen?\n\nDie Daten bleiben auf dem Server — du kannst dich später mit ID + Passwort wieder einloggen.`,
      )
    )
      return;
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
      <button
        onClick={() => setOpen(true)}
        className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-2.5 pr-2 py-1.5 inline-flex items-center gap-1.5 shadow-sm active:scale-[0.98] max-w-[120px]"
        aria-label="Gruppe wechseln"
      >
        <Icon.users size={14} />
        <span className="text-xs font-semibold text-stone-700 dark:text-stone-200 truncate">
          {activeId ?? "—"}
        </span>
        <Icon.chev size={12} className="rotate-90 text-stone-400 shrink-0" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Gruppen">
        <div className="space-y-1">
          {known.length === 0 ? (
            <div className="px-1 py-2 text-sm text-stone-500 dark:text-stone-400">
              Keine gespeicherten Gruppen auf diesem Gerät.
            </div>
          ) : (
            known.map((g) => {
              const active = g === activeId;
              return (
                <div
                  key={g}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer active:scale-[0.99]",
                    active
                      ? "bg-violet-100 dark:bg-violet-950/50 border border-violet-300 dark:border-violet-800"
                      : "bg-stone-50 dark:bg-stone-800/60 border border-[#F0EBE6] dark:border-stone-700",
                  )}
                  onClick={() => pick(g)}
                >
                  <Icon.users
                    size={16}
                    className={
                      active
                        ? "text-violet-700 dark:text-violet-300"
                        : "text-stone-400"
                    }
                  />
                  <span
                    className={cn(
                      "flex-1 text-[15px] truncate",
                      active
                        ? "font-bold text-stone-900 dark:text-stone-50"
                        : "font-semibold text-stone-700 dark:text-stone-200",
                    )}
                  >
                    {g}
                  </span>
                  {active && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-md bg-white/60 dark:bg-stone-900/40">
                      aktiv
                    </span>
                  )}
                  <button
                    onClick={(e) => remove(g, e)}
                    className="text-stone-400 hover:text-red-500 p-1.5 -mr-1 shrink-0"
                    aria-label={`Gruppe ${g} entfernen`}
                    title="Aus Liste entfernen"
                  >
                    <Icon.trash size={16} />
                  </button>
                </div>
              );
            })
          )}

          <button
            onClick={() => {
              setOpen(false);
              nav("/login");
            }}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 font-semibold text-[14px] hover:bg-violet-50 dark:hover:bg-violet-950/30 active:scale-[0.99]"
          >
            <Icon.plus size={16} /> Gruppe hinzufügen
          </button>
        </div>
      </Dialog>
    </>
  );
}

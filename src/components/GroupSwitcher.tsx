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
import { Icon } from "./ui";
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
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-2.5 pr-2 py-1.5 inline-flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
        aria-label="Gruppe wechseln"
      >
        <Icon.users size={14} />
        <span className="text-xs font-semibold text-stone-700 dark:text-stone-200 max-w-[100px] truncate">
          {activeId ?? "—"}
        </span>
        <Icon.chev size={12} className="rotate-90 text-stone-400" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-full right-0 mt-1.5 z-50 w-60 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-xl overflow-hidden">
            <div className="px-3 pt-2.5 pb-1.5 text-[10px] font-bold tracking-[0.05em] uppercase text-stone-400">
              Deine Gruppen
            </div>
            {known.length === 0 ? (
              <div className="px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
                Keine gespeicherten Gruppen.
              </div>
            ) : (
              known.map((g) => {
                const active = g === activeId;
                return (
                  <div
                    key={g}
                    onClick={() => pick(g)}
                    className={cn(
                      "px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-700/40",
                      active && "bg-violet-50 dark:bg-violet-950/40",
                    )}
                  >
                    {active ? (
                      <Icon.check
                        size={14}
                        className="text-violet-700 dark:text-violet-300 shrink-0"
                      />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "flex-1 text-sm truncate",
                        active
                          ? "font-bold text-stone-900 dark:text-stone-50"
                          : "text-stone-700 dark:text-stone-200",
                      )}
                    >
                      {g}
                    </span>
                    <button
                      onClick={(e) => remove(g, e)}
                      className="text-stone-400 hover:text-red-500 p-1 shrink-0"
                      aria-label={`Gruppe ${g} entfernen`}
                      title="Aus Liste entfernen"
                    >
                      <Icon.trash size={14} />
                    </button>
                  </div>
                );
              })
            )}
            <div className="border-t border-stone-100 dark:border-stone-700" />
            <button
              onClick={() => {
                setOpen(false);
                nav("/login/new");
              }}
              className="w-full px-3 py-2.5 flex items-center gap-2 text-sm font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
            >
              <Icon.plus size={14} /> Gruppe hinzufügen
            </button>
          </div>
        </>
      )}
    </div>
  );
}

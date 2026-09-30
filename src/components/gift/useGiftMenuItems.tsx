import { useCallback } from "react";
import { CirclePause, CirclePlay } from "lucide-react";
import { toast } from "sonner";
import { Icon, useConfirm, type ActionMenuItem } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { SKIP_LOCKED_REASON, giftMenuState } from "@/lib/stack";
import { deleteGift, setGiftSkipped } from "@/lib/storage";
import type { Gift, Person } from "@/lib/types";

/**
 * Einträge fürs ⋯-Menü einer Geschenk-Karte (Home, Person → Geschenke):
 * „Diesmal aussetzen“ mit Rückgängig-Toast, „Wieder aufnehmen“ und – nur bei
 * manuell angelegten bzw. erhaltenen Geschenken – „Löschen“ mit Rückfrage.
 */
export function useGiftMenuItems(): (gift: Gift, person: Person, now: number) => ActionMenuItem[] {
  const confirm = useConfirm();
  const { polls } = useStore();

  return useCallback(
    (gift, person, now) => {
      const state = giftMenuState(gift, polls.find((p) => p.giftId === gift.id), now);
      const items: ActionMenuItem[] = [];

      const setSkipped = (on: boolean) => setGiftSkipped(gift.id, on);
      if (state.skip !== "hidden") {
        items.push({
          label: "Diesmal aussetzen",
          icon: <CirclePause size={18} />,
          disabled: state.skip === "locked",
          hint: state.skip === "locked" ? SKIP_LOCKED_REASON : "Karte ausblenden, Ideen bleiben erhalten",
          onSelect: () =>
            void setSkipped(true)
              .then(() =>
                toast(`${person.name}: diesmal ausgesetzt`, {
                  description: "Wieder aufnehmen unter Personen → Geschenke",
                  action: { label: "Rückgängig", onClick: () => void setSkipped(false) },
                }),
              )
              .catch(() => toast.error("Aussetzen hat nicht geklappt – bitte nochmal")),
        });
      }
      if (state.resume) {
        items.push({
          label: "Wieder aufnehmen",
          icon: <CirclePlay size={18} />,
          hint: "Karte erscheint wieder in der Übersicht",
          onSelect: () =>
            void setSkipped(false)
              .then(() => toast.success(`${person.name} ist wieder in der Übersicht`))
              .catch(() => toast.error("Das hat nicht geklappt – bitte nochmal")),
        });
      }
      if (state.remove) {
        items.push({
          label: "Löschen",
          icon: <Icon.trash size={18} />,
          tone: "danger",
          onSelect: async () => {
            const ok = await confirm({
              title: `Geschenk ${gift.year} für ${person.name} löschen?`,
              body: "Ideen und Abstimmung gehen mit verloren.",
              confirmLabel: "Löschen",
              tone: "danger",
            });
            if (!ok) return;
            deleteGift(gift.id)
              .then(() => toast.success("Geschenk gelöscht"))
              .catch(() => toast.error("Löschen hat nicht geklappt – bitte nochmal"));
          },
        });
      }
      return items;
    },
    [confirm, polls],
  );
}

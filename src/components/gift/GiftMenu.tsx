import { CircleCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ActionMenu, Icon, useConfirm, type ActionMenuItem } from "@/components/ui";
import type { PollModel } from "@/lib/pollModel";
import { useLeave } from "@/lib/nav";
import { lockMessage } from "@/lib/pollOps";
import { deleteGift, markReceived } from "@/lib/storage";
import type { Gift } from "@/lib/types";

// ── ⋯ im Kopf der Geschenkseite ───────────────────────────────
// Link teilen · Ohne Auswahl abschließen · Geschenk löschen. Große Schritte
// immer mit Rückfrage (useConfirm), danach zurück (Löschen) bzw. zur Übersicht.
export function GiftMenu({
  gift,
  personName,
  ideaCount,
  model,
  myId,
  onShare,
}: {
  gift: Gift;
  personName: string;
  ideaCount: number;
  model: PollModel;
  myId: string | null;
  onShare: () => void;
}) {
  const confirm = useConfirm();
  const nav = useNavigate();
  const leave = useLeave("/");

  async function finishWithoutSelection() {
    const ok = await confirm({
      title: "Ohne Auswahl abschließen?",
      body: `Das Geschenk für ${personName} gilt dann als erhalten, ohne dass eine Idee ausgewählt ist.`,
      confirmLabel: "Abschließen",
    });
    if (!ok) return;
    nav("/", { replace: true });
    markReceived(gift.id, myId)
      .then(() => toast.success("Geschenk abgeschlossen ✓"))
      .catch(() => toast.error("Abschließen hat nicht geklappt – bitte nochmal"));
  }

  async function remove() {
    const ok = await confirm({
      title: "Geschenk komplett löschen?",
      body:
        ideaCount > 0
          ? `Alle ${ideaCount} ${ideaCount === 1 ? "Idee" : "Ideen"} und die Abstimmung gehen verloren.`
          : "Die Abstimmung geht mit verloren.",
      confirmLabel: "Löschen",
      tone: "danger",
    });
    if (!ok) return;
    // Erst zurück, dann löschen – sonst blitzt „nicht gefunden“ auf.
    leave(() =>
      deleteGift(gift.id)
        .then(() => toast.success("Geschenk gelöscht"))
        .catch(() => toast.error("Löschen hat nicht geklappt – bitte nochmal")),
    );
  }

  const lock = model.locks.decideOutsideResult;
  const items: ActionMenuItem[] = [{ label: "Link teilen", icon: <Icon.share size={18} />, onSelect: onShare }];
  if (gift.status === "open") {
    items.push({
      label: "Ohne Auswahl abschließen",
      icon: <CircleCheck size={18} />,
      disabled: lock.locked,
      hint: lock.locked ? lockMessage("decideOutsideResult") : "Als erhalten markieren, ohne Idee",
      onSelect: () => void finishWithoutSelection(),
    });
  }
  items.push({
    label: "Geschenk löschen",
    icon: <Icon.trash size={18} />,
    tone: "danger",
    onSelect: () => void remove(),
  });

  return <ActionMenu items={items} title={`Geschenk für ${personName}`} />;
}

import { Clock, Flag } from "lucide-react";
import { toast } from "sonner";
import { formatEndsAt } from "@shared/poll";
import { ActionMenu, useConfirm, type ActionMenuItem } from "@/components/ui";
import type { PollModel } from "@/lib/pollModel";
import { closePoll, extendPoll } from "@/lib/storage";

const HOUR = 3_600_000;

/** ⋯ Optionen einer laufenden Abstimmung: +1 Std · +1 Tag · Jetzt beenden. */
export function PollOptionsMenu({
  giftId,
  model,
  myId,
  showLabel = false,
}: {
  giftId: string;
  model: PollModel;
  myId: string | null;
  showLabel?: boolean;
}) {
  const confirm = useConfirm();

  async function extend(ms: number) {
    try {
      const end = await extendPoll(giftId, ms);
      toast.success(`Verlängert · ${formatEndsAt(end, Date.now())}`);
    } catch {
      toast.error("Verlängern hat nicht geklappt – bitte nochmal");
    }
  }

  async function endNow() {
    const { voted, total } = model.voters;
    const ok = await confirm({
      title:
        voted < total
          ? `${voted} von ${total} haben gewählt – trotzdem beenden?`
          : "Alle haben gewählt – jetzt beenden?",
      body: "Danach seht ihr das Ergebnis und könnt festlegen, was ihr kauft.",
      confirmLabel: "Jetzt beenden",
    });
    if (!ok) return;
    try {
      await closePoll(giftId, { closedBy: myId, reason: "manual" });
    } catch {
      toast.error("Beenden hat nicht geklappt – bitte nochmal");
    }
  }

  const items: ActionMenuItem[] = [];
  // Ohne Frist (Alt-Abstimmung) würde „+1 Std“ die Wahl verkürzen.
  if (model.endsAt !== null) {
    items.push(
      { label: "+1 Std", icon: <Clock size={18} />, onSelect: () => void extend(HOUR) },
      { label: "+1 Tag", icon: <Clock size={18} />, onSelect: () => void extend(24 * HOUR) },
    );
  }
  items.push({ label: "Jetzt beenden", icon: <Flag size={18} />, onSelect: () => void endNow() });

  return <ActionMenu items={items} label="Optionen" title="Abstimmung" showLabel={showLabel} />;
}

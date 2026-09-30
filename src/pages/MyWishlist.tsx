import { useNavigate } from "react-router-dom";
import { useStore } from "@/lib/hooks";
import { useIdentity } from "@/lib/auth";
import { useIdentityPrompt } from "@/components/IdentitySheet";
import { Avatar, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { WishlistView } from "@/components/wishlist/WishlistView";
import { daysUntilBirthday } from "@/lib/birthdays";
import { nextSurprise, surpriseBanner } from "@/lib/spoiler";

export default function MyWishlist() {
  const id = useIdentity();
  const { persons, wishlist, gifts } = useStore();
  const me = persons.find((p) => p.id === id);
  const nav = useNavigate();
  const identity = useIdentityPrompt();

  if (!me) {
    return (
      <>
        <PageHeader title="Meine Wunschliste" />
        <div className="px-4 pb-24">
          <Card className="p-4">
            <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50 mb-1">
              Wer bist du?
            </div>
            <div className="text-[13px] text-stone-500 dark:text-stone-400 mb-3 leading-snug">
              Wähle dich aus, dann kannst du deine Wünsche pflegen — alle anderen sehen sie automatisch.
            </div>
            {persons.length === 0 ? (
              <EmptyState
                emoji="👥"
                title="Noch keine Personen"
                subtitle="Lege erst eine Person an."
                action={
                  <Button onClick={() => nav("/people")}>
                    Zu Personen
                  </Button>
                }
              />
            ) : (
              <Button
                className="w-full"
                aria-haspopup="dialog"
                onClick={() =>
                  void identity.open({ reason: "Dann kannst du deine Wünsche pflegen – alle anderen sehen sie sofort." })
                }
              >
                Ich wähle mich aus
              </Button>
            )}
            <div className="text-[11px] text-stone-400 mt-3">
              Du kannst die Identität jederzeit in den Einstellungen wechseln.
            </div>
          </Card>
        </div>
      </>
    );
  }

  const count = wishlist.filter((w) => w.personId === me.id && !w.fulfilledAt).length;
  const days = daysUntilBirthday(me);
  // Spoiler-Schutz: nur „es wird geplant“, nie Details oder „übernommen“.
  const surprise = nextSurprise(gifts, persons, me.id);

  return (
    <>
      <PageHeader title="Meine Wunschliste" />

      {surprise && (
        <p role="status" className="m-0 mx-4 mb-3 rounded-card border border-accent/30 bg-accent-soft px-3.5 py-3 text-meta font-medium text-fg">
          {surpriseBanner(surprise.gift.occasion, surprise.date)}
        </p>
      )}

      <div className="flex items-center gap-3 px-5 pb-3">
        <Avatar person={me} size={44} />
        <div className="min-w-0 flex-1">
          <div className="text-body font-bold text-fg">{me.name}</div>
          <div className="mt-0.5 text-xs text-fg-muted">
            {days === 0 ? "🎂 heute" : `🎂 in ${days} ${days === 1 ? "Tag" : "Tagen"}`} · {count} {count === 1 ? "Wunsch" : "Wünsche"}
          </div>
        </div>
      </div>

      <div className="px-4 pb-24">
        <WishlistView person={me} isOwner />
      </div>
    </>
  );
}

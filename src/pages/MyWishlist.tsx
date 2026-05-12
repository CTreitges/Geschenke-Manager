import { Link, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/hooks";
import { useIdentity } from "@/lib/auth";
import { setIdentity } from "@/lib/auth";
import { Avatar, Button, Card, EmptyState, Icon, Input, PageHeader } from "@/components/ui";
import { addWishItem, deleteWishItem } from "@/lib/storage";
import { formatRelativeDate } from "@/lib/dates";
import { useState } from "react";
import { toast } from "sonner";

export default function MyWishlist() {
  const id = useIdentity();
  const { persons, wishlist } = useStore();
  const me = persons.find((p) => p.id === id);
  const nav = useNavigate();

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
              <div className="flex flex-wrap gap-1.5">
                {persons.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setIdentity(p.id);
                      toast.success(`Hallo ${p.name}!`);
                    }}
                    className="inline-flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-violet-400 dark:hover:border-violet-500 active:scale-[0.98] transition-[transform,border-color]"
                  >
                    <Avatar person={p} size={26} />
                    <span className="text-[13px] font-semibold text-stone-900 dark:text-stone-50">
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="text-[11px] text-stone-400 mt-3">
              Du kannst die Identität jederzeit in den Einstellungen wechseln.
            </div>
          </Card>
        </div>
      </>
    );
  }

  const items = [...wishlist.filter((w) => w.personId === me.id)].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  return (
    <>
      <PageHeader
        title="Meine Wunschliste"
        right={
          <Link
            to={`/person/${me.id}`}
            className="text-xs font-semibold text-violet-700 dark:text-violet-400 px-2 py-1 rounded-md"
          >
            Profil →
          </Link>
        }
      />

      <div className="px-5 pb-3 flex items-center gap-3">
        <Avatar person={me} size={44} />
        <div className="flex-1">
          <div className="text-[15px] font-bold text-stone-900 dark:text-stone-50">{me.name}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {items.length} {items.length === 1 ? "Wunsch" : "Wünsche"}
          </div>
        </div>
      </div>

      <div className="px-4 pb-24">
        <Adder personId={me.id} />
        {items.length === 0 ? (
          <EmptyState
            emoji="📝"
            title="Noch keine Wünsche — leg los!"
            subtitle="Tipp die ersten Ideen ein, deine Freunde sehen sie automatisch."
          />
        ) : (
          <div className="flex flex-col gap-2 mt-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="px-3.5 py-3.5 bg-white dark:bg-stone-800 rounded-2xl border border-[#F0EBE6] dark:border-[#3A3633] flex items-start gap-2.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold text-stone-900 dark:text-stone-50 leading-snug">
                    {it.title}
                  </div>
                  <div className="flex gap-2.5 mt-1.5 items-center text-xs flex-wrap">
                    {it.price != null && (
                      <span className="text-violet-700 dark:text-violet-300 font-semibold">
                        {it.price} €
                      </span>
                    )}
                    {it.url && (
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-stone-500 dark:text-stone-400 no-underline flex items-center gap-1"
                      >
                        <Icon.link /> Link
                      </a>
                    )}
                    <span className="text-stone-400">
                      {formatRelativeDate(it.createdAt) || "—"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`„${it.title}" löschen?`)) {
                      deleteWishItem(it.id);
                      toast.success("Gelöscht");
                    }
                  }}
                  className="text-stone-400 hover:text-red-500 p-1"
                >
                  <Icon.trash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Adder({ personId }: { personId: string }) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [showExtra, setShowExtra] = useState(false);

  function add() {
    if (!text.trim()) return;
    addWishItem({
      personId,
      title: text.trim(),
      url: url.trim() || undefined,
      price: price ? +price : undefined,
    });
    toast.success("Wunsch hinzugefügt");
    setText("");
    setUrl("");
    setPrice("");
    setShowExtra(false);
  }

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg pl-1 shrink-0">✨</span>
        <input
          placeholder="Was wünschst du dir?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 min-w-0 px-1 py-2.5 border-none outline-none bg-transparent text-stone-900 dark:text-stone-50"
        />
        <button
          onClick={add}
          disabled={!text.trim()}
          className="rounded-[10px] w-9 h-9 shrink-0 flex items-center justify-center text-white"
          style={{
            background: text.trim()
              ? "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)"
              : "#D6D3D1",
          }}
        >
          <Icon.plus size={18} />
        </button>
      </div>
      {!showExtra && text && (
        <button
          onClick={() => setShowExtra(true)}
          className="block w-full mt-1 py-1 pl-7 text-left text-[12px] font-semibold text-violet-700 dark:text-violet-400"
        >
          + Link / Preis
        </button>
      )}
      {showExtra && (
        <div className="flex gap-2 mt-2.5 pl-7">
          <Input
            placeholder="Link (optional)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-[2] py-2"
          />
          <Input
            placeholder="€"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            className="flex-1 py-2"
          />
        </div>
      )}
    </Card>
  );
}

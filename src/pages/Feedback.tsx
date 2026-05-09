import { useState } from "react";
import { Avatar, Button, Card, Chip, EmptyState, Icon, Input, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { addFeedback, deleteFeedback, updateFeedback } from "@/lib/storage";
import { useIdentity } from "@/lib/auth";
import { toast } from "sonner";
import type { Feedback as FB, Person } from "@/lib/types";

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} ${d === 1 ? "Tag" : "Tagen"}`;
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

export default function Feedback() {
  const { feedback, persons } = useStore();
  const myId = useIdentity();
  const [text, setText] = useState("");

  const sorted = [...feedback].sort((a, b) => {
    if ((a.resolved ? 1 : 0) !== (b.resolved ? 1 : 0)) return (a.resolved ? 1 : 0) - (b.resolved ? 1 : 0);
    return b.createdAt - a.createdAt;
  });

  const open = sorted.filter((f) => !f.resolved);
  const done = sorted.filter((f) => f.resolved);

  function submit() {
    const t = text.trim();
    if (!t) return;
    addFeedback({ text: t, by: myId ?? undefined });
    setText("");
    toast.success("Feedback abgeschickt");
  }

  return (
    <>
      <PageHeader
        title="Feedback"
        subtitle="Wünsche, Ideen, Bugs — alles willkommen"
      />

      <div className="px-4 pb-24">
        <Card className="p-3 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-lg pl-1 pt-1.5">💭</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              placeholder="Was wünschst du dir? Was nervt? Was fehlt?"
              rows={3}
              className="flex-1 px-1 py-2 text-[14px] border-none outline-none bg-transparent text-stone-900 dark:text-stone-50 resize-none leading-snug"
            />
          </div>
          <div className="flex items-center justify-between mt-1 pl-7">
            <span className="text-[11px] text-stone-400">
              {myId
                ? "Wird dir zugeordnet"
                : "Anonym — wähle in Settings deine Identität, falls du genannt werden willst"}
            </span>
            <Button size="sm" onClick={submit} disabled={!text.trim()}>
              <Icon.plus size={14} /> Senden
            </Button>
          </div>
        </Card>

        {open.length === 0 && done.length === 0 && (
          <EmptyState
            emoji="💌"
            title="Noch nichts hier"
            subtitle="Schreib oben was dir auf der Seele liegt."
          />
        )}

        {open.length > 0 && (
          <Section title="Offen" count={open.length}>
            {open.map((f) => (
              <FeedbackCard
                key={f.id}
                fb={f}
                author={persons.find((p) => p.id === f.by)}
                canEdit={!myId || f.by === myId || !f.by}
              />
            ))}
          </Section>
        )}

        {done.length > 0 && (
          <Section title="Erledigt" count={done.length}>
            {done.map((f) => (
              <FeedbackCard
                key={f.id}
                fb={f}
                author={persons.find((p) => p.id === f.by)}
                canEdit={!myId || f.by === myId || !f.by}
              />
            ))}
          </Section>
        )}
      </div>
    </>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2 pl-1">
        <h3 className="text-[11px] font-bold tracking-[0.05em] uppercase text-stone-400">{title}</h3>
        <Chip variant="neutral">{count}</Chip>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FeedbackCard({ fb, author, canEdit }: { fb: FB; author?: Person; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fb.text);

  function save() {
    const t = draft.trim();
    if (!t || t === fb.text) {
      setEditing(false);
      return;
    }
    updateFeedback(fb.id, { text: t });
    setEditing(false);
    toast.success("Aktualisiert");
  }

  function remove() {
    if (!confirm("Feedback löschen?")) return;
    deleteFeedback(fb.id);
    toast.success("Gelöscht");
  }

  return (
    <div
      className="px-3.5 py-3 rounded-2xl border bg-white dark:bg-stone-800 border-[#F0EBE6] dark:border-[#3A3633]"
      style={fb.resolved ? { opacity: 0.7 } : undefined}
    >
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-[14px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-50 resize-none leading-snug outline-none focus:border-violet-600"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="text-xs font-semibold text-stone-500 px-2 py-1.5">
              Abbrechen
            </button>
            <button
              onClick={save}
              disabled={!draft.trim()}
              className="text-xs font-semibold text-violet-700 dark:text-violet-300 px-2 py-1.5 disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="text-[14px] leading-[1.5] whitespace-pre-wrap text-stone-900 dark:text-stone-50"
            style={fb.resolved ? { textDecoration: "line-through", textDecorationColor: "#A8A29E" } : undefined}
          >
            {fb.text}
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              {author ? (
                <>
                  <Avatar person={author} size={16} />
                  <span>{author.name}</span>
                  <span>·</span>
                </>
              ) : (
                <span>anonym ·</span>
              )}
              <span>{formatRelative(fb.createdAt)}</span>
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <button
                  onClick={() => updateFeedback(fb.id, { resolved: !fb.resolved })}
                  className="text-[11px] font-semibold text-stone-500 hover:text-emerald-600 px-1.5 py-0.5"
                  title={fb.resolved ? "Wieder öffnen" : "Als erledigt markieren"}
                >
                  {fb.resolved ? "↩ öffnen" : "✓ erledigt"}
                </button>
                <button
                  onClick={() => {
                    setDraft(fb.text);
                    setEditing(true);
                  }}
                  className="text-stone-400 hover:text-violet-600 px-1.5 py-0.5"
                  title="Bearbeiten"
                >
                  <Icon.pencil />
                </button>
                <button onClick={remove} className="text-stone-400 hover:text-red-500 px-1.5 py-0.5" title="Löschen">
                  <Icon.trash size={14} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

void Input;

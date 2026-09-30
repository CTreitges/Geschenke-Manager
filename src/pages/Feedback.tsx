import { useState } from "react";
import { Avatar, Button, Card, Chip, EmptyState, Icon, Input, PageHeader, useConfirm } from "@/components/ui";
import { useStore } from "@/lib/hooks";
import { addFeedback, deleteFeedback, updateFeedback } from "@/lib/storage";
import { useIdentity } from "@/lib/auth";
import { useFirebaseUser } from "@/lib/firebase";
import { isFeedbackOwner } from "@/lib/feedback-owner";
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
  const fbUser = useFirebaseUser();
  const myUid = fbUser?.uid ?? null;
  const isOwner = isFeedbackOwner(fbUser);
  const [text, setText] = useState("");

  const sorted = [...feedback].sort((a, b) => {
    if ((a.resolved ? 1 : 0) !== (b.resolved ? 1 : 0)) return (a.resolved ? 1 : 0) - (b.resolved ? 1 : 0);
    return b.createdAt - a.createdAt;
  });

  const open = sorted.filter((f) => !f.resolved);
  const done = sorted.filter((f) => f.resolved);

  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    const t = text.trim();
    if (!t) return;
    setSubmitting(true);
    try {
      await addFeedback({ text: t, by: myId ?? undefined });
      setText("");
      toast.success("Feedback abgeschickt");
    } catch (err) {
      console.error("addFeedback failed:", err);
      const msg = (err as { message?: string })?.message ?? "Unbekannter Fehler";
      toast.error(`Konnte nicht senden: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }
  const [doneOpen, setDoneOpen] = useState(false);

  function canEdit(f: FB): boolean {
    if (isOwner) return true;
    if (!myUid) return false;
    return f.byUid === myUid;
  }

  return (
    <>
      <PageHeader
        title="Feedback"
        subtitle={
          isOwner
            ? "Owner-Sicht: alle Feedbacks aus allen Gruppen"
            : "Wünsche, Ideen, Bugs — alles willkommen"
        }
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
                ? "Wird dir zugeordnet · nur du & der Owner sehen es"
                : "Nur du & der Owner sehen dein Feedback"}
            </span>
            <Button
              size="sm"
              onClick={submit}
              disabled={!text.trim() || submitting}
            >
              <Icon.plus size={14} /> {submitting ? "…" : "Senden"}
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
                canEdit={canEdit(f)}
                showEmail={isOwner}
              />
            ))}
          </Section>
        )}

        {done.length > 0 && (
          <CollapsibleSection
            title="Erledigt"
            count={done.length}
            open={doneOpen}
            onToggle={() => setDoneOpen((v) => !v)}
          >
            {done.map((f) => (
              <FeedbackCard
                key={f.id}
                fb={f}
                author={persons.find((p) => p.id === f.by)}
                canEdit={canEdit(f)}
                showEmail={isOwner}
              />
            ))}
          </CollapsibleSection>
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

function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 mb-2 pl-1 text-left"
      >
        <Icon.chev
          size={12}
          className={`text-stone-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <h3 className="text-[11px] font-bold tracking-[0.05em] uppercase text-stone-400">
          {title}
        </h3>
        <Chip variant="neutral">{count}</Chip>
      </button>
      {open && <div className="flex flex-col gap-2">{children}</div>}
    </div>
  );
}

function FeedbackCard({
  fb,
  author,
  canEdit,
  showEmail,
}: {
  fb: FB;
  author?: Person;
  canEdit: boolean;
  showEmail?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fb.text);
  const confirm = useConfirm();

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

  async function remove() {
    const ok = await confirm({ title: "Feedback löschen?", confirmLabel: "Löschen", tone: "danger" });
    if (!ok) return;
    deleteFeedback(fb.id)
      .then(() => toast.success("Gelöscht"))
      .catch(() => toast.error("Löschen hat nicht geklappt – bitte nochmal"));
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
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400 min-w-0">
              {author ? (
                <>
                  <Avatar person={author} size={16} />
                  <span>{author.name}</span>
                  <span>·</span>
                </>
              ) : showEmail && fb.byEmail ? (
                <span className="truncate">{fb.byEmail} ·</span>
              ) : (
                <span>anonym ·</span>
              )}
              <span className="shrink-0">{formatRelative(fb.createdAt)}</span>
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
                <button onClick={() => void remove()} className="text-stone-400 hover:text-red-500 px-1.5 py-0.5" title="Löschen">
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

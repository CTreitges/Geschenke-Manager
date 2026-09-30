import { useState } from "react";
import { Avatar, Button, Card, Chip, EmptyState, Icon, IconButton, PageHeader, useConfirm } from "@/components/ui";
import { useMyId, useStore } from "@/lib/hooks";
import { addFeedback, deleteFeedback, updateFeedback } from "@/lib/storage";
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
  const myId = useMyId();
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
            ? "App-Betreiber-Sicht: alle Feedbacks aus allen Gruppen"
            : "Wünsche, Ideen, Bugs — alles willkommen"
        }
      />

      <div className="px-4 pb-24">
        <Card className="mb-4 p-3 focus-within:ring-2 focus-within:ring-accent/30">
          <div className="flex items-start gap-2">
            <span aria-hidden className="pl-1 pt-1.5 text-lg">
              💭
            </span>
            <textarea
              aria-label="Dein Feedback"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              placeholder="Was wünschst du dir? Was nervt? Was fehlt?"
              rows={3}
              className="flex-1 resize-none border-none bg-transparent px-1 py-2 text-sm leading-snug text-fg outline-none placeholder:text-fg-muted"
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 pl-7">
            <span className="text-2xs text-fg-muted">
              {myId
                ? "Wird dir zugeordnet · nur du & der App-Betreiber sehen es"
                : "Nur du & der App-Betreiber sehen dein Feedback"}
            </span>
            <Button size="sm" onClick={submit} loading={submitting} disabled={!text.trim()}>
              <Icon.plus size={14} /> Senden
            </Button>
          </div>
        </Card>

        {open.length === 0 && done.length === 0 && (
          <EmptyState
            emoji="💌"
            title="Noch nichts hier"
            subtitle="Schreib oben, was dir auf der Seele liegt."
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
      <div className="mb-2 flex items-center gap-2 pl-1">
        <h2 className="m-0 text-2xs font-bold uppercase tracking-[.05em] text-fg-muted">{title}</h2>
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
      <h2 className="m-0 mb-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-10 w-full items-center gap-2 pl-1 text-left"
        >
          <Icon.chev size={12} className={`text-fg-muted transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="text-2xs font-bold uppercase tracking-[.05em] text-fg-muted">{title}</span>
          <Chip variant="neutral">{count}</Chip>
        </button>
      </h2>
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
    <div className={`rounded-card border border-line-subtle bg-surface px-3.5 py-3 ${fb.resolved ? "opacity-70" : ""}`}>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            aria-label="Feedback bearbeiten"
            className="w-full resize-none rounded-xl border border-line-control bg-surface px-3 py-2 text-sm leading-snug text-fg outline-none focus:border-accent"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={save} disabled={!draft.trim()}>
              Speichern
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className={`whitespace-pre-wrap text-sm leading-normal text-fg ${fb.resolved ? "line-through decoration-fg-muted" : ""}`}>
            {fb.text}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-2xs text-fg-muted">
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
              <div className="-my-1.5 -mr-2 flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => updateFeedback(fb.id, { resolved: !fb.resolved })}
                  className="min-h-tap px-2 text-xs font-semibold text-fg-soft hover:text-status-received"
                  title={fb.resolved ? "Wieder öffnen" : "Als erledigt markieren"}
                >
                  {fb.resolved ? "↩ öffnen" : "✓ erledigt"}
                </button>
                <IconButton
                  label="Bearbeiten"
                  size="sm"
                  onClick={() => {
                    setDraft(fb.text);
                    setEditing(true);
                  }}
                >
                  <Icon.pencil />
                </IconButton>
                <IconButton label="Löschen" size="sm" onClick={() => void remove()}>
                  <Icon.trash size={14} />
                </IconButton>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


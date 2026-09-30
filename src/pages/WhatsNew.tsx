import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Icon, PageHeader } from "@/components/ui";
import { useBack } from "@/lib/nav";
import { hasUnseenVersion, markWhatsNewSeen } from "@/lib/onboarding";
import { CURRENT_VERSION, PATCH_NOTES, formatPatchDate, type PatchNote } from "@/lib/patchnotes";

const OLDER_PAGE = 5;

function Highlights({ items }: { items: string[] }) {
  return (
    <ul className="m-0 list-none space-y-1.5 p-0">
      {items.map((h, i) => (
        <li key={i} className="flex gap-2.5 text-body text-fg-soft">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-grad-primary" />
          <span>{h}</span>
        </li>
      ))}
    </ul>
  );
}

function VersionChip({ version }: { version: string }) {
  return (
    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-meta font-bold tabular-nums text-accent-text">{version}</span>
  );
}

/** „Was ist neu“: aktuelle Version aufgeklappt, ältere zum Aufklappen. */
export default function WhatsNew() {
  const back = useBack("/");
  // Vor dem Markieren merken, ob die Version neu war (für den Chip).
  const [wasUnseen] = useState(() => hasUnseenVersion(CURRENT_VERSION));
  const [visibleOlder, setVisibleOlder] = useState(OLDER_PAGE);

  useEffect(() => {
    markWhatsNewSeen(CURRENT_VERSION);
  }, []);

  const [current, ...older] = PATCH_NOTES;
  const shownOlder = older.slice(0, visibleOlder);
  const remaining = older.length - shownOlder.length;
  const nextChunk = Math.min(OLDER_PAGE, remaining);

  return (
    <div>
      <PageHeader onBack={back} title="Was ist neu" />
      <div className="space-y-6 px-4 pb-6">
        {current && <CurrentNote note={current} isNew={wasUnseen} />}

        {older.length > 0 && (
          <section aria-labelledby="whats-new-older">
            <h2 id="whats-new-older" className="m-0 mb-2.5 pl-0.5 text-body font-bold text-fg">
              Frühere Versionen
            </h2>
            <div className="overflow-hidden rounded-card border border-line-subtle bg-surface shadow-card">
              {shownOlder.map((note) => (
                <details key={note.version} className="group border-t border-line-subtle first:border-t-0">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                    <Icon.chev size={14} className="shrink-0 text-fg-muted transition-transform group-open:rotate-90" />
                    <span className="text-body font-semibold tabular-nums text-fg">{note.version}</span>
                    <span className="text-meta text-fg-muted">· {formatPatchDate(note.date)}</span>
                    <span className="ml-auto text-xs text-fg-muted">
                      {note.highlights.length} {note.highlights.length === 1 ? "Punkt" : "Punkte"}
                    </span>
                  </summary>
                  <div className="px-4 pb-4 pt-1">
                    {note.title && <p className="m-0 mb-2 text-body font-bold text-fg">{note.title}</p>}
                    <Highlights items={note.highlights} />
                  </div>
                </details>
              ))}
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setVisibleOlder((v) => v + OLDER_PAGE)}
                  className="flex min-h-12 w-full items-center justify-center gap-1.5 border-t border-line-subtle px-4 text-meta font-semibold text-accent-text hover:bg-surface-2"
                >
                  {nextChunk} {nextChunk === 1 ? "ältere Version" : "ältere Versionen"} laden
                  <Icon.chev size={12} className="rotate-90" />
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CurrentNote({ note, isNew }: { note: PatchNote; isNew: boolean }) {
  const nav = useNavigate();
  return (
    <article className="relative overflow-hidden rounded-card border border-line-subtle bg-surface px-4 pb-4 pt-5 shadow-card">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-grad-primary" />
      <div className="flex flex-wrap items-center gap-2">
        <VersionChip version={note.version} />
        <span className="text-meta text-fg-muted">{formatPatchDate(note.date)}</span>
        {isNew && (
          <span className="ml-auto rounded-full bg-grad-primary px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-white">
            neu
          </span>
        )}
      </div>
      {note.title && <h2 className="m-0 mt-3 text-lg font-extrabold tracking-tight text-fg">{note.title}</h2>}
      <div className="mt-3">
        <Highlights items={note.highlights} />
      </div>
      {note.action && (
        <Button variant="secondary" className="mt-4 w-full" onClick={() => nav(note.action!.to)}>
          {note.action.label}
        </Button>
      )}
    </article>
  );
}

import { useNavigate } from "react-router-dom";
import { Button, Icon, PageHeader } from "@/components/ui";
import { FAQ } from "@/lib/faq";
import { useBack } from "@/lib/nav";

/** Häufige Fragen: native <details>, je eine kurze Antwort. */
export default function Help() {
  const nav = useNavigate();
  const back = useBack("/");
  return (
    <div>
      <PageHeader onBack={back} title="Häufige Fragen" />
      <div className="px-4 pb-6">
        <div className="overflow-hidden rounded-card border border-line-subtle bg-surface shadow-card">
          {FAQ.map((f) => (
            <details key={f.id} id={f.id} className="group border-t border-line-subtle first:border-t-0">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-body font-semibold text-fg [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{f.question}</span>
                <Icon.chev size={14} className="shrink-0 text-fg-muted transition-transform rotate-90 group-open:-rotate-90" />
              </summary>
              <p className="m-0 px-4 pb-4 text-body text-fg-soft">{f.answer}</p>
            </details>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <Button variant="secondary" onClick={() => nav("/tutorial")}>
            Tutorial nochmal ansehen
          </Button>
          <Button variant="ghost" className="text-accent-text" onClick={() => nav("/feedback")}>
            Frage offen? Feedback geben
          </Button>
        </div>
      </div>
    </div>
  );
}

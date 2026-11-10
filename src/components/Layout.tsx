import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Gift } from "lucide-react";
import { IdentityChip } from "./IdentityChip";
import { GroupSwitcher } from "./GroupSwitcher";
import { HelpMenu } from "./HelpMenu";
import { Icon } from "./ui";
import { cn } from "@/lib/cn";
import { useMyId, useStore } from "@/lib/hooks";
import { activeTab, type TabKey } from "@/lib/nav";

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const current = activeTab(loc.pathname);
  // Ohne Identität ist der Chip („Wer bist du?“) breit – dann zeigt das Logo
  // erst ab 400 px den Schriftzug, damit der Header bei 360/390 px nicht umbricht.
  const myId = useMyId();
  const hasMe = useStore().persons.some((p) => p.id === myId);
  const tabs: { key: TabKey; to: string; label: string; Icon: (typeof Icon)["home"] }[] = [
    { key: "home", to: "/", label: "Übersicht", Icon: Icon.home },
    { key: "people", to: "/people", label: "Personen", Icon: Icon.users },
    { key: "wishlist", to: "/wishlist", label: "Wunschliste", Icon: Icon.gift },
    { key: "settings", to: "/settings", label: "Einstellungen", Icon: Icon.cog },
    { key: "feedback", to: "/feedback", label: "Feedback", Icon: Icon.mail },
  ];
  return (
    <div className="min-h-screen bg-canvas pb-[calc(7rem+env(safe-area-inset-bottom))] text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-4">
          <Link
            to="/"
            aria-label="Geschenke – Startseite"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-base font-semibold tracking-tight text-fg"
          >
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-tile bg-grad-primary text-white shadow-primary">
              <Gift size={16} strokeWidth={2.2} />
            </span>
            <span aria-hidden className={cn("hidden", hasMe ? "min-[340px]:inline" : "min-[400px]:inline")}>
              Geschenke
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-1">
            <GroupSwitcher />
            <HelpMenu />
            <IdentityChip />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl pb-8">{children}</main>
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-16 max-w-2xl px-2">
          {tabs.map((t) => {
            const active = t.key === current;
            const I = t.Icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-2xs font-semibold",
                  active ? "text-accent-text" : "text-fg-muted",
                )}
              >
                <I size={20} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

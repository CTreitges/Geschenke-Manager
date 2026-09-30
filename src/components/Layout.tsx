import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { IdentityChip } from "./IdentityChip";
import { GroupSwitcher } from "./GroupSwitcher";
import { HelpMenu } from "./HelpMenu";
import { Icon } from "./ui";
import { cn } from "@/lib/cn";
import { activeTab, type TabKey } from "@/lib/nav";

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const current = activeTab(loc.pathname);
  const tabs: { key: TabKey; to: string; label: string; Icon: (typeof Icon)["home"] }[] = [
    { key: "home", to: "/", label: "Übersicht", Icon: Icon.home },
    { key: "people", to: "/people", label: "Personen", Icon: Icon.users },
    { key: "wishlist", to: "/wishlist", label: "Wunschliste", Icon: Icon.gift },
    { key: "settings", to: "/settings", label: "Einstellungen", Icon: Icon.cog },
    { key: "feedback", to: "/feedback", label: "Feedback", Icon: Icon.mail },
  ];
  return (
    <div
      className="min-h-screen text-stone-900 dark:text-stone-50 pb-[calc(7rem+env(safe-area-inset-bottom))]"
      style={{ background: "var(--gm-bg)" }}
    >
      <header className="sticky top-0 z-30 backdrop-blur border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/80">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="shrink-0 whitespace-nowrap text-base font-semibold tracking-tight">
            🎁 Geschenke
          </Link>
          <div className="flex items-center gap-1.5">
            <GroupSwitcher />
            <HelpMenu />
            <IdentityChip />
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto pb-8">{children}</main>
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur border-t border-stone-200 dark:border-stone-800"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="max-w-2xl mx-auto px-2 h-16 flex">
          {tabs.map((t) => {
            const active = t.key === current;
            const I = t.Icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                  active ? "text-indigo-600 dark:text-indigo-400" : "text-stone-500",
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

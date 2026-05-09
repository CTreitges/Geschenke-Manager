import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { IdentityChip } from "./IdentityChip";
import { Icon } from "./ui";
import { cn } from "@/lib/cn";

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const tabs = [
    { to: "/", label: "Übersicht", Icon: Icon.home },
    { to: "/people", label: "Personen", Icon: Icon.users },
    { to: "/wishlist", label: "Wunschliste", Icon: Icon.gift },
    { to: "/settings", label: "Einstellungen", Icon: Icon.cog },
    { to: "/feedback", label: "Feedback", Icon: Icon.mail },
  ];
  return (
    <div
      className="min-h-screen text-stone-900 dark:text-stone-50 pb-24"
      style={{ background: "var(--gm-bg)" }}
    >
      <header className="sticky top-0 z-30 backdrop-blur border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/80">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-base font-semibold tracking-tight">
            🎁 Geschenke
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/tutorial"
              aria-label="Tutorial"
              title="So funktioniert's"
              className="w-8 h-8 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center justify-center text-sm font-bold"
            >
              ?
            </Link>
            <IdentityChip />
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto pb-8">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur border-t border-stone-200 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-2 h-16 flex">
          {tabs.map((t) => {
            const active = t.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(t.to);
            const I = t.Icon;
            return (
              <Link
                key={t.to}
                to={t.to}
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

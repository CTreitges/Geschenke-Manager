import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { IdentityChip } from "./IdentityChip";
import { cn } from "@/lib/cn";

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const tabs = [
    { to: "/", label: "Stack", icon: "🏠" },
    { to: "/people", label: "Personen", icon: "👥" },
    { to: "/settings", label: "Einstellungen", icon: "⚙️" },
  ];
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 pb-24">
      <header className="sticky top-0 z-30 bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-base font-semibold">
            🎁 Geschenke
          </Link>
          <IdentityChip />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur border-t border-stone-200 dark:border-stone-800">
        <div className="max-w-2xl mx-auto px-2 h-16 flex">
          {tabs.map((t) => {
            const active = t.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-primary-600" : "text-stone-500",
                )}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Vollbild-Seiten außerhalb des Layouts (Login, Neue Gruppe, Geschenk- und
// Mail-Link, Boot): violetter Schein oben über Tokens – im Dark Mode gedämpft
// statt des früheren hellen #EDE9FE-Lichtlecks (B36).

export function GlowScreen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-screen bg-glow-top px-6 text-fg", className)}>{children}</div>;
}

/** Logo-Kachel über dem Titel (Emoji als Illustration). */
export function LogoTile({ emoji }: { emoji: string }) {
  return (
    <div
      aria-hidden
      className="mx-auto mb-4 flex h-[78px] w-[78px] items-center justify-center rounded-sheet bg-grad-primary text-4xl shadow-primary"
    >
      {emoji}
    </div>
  );
}

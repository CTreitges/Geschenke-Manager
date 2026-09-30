import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn mit Design-Tokens", () => {
  it("hält Schriftgröße und Textfarbe auseinander", () => {
    expect(cn("text-meta", "text-fg-muted")).toBe("text-meta text-fg-muted");
    expect(cn("text-2xs text-accent-text")).toBe("text-2xs text-accent-text");
  });

  it("löst Konflikte innerhalb derselben Gruppe auf (spätere Klasse gewinnt)", () => {
    expect(cn("text-body", "text-sm")).toBe("text-sm");
    expect(cn("text-fg", "text-fg-muted")).toBe("text-fg-muted");
    expect(cn("rounded-btn", "rounded-full")).toBe("rounded-full");
    expect(cn("shadow-primary", "shadow-none")).toBe("shadow-none");
    expect(cn("min-h-tap", "min-h-0")).toBe("min-h-0");
  });

  it("behandelt Verlauf und Hintergrundfarbe als verschiedene Gruppen", () => {
    expect(cn("bg-grad-primary", "bg-surface")).toBe("bg-grad-primary bg-surface");
    expect(cn("bg-surface", "bg-surface-2")).toBe("bg-surface-2");
  });
});

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Person } from "@/lib/types";
import {
  ActionMenu,
  Avatar,
  Button,
  Dialog,
  IconButton,
  Overline,
  PhaseStepper,
  QuickAdd,
  Section,
  Segmented,
  Sheet,
  Skeleton,
  StatusBadge,
  Switch,
  Toggle,
  useConfirm,
} from ".";
import { nextSegmentIndex } from "./Switch";

// Statisches Rendern ohne DOM (Vitest läuft in "node"): prüft Markup und ARIA.
const html = (el: ReactElement) => renderToStaticMarkup(el);

describe("Button", () => {
  it("nutzt Klassen statt Inline-Styles, Größen 40/44/52", () => {
    expect(html(<Button>OK</Button>)).not.toContain("style=");
    expect(html(<Button size="sm">A</Button>)).toContain("min-h-10");
    expect(html(<Button>A</Button>)).toContain("min-h-11");
    expect(html(<Button size="lg">A</Button>)).toContain("min-h-[52px]");
    expect(html(<Button>A</Button>)).toContain("bg-grad-primary");
    expect(html(<Button variant="danger">A</Button>)).toContain("text-danger");
  });

  it("reicht style und className weiter (bestehende Overrides)", () => {
    const out = html(
      <Button className="w-full" style={{ minHeight: 32 }}>
        A
      </Button>,
    );
    expect(out).toContain("w-full");
    expect(out).toContain("min-height:32px");
  });

  it("loading sperrt den Button und setzt aria-busy", () => {
    const out = html(<Button loading>Speichern</Button>);
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('disabled=""');
    expect(out).toContain("animate-spin");
    expect(html(<Button>Speichern</Button>)).not.toContain("aria-busy");
  });
});

describe("IconButton", () => {
  it("hat das Pflicht-Label als aria-label und 44×44-Trefferfläche", () => {
    const out = html(<IconButton label="Schließen">x</IconButton>);
    expect(out).toContain('aria-label="Schließen"');
    expect(out).toContain("min-w-tap");
    expect(out).toContain("min-h-tap");
    expect(out).toContain('type="button"');
  });

  it("setzt aria-pressed nur für Umschalt-Knöpfe", () => {
    expect(html(<IconButton label="A">x</IconButton>)).not.toContain("aria-pressed");
    expect(
      html(
        <IconButton label="A" pressed>
          x
        </IconButton>,
      ),
    ).toContain('aria-pressed="true"');
  });
});

describe("Switch / Toggle", () => {
  it("ist ein role=switch mit aria-checked", () => {
    const on = html(<Switch checked onChange={() => {}} label="Push" />);
    expect(on).toContain('role="switch"');
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('aria-label="Push"');
    expect(html(<Switch checked={false} onChange={() => {}} />)).toContain('aria-checked="false"');
  });

  it("Toggle bleibt kompatibel (on/onChange/disabled)", () => {
    const out = html(<Toggle on={false} onChange={() => {}} disabled />);
    expect(out).toContain('role="switch"');
    expect(out).toContain('aria-checked="false"');
    expect(out).toContain('disabled=""');
  });
});

describe("Segmented", () => {
  it("rendert eine tablist mit genau einem ausgewählten, fokussierbaren Tab", () => {
    const out = html(
      <Segmented
        label="Ansicht"
        value="b"
        onChange={() => {}}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    expect(out).toContain('role="tablist"');
    expect(out).toContain('aria-label="Ansicht"');
    expect(out.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-selected="true" tabindex="0"/);
  });

  it("nextSegmentIndex läuft mit Pfeiltasten um und ignoriert andere Tasten", () => {
    expect(nextSegmentIndex(0, "ArrowRight", 3)).toBe(1);
    expect(nextSegmentIndex(2, "ArrowRight", 3)).toBe(0);
    expect(nextSegmentIndex(0, "ArrowLeft", 3)).toBe(2);
    expect(nextSegmentIndex(1, "Home", 3)).toBe(0);
    expect(nextSegmentIndex(0, "End", 3)).toBe(2);
    expect(nextSegmentIndex(0, "Enter", 3)).toBeNull();
    expect(nextSegmentIndex(0, "ArrowRight", 0)).toBeNull();
  });
});

describe("StatusBadge / PhaseStepper", () => {
  it("zeigt Icon, Text und Meta; nur die Abstimmung pulsiert", () => {
    const voting = html(<StatusBadge status="voting" meta="3/5 · noch 2 T." />);
    expect(voting).toContain("Abstimmung · 3/5 · noch 2 T.");
    expect(voting).toContain("animate-ping");
    expect(voting).toContain("text-status-vote");
    expect(voting).toContain("<svg");
    const ideas = html(<StatusBadge status="ideas" />);
    expect(ideas).toContain("Ideen");
    expect(ideas).not.toContain("animate-ping");
    expect(html(<StatusBadge status="decided" />)).toContain("Entschieden");
    expect(html(<StatusBadge status="received" />)).toContain("text-status-received");
  });

  it("markiert genau die aktuelle Phase mit aria-current=step", () => {
    const out = html(<PhaseStepper current="decided" />);
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-current="step".*?Entschieden/);
    expect(out.match(/\(erledigt\)/g)).toHaveLength(2); // Ideen, Abstimmung
    for (const label of ["Ideen", "Abstimmung", "Entschieden", "Erhalten"]) expect(out).toContain(label);
  });

  it("erste Phase: nichts erledigt", () => {
    expect(html(<PhaseStepper current="ideas" />)).not.toContain("(erledigt)");
  });
});

describe("QuickAdd", () => {
  it("hat ein verknüpftes (sr-only) Label und einen benannten Plus-Knopf", () => {
    const out = html(<QuickAdd label="Neue Idee" placeholder="Idee…" onAdd={() => {}} />);
    const id = /<label for="([^"]+)"/.exec(out)?.[1];
    expect(id).toBeTruthy();
    expect(out).toContain(`id="${id}"`);
    expect(out).toContain('aria-label="Hinzufügen"');
    expect(out).not.toContain("aria-describedby");
  });

  it("disabledReason sperrt Feld und Knopf und zeigt den Grund", () => {
    const reason = "Während der Abstimmung können keine neuen Ideen geteilt werden";
    const out = html(<QuickAdd label="Neue Idee" onAdd={() => {}} disabledReason={reason} />);
    expect(out).toContain(reason);
    expect(out).toMatch(/<input[^>]*disabled=""/);
    expect(out).toMatch(/<button[^>]*disabled=""/);
    const reasonId = /<p id="([^"]+)"/.exec(out)?.[1];
    expect(out).toContain(`aria-describedby="${reasonId}"`);
  });
});

describe("Avatar", () => {
  const person = (color: string): Person => ({ id: "p", name: "Anna Berg", birthday: "01-01", color, createdAt: 0 });

  it("wählt die Textfarbe nach Luminanz", () => {
    expect(html(<Avatar person={person("#F97316")} />)).toContain("color:#1C1917");
    const dark = html(<Avatar person={person("#4F46E5")} />);
    expect(dark).toContain("color:#FFFFFF");
    expect(dark).toContain("AB");
  });
});

describe("Sheet / Dialog / weitere", () => {
  it("Dialog ist ein Alias auf Sheet und rendert geschlossen nichts", () => {
    expect(Dialog).toBe(Sheet);
    expect(
      html(
        <Dialog open={false} onClose={() => {}} title="X">
          Inhalt
        </Dialog>,
      ),
    ).toBe("");
  });

  it("ActionMenu-Knopf ist benannt und meldet sein Popup", () => {
    const out = html(<ActionMenu items={[{ label: "Löschen", tone: "danger", onSelect: () => {} }]} />);
    expect(out).toContain('aria-label="Weitere Aktionen"');
    expect(out).toContain('aria-haspopup="dialog"');
    expect(out).toContain('aria-expanded="false"');
  });

  it("Section rendert h2 mit Zähler; Overline und Skeleton", () => {
    const out = html(
      <Section title="Vorschläge" count={4}>
        x
      </Section>,
    );
    expect(out).toMatch(/<section aria-labelledby="([^"]+)"[^>]*>.*<h2 id="\1"/);
    expect(out).toContain(">4</span>");
    expect(html(<Overline>Gruppe</Overline>)).toContain("uppercase");
    expect(html(<Skeleton className="h-4" />)).toContain('aria-hidden="true"');
  });

  it("useConfirm ohne Provider meldet einen klaren Fehler", () => {
    function Probe() {
      useConfirm();
      return null;
    }
    expect(() => html(<Probe />)).toThrow(/ConfirmProvider/);
  });
});

// Typen für e2e/check-design.mjs (genutzt vom Vitest-Test src/check-design.test.ts).
export interface DesignHit {
  rule: "hex" | "text-px" | "confirm" | "div-onclick";
  line: number;
  text: string;
  /** Grund aus „design-ok: …“ – dann eine begründete Ausnahme. */
  reason?: string;
}
export const RULES: ReadonlyArray<{ id: DesignHit["rule"]; label: string; re: RegExp }>;
export function scanSource(source: string): DesignHit[];

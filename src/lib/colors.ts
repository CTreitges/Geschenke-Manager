const PALETTE = [
  "#F97316", "#EA580C", "#DC2626", "#E11D48", "#DB2777",
  "#C026D3", "#9333EA", "#7C3AED", "#4F46E5", "#2563EB",
  "#0284C7", "#0891B2", "#0D9488", "#059669", "#16A34A",
  "#65A30D", "#CA8A04", "#D97706",
];

export function pickColor(seed?: string): string {
  if (!seed) return PALETTE[Math.floor(Math.random() * PALETTE.length)];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Kontrast (WCAG 2.x) ─────────────────────────────────────────
export type Rgb = readonly [number, number, number];

/** "#RGB" oder "#RRGGBB" → [r, g, b]; null bei ungültiger Eingabe. */
export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Relative Luminanz nach WCAG 2.x (0 = schwarz, 1 = weiß). */
export function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Kontrastverhältnis zweier Farben (1 … 21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const TEXT_ON_DARK = "#FFFFFF";
export const TEXT_ON_LIGHT = "#1C1917"; // stone-900 = --gm-fg (hell)

/**
 * Lesbare Textfarbe auf einer Hintergrundfarbe: Weiß oder Fast-Schwarz, je
 * nachdem, was mehr Kontrast hat. Ungültige Farben → Weiß (bisheriges Verhalten).
 */
export function readableTextOn(hex: string): string {
  const bg = parseHex(hex);
  if (!bg) return TEXT_ON_DARK;
  const white = contrastRatio(bg, [255, 255, 255]);
  const dark = contrastRatio(bg, parseHex(TEXT_ON_LIGHT)!);
  return white >= dark ? TEXT_ON_DARK : TEXT_ON_LIGHT;
}

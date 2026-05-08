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

import type { ReactNode } from "react";

// Bausteine der Tutorial-Illustrationen (viewBox 320×240, flach, schematisch).
// Farben ausschließlich über die --ill-*-Tokens aus src/index.css; der
// gemeinsame Verlauf `gm-ill-grad` liegt EINMAL im Pager (IllDefs).

export const GRAD = "url(#gm-ill-grad)";
const FADE = "url(#gm-ill-fade)";

/** Feste Demo-Personen (nie echte Namen). Lea = „du“. */
export const P = {
  lea: "var(--ill-p-lea)",
  anna: "var(--ill-p-anna)",
  ben: "var(--ill-p-ben)",
  mia: "var(--ill-p-mia)",
  tom: "var(--ill-p-tom)",
} as const;

/**
 * Gemeinsame Definitionen für alle Illustrationen. Nicht `display:none`,
 * sonst lösen Safari und Firefox `url(#…)` nicht auf.
 */
export function IllDefs() {
  return (
    <svg width="0" height="0" className="absolute h-0 w-0 overflow-hidden" aria-hidden focusable="false">
      <defs>
        <linearGradient id="gm-ill-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--ill-grad-from)" />
          <stop offset="1" stopColor="var(--ill-grad-to)" />
        </linearGradient>
        {/* Luminanz-Maske: Handys laufen unten weich aus statt hart abzubrechen
            (Koordinaten = viewBox 320×240 der jeweiligen Illustration). */}
        <linearGradient id="gm-ill-fade-grad" gradientUnits="userSpaceOnUse" x1="0" y1="214" x2="0" y2="240">
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="gm-ill-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="240">
          <rect width="320" height="240" fill="url(#gm-ill-fade-grad)" />
        </mask>
      </defs>
    </svg>
  );
}

/** Rahmen einer Illustration: 320×240, role="img" mit Beschreibung. */
export function Ill({ alt, children }: { alt: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label={alt} className="block h-full w-full" focusable="false">
      {children}
    </svg>
  );
}

/** Handy-Rahmen; läuft unten weich aus dem Bild (Höhe 260, Maske gm-ill-fade). */
export function Phone({ x, y = 16, w = 136, children }: { x: number; y?: number; w?: number; children?: ReactNode }) {
  return (
    <g mask={FADE}>
      <rect x={x} y={y} width={w} height={260} rx={22} fill="var(--ill-phone)" />
      <rect x={x + 6} y={y + 6} width={w - 12} height={248} rx={16} fill="var(--ill-screen)" />
      <rect x={x + w / 2 - 14} y={y + 11} width={28} height={5} rx={2.5} fill="var(--ill-line)" />
      {children}
    </g>
  );
}

/** Text-Platzhalter. */
export function Bar({ x, y, w, strong = false, fill }: { x: number; y: number; w: number; strong?: boolean; fill?: string }) {
  const h = strong ? 8 : 6;
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill ?? (strong ? "var(--ill-line-strong)" : "var(--ill-line)")} />;
}

/**
 * Avatar: farbiger Kreis mit Initiale (einziger Text in den Bildern).
 * `outline` = Trennring in Hintergrundfarbe für überlappende Avatare
 * (als eigener Kreis, damit die Initiale keinen Strich bekommt).
 */
export function Av({
  x,
  y,
  r,
  c,
  l,
  ring = false,
  outline,
}: {
  x: number;
  y: number;
  r: number;
  c: string;
  l: string;
  ring?: boolean;
  outline?: string;
}) {
  return (
    <g>
      {ring && <circle cx={x} cy={y} r={r + 3.5} fill="none" stroke="var(--ill-accent)" strokeWidth={2} />}
      {outline && <circle cx={x} cy={y} r={r + 2} fill={outline} />}
      <circle cx={x} cy={y} r={r} fill={c} />
      <text
        x={x}
        y={y}
        dy=".35em"
        textAnchor="middle"
        fontSize={r * 0.9}
        fontWeight={700}
        fill="var(--ill-on-accent)"
      >
        {l}
      </text>
    </g>
  );
}

/** Karte mit Rand; `active` = hervorgehoben (Akzent-Rand, zarter Grund). */
export function CardR({
  x,
  y,
  w,
  h,
  active = false,
  rx = 10,
  fill,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  active?: boolean;
  rx?: number;
  fill?: string;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={rx}
      fill={fill ?? (active ? "var(--ill-soft)" : "var(--ill-card)")}
      stroke={active ? "var(--ill-accent)" : "var(--ill-card-line)"}
      strokeWidth={active ? 1.5 : 1}
    />
  );
}

/** Verlaufskreis mit weißem Haken. */
export function Check({ x, y, r = 8 }: { x: number; y: number; r?: number }) {
  const s = r / 8;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={GRAD} />
      <path
        d={`M${x - 3.5 * s} ${y + 0.2 * s}l${2.4 * s} ${2.4 * s} ${4.6 * s} -${4.8 * s}`}
        fill="none"
        stroke="var(--ill-on-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Tipp-Welle: zwei Ringe um einen Punkt. */
export function Ring({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g fill="none" stroke="var(--ill-accent)" strokeWidth={2}>
      <circle cx={x} cy={y} r={r} opacity={0.5} />
      <circle cx={x} cy={y} r={r + 7} opacity={0.22} />
    </g>
  );
}

/** Vier-Zacken-Stern. */
export function Sparkle({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  return (
    <path
      d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`}
      fill={c}
    />
  );
}

/**
 * Kleines Geschenk-Symbol um den Mittelpunkt x/y (ca. 14×15): Deckel mit
 * Schleife, abgesetzter Körper, Band. Die Fuge zwischen Deckel und Körper
 * zeigt den Untergrund – so liest es sich als Geschenk, nicht als Pause-Zeichen.
 */
export function MiniGift({ x, y, s = 1, fill = "var(--ill-on-accent)", band = GRAD }: { x: number; y: number; s?: number; fill?: string; band?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -3.6c-1.2-3.4-5.2-3.6-4.6-1.2.3 1 2.4 1.3 4.6 1.2zm0 0c1.2-3.4 5.2-3.6 4.6-1.2-.3 1-2.4 1.3-4.6 1.2z" fill={fill} />
      <rect x={-7} y={-3.4} width={14} height={4} rx={1.2} fill={fill} />
      <rect x={-6} y={1.6} width={12} height={6.4} rx={1.4} fill={fill} />
      <rect x={-1} y={-3.4} width={2} height={11.4} fill={band} />
    </g>
  );
}

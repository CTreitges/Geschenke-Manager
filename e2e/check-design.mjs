// Design-Check (npm run check:design): meldet Stellen, die am Token-System
// vorbeigehen – harte Hex-Farben (#RRGGBB), arbiträre Schriftgrößen
// (text-[Npx]), native confirm()/alert() und klickbare <div onClick>.
// Geprüft werden src/pages und src/components (ohne Tests). Die Tutorial-
// Illustrationen (src/components/tutorial) sind ausgenommen, ihre Farben
// kommen aus den --ill-*-Tokens in src/index.css.
//
// Begründete Ausnahme: Kommentar „design-ok: <Grund>“ in derselben oder der
// Zeile davor. Sie wird mit Grund gelistet, zählt aber nicht als Fehler.
// Exit-Code 1, sobald es unbegründete Treffer gibt.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIRS = ["src/pages", "src/components"];
const EXCLUDE_DIRS = ["src/components/tutorial"];

export const RULES = [
  { id: "hex", label: "Hex-Farbe (#RRGGBB) statt Token", re: /#[0-9A-Fa-f]{6}\b/g },
  { id: "text-px", label: "arbiträre Schriftgröße text-[Npx]", re: /\btext-\[\d+(?:\.\d+)?px\]/g },
  // Nur das native confirm(„…“) – useConfirm() wird mit einem Objekt aufgerufen.
  { id: "confirm", label: "natives confirm()/alert()", re: /(?<![\w.])(?:window\.)?(?:confirm\(\s*(?![\s{])|alert\()/g },
  { id: "div-onclick", label: "klickbares <div onClick> statt Button", re: /<div\b[^>]*?\sonClick=/g },
];

const toPosix = (p) => p.split(path.sep).join("/");

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = toPosix(path.relative(ROOT, full));
    if (statSync(full).isDirectory()) {
      if (!EXCLUDE_DIRS.includes(rel)) out.push(...listFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Treffer einer Datei: { rule, line, text, reason? } – reason = begründete Ausnahme. */
export function scanSource(source) {
  const lines = source.split(/\r?\n/);
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === "\n") lineStarts.push(i + 1);
  const lineOf = (index) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo; // 0-basiert
  };
  const reasonAt = (i) => {
    for (const l of [lines[i], lines[i - 1]]) {
      const m = l && /design-ok:\s*(.+?)\s*(?:\*\/|\}|$)/.exec(l);
      if (m) return m[1];
    }
    return undefined;
  };
  // Kommentarzeilen (//, /*, *) zählen nicht – dort darf z. B. „window.confirm()“ stehen.
  const isComment = (i) => /^\s*(\/\/|\/\*|\*)/.test(lines[i]);
  const hits = [];
  for (const rule of RULES) {
    for (const m of source.matchAll(rule.re)) {
      const i = lineOf(m.index);
      if (isComment(i)) continue;
      hits.push({ rule: rule.id, line: i + 1, text: lines[i].trim().slice(0, 120), reason: reasonAt(i) });
    }
  }
  return hits.sort((a, b) => a.line - b.line);
}

function main() {
  const files = DIRS.flatMap((d) => listFiles(path.join(ROOT, d)));
  let open = 0;
  let justified = 0;
  for (const file of files) {
    const hits = scanSource(readFileSync(file, "utf8"));
    if (hits.length === 0) continue;
    const rel = toPosix(path.relative(ROOT, file));
    for (const h of hits) {
      const label = RULES.find((r) => r.id === h.rule).label;
      if (h.reason) {
        justified++;
        console.log(`ok    ${rel}:${h.line}  [${h.rule}] ${h.reason}`);
      } else {
        open++;
        console.log(`FEHLT ${rel}:${h.line}  [${h.rule}] ${label}\n        ${h.text}`);
      }
    }
  }
  console.log(`\n[check-design] ${files.length} Dateien · ${open} offene Treffer · ${justified} begründete Ausnahmen`);
  process.exit(open > 0 ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();

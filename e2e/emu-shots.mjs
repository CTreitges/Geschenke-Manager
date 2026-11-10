// Screenshots der App gegen die LOKALEN Firebase-Emulatoren (demo-geschenke).
// Startet selbst nur den Vite-Dev-Server (Mode "emulator"), NICHT die
// Emulatoren — dafür `npm run emu:shots` (firebase emulators:exec) nutzen.
// Die Screens stehen in e2e/emu-scenes.mjs (hell + dunkel, 390×844); danach
// entsteht je Themenblock ein Kontaktbogen `uebersicht-<block>.png`.
// Zielordner: EMU_SHOTS_DIR, sonst e2e/.shots/.

import { spawn } from "node:child_process";
import { mkdirSync, openSync, readFileSync, readSync, closeSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { BLOCKS, THEMES, runScenes } from "./emu-scenes.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = process.env.EMU_SHOTS_DIR ?? path.join(ROOT, "e2e", ".shots");
const PORT = 5174;
const BASE = `http://127.0.0.1:${PORT}`;
const MAX_WIDTH = 1200;
const SHEET = { width: 1600, height: 1000 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Vite-Dev-Server als Kindprozess ──────────────────────
function startVite() {
  const viteBin = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(
    process.execPath,
    // --config explizit: ein veraltetes, gitignoriertes vite.config.js (tsc-Artefakt)
    // hätte sonst Vorrang vor vite.config.ts (dort fehlt z. B. __BUILD_TIME__).
    [viteBin, "--config", "vite.config.ts", "--mode", "emulator", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  child.getLog = () => log;
  return child;
}

async function waitForServer(child, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`Vite beendet (Code ${child.exitCode}):\n${child.getLog()}`);
    try {
      const res = await fetch(`${BASE}/`);
      if (res.ok) return;
    } catch {
      /* noch nicht erreichbar */
    }
    await wait(500);
  }
  throw new Error(`Vite nicht erreichbar nach ${timeoutMs} ms:\n${child.getLog()}`);
}

// ── PNG-Größe aus dem IHDR-Header lesen ─────────────────
function pngSize(file) {
  const fd = openSync(file, "r");
  const buf = Buffer.alloc(24);
  readSync(fd, buf, 0, 24, 0);
  closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ── Screenshot je Snap ───────────────────────────────────
const shots = [];

/**
 * page: ganze Seite – statt `fullPage: true` wird der Viewport auf die volle
 * Dokumenthöhe gezogen, sonst landen fixe Elemente (Tab-Leiste, FAB) mitten
 * im Bild. viewport: nur 390×844 (offene Sheets kleben unten). element: nur
 * dieser Ausschnitt.
 */
async function takeShot({ page, id, title, block, mode, element }) {
  const file = path.join(OUT_DIR, `${id}.png`);
  if (mode === "viewport" && !element) {
    await page.screenshot({ path: file });
  } else {
    // Ganze Seite bzw. Ausschnitt: Viewport auf Dokumenthöhe, damit die fixe
    // Tab-Leiste unten liegt und nichts überdeckt.
    for (let i = 0; i < 3; i++) {
      const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      const cur = page.viewportSize().height;
      if (h <= cur && i > 0) break;
      await page.setViewportSize({ width: 390, height: Math.max(844, h) });
      await wait(300);
    }
    if (element) await element.screenshot({ path: file });
    else await page.screenshot({ path: file });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  const { width } = pngSize(file);
  if (width > MAX_WIDTH) throw new Error(`${file} ist ${width}px breit (> ${MAX_WIDTH})`);
  shots.push({ file, id, title, block, whole: !!element });
  console.log(`[emu-shots] ${id}.png`);
}

// ── Kontaktbogen je Themenblock ─────────────────────────

/** Spalten so wählen, dass die Vorschaubilder möglichst breit werden. */
export function sheetGrid(count, { width, height }, { gap = 8, header = 44, caption = 16, ratio = 390 / 844 } = {}) {
  let best = { cols: 2, cell: 0 };
  // Nur gerade Spaltenzahlen: hell + dunkel stehen dann immer nebeneinander.
  for (let cols = 2; cols <= Math.max(2, count + 1); cols += 2) {
    const rows = Math.ceil(count / cols);
    const byWidth = (width - (cols + 1) * gap) / cols;
    const byHeight = ((height - header - (rows + 1) * gap) / rows - caption) * ratio;
    const cell = Math.floor(Math.min(byWidth, byHeight));
    if (cell > best.cell) best = { cols, cell };
  }
  return best;
}

async function contactSheet(browser, block, items) {
  const { cols, cell } = sheetGrid(items.length, SHEET);
  const imgH = Math.round(cell / (390 / 844));
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const cells = items
    .map((it) => {
      const data = readFileSync(it.file).toString("base64");
      const label = `${it.id.split("-")[0]} · ${it.title} · ${it.id.endsWith("-hell") ? "hell" : "dunkel"}`;
      const cls = it.whole ? ' class="whole"' : "";
      return `<figure><img${cls} src="data:image/png;base64,${data}"><figcaption>${esc(label)}</figcaption></figure>`;
    })
    .join("");
  const html = `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#e7e5e4;font:12px system-ui,sans-serif;color:#1c1917}
    h1{margin:0;height:44px;padding:10px 12px;font-size:18px}
    main{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:8px;padding:0 8px 8px}
    figure{margin:0;width:${cell}px}
    img{display:block;width:${cell}px;height:${imgH}px;object-fit:cover;object-position:top;border-radius:6px;box-shadow:0 1px 3px #0003;background:#fff}
    img.whole{object-fit:contain;background:#d6d3d1}
    figcaption{height:16px;line-height:16px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  </style><h1>${esc(block.title)} — ${new Set(items.map((it) => it.id.split("-")[0])).size} Screens, hell + dunkel</h1><main>${cells}</main>`;
  const page = await browser.newPage({ viewport: SHEET, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  const box = await page.locator("body").boundingBox();
  const file = path.join(OUT_DIR, `uebersicht-${block.key}.png`);
  await page.screenshot({
    path: file,
    clip: { x: 0, y: 0, width: SHEET.width, height: Math.min(SHEET.height, Math.ceil(box?.height ?? SHEET.height)) },
  });
  await page.close();
  const size = pngSize(file);
  console.log(`[emu-shots] uebersicht-${block.key}.png (${size.width}×${size.height}, ${items.length} Bilder)`);
  return file;
}

export async function runShots() {
  mkdirSync(OUT_DIR, { recursive: true });
  const pageErrors = [];
  const sceneErrors = [];
  const onPage = (page, label) => {
    page.on("pageerror", (e) => pageErrors.push(`[${label}] pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") pageErrors.push(`[${label}] console: ${m.text().slice(0, 300)}`);
    });
  };

  const vite = startVite();
  let browser;
  try {
    await waitForServer(vite);
    console.log(`[emu-shots] Vite läuft auf ${BASE}`);
    browser = await chromium.launch();

    // Warm-up: Vite optimiert Dependencies beim ersten Aufruf (ggf. Reload).
    {
      const warm = await browser.newPage();
      await warm.goto(`${BASE}/login`, { timeout: 120_000 });
      await warm.getByPlaceholder("Gruppen-ID").waitFor({ timeout: 90_000 });
      await wait(3000);
      await warm.close();
    }

    for (const theme of THEMES) {
      await runScenes({
        browser,
        baseURL: BASE,
        theme,
        snap: takeShot,
        onPage,
        onError: (err, scene) => {
          sceneErrors.push(`${scene.block}/${theme.suffix}: ${err.message.split("\n")[0]}`);
          console.error(`[emu-shots] Szene ${scene.block} (${theme.suffix}) fehlgeschlagen:`, err.message);
        },
      });
    }

    // Kontaktbögen: je Screen hell neben dunkel.
    for (const block of BLOCKS) {
      const items = shots
        .filter((s) => s.block === block.key)
        .sort((a, b) => {
          const base = (id) => id.replace(/-(hell|dunkel)$/, "");
          return base(a.id).localeCompare(base(b.id)) || (a.id.endsWith("-hell") ? -1 : 1);
        });
      if (items.length) await contactSheet(browser, block, items);
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (vite.exitCode === null) vite.kill();
  }

  if (pageErrors.length) {
    console.warn(`[emu-shots] ${pageErrors.length} Browser-Fehlermeldungen:`);
    for (const e of [...new Set(pageErrors)].slice(0, 30)) console.warn("  " + e);
  }
  console.log(`[emu-shots] ${shots.length} Screenshots in ${OUT_DIR}`);
  if (sceneErrors.length) throw new Error(`${sceneErrors.length} Szenen fehlgeschlagen:\n  ${sceneErrors.join("\n  ")}`);
  return shots;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runShots()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[emu-shots] Fehler:", e);
      process.exit(1);
    });
}

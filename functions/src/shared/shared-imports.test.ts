import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// functions/src/shared wird auch vom Frontend (Alias "@shared") gebündelt —
// dort darf nichts aus dem Admin-/Functions-SDK landen.
const dir = fileURLToPath(new URL(".", import.meta.url));
const sources = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

describe("functions/src/shared", () => {
  it("enthält mindestens ein Modul", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)("%s importiert weder firebase-admin noch firebase-functions", (file) => {
    const code = readFileSync(join(dir, file), "utf8");
    expect(code).not.toMatch(/(from\s+|require\(\s*|import\(\s*)["']firebase-(admin|functions)/);
  });
});

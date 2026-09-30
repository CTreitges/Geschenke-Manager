import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Getrennt von vite.config.ts, damit das PWA-Plugin in Tests nicht mitläuft.
// Aliase müssen zu vite.config.ts und tsconfig.json passen.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@shared": path.resolve(root, "functions/src/shared"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

import { defineConfig } from "vitest/config";

// .mts, weil functions ein CommonJS-Paket ist (kein "type": "module").
// Tests liegen neben dem Code unter src/, werden per tsconfig "exclude"
// aber nicht nach lib/ gebaut (also nicht mit deployed).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

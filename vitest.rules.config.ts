import { defineConfig } from "vitest/config";

// Firestore-Rules-Tests (`npm run test:rules`), laufen nur innerhalb von
// `firebase emulators:exec` gegen den lokalen Firestore-Emulator.
export default defineConfig({
  test: {
    environment: "node",
    include: ["e2e/rules/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});

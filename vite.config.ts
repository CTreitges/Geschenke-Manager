import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon-180x180.png",
      ],
      manifest: {
        id: "/",
        name: "Geschenke-Manager",
        short_name: "Geschenke",
        description:
          "Geschenkideen, Wunschlisten und Geburtstage gemeinsam in Gruppen verwalten.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        lang: "de",
        background_color: "#673EB7",
        theme_color: "#F59E0B",
        categories: ["lifestyle", "productivity", "social"],
        icons: [
          {
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff,woff2}"],
        // Den FCM-Worker NICHT in den Workbox-Precache mitnehmen — er hat
        // einen eigenen Lebenszyklus an /firebase-cloud-messaging-push-scope.
        globIgnores: ["**/firebase-messaging-sw.js"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".gstatic.com") &&
              url.pathname.includes("/firebasejs/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "firebase-sdk",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

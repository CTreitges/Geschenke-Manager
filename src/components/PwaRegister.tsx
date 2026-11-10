import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Registriert den Service Worker (vite.config.ts: injectRegister false →
 * sonst registriert ihn niemand). Im Modus registerType "autoUpdate" lädt
 * vite-plugin-pwa neue Versionen selbst; ein „Neue Version“-Hinweis wäre
 * toter Code, weil onNeedRefresh dort nie aufgerufen wird (B42).
 */
export function PwaRegister() {
  useRegisterSW({
    onRegisterError(err) {
      console.warn("[pwa] sw registration failed", err);
    },
  });
  return null;
}

/* eslint-disable no-undef */
// Push-Worker für Web-Push über FCM. Läuft an Scope
// /firebase-cloud-messaging-push-scope parallel zum Workbox-SW (Scope /).
// Der Scope darf sich nicht ändern: an dieser Registrierung hängt die
// Push-Subscription und damit jeder bereits gespeicherte FCM-Token.
//
// Bewusst OHNE Firebase-SDK (kein importScripts): FCM liefert die Nachricht
// als JSON {data, notification?, from, fcmMessageId}. Alle Listener stehen auf
// oberster Ebene, damit sie nach jedem SW-Neustart sofort registriert sind —
// sonst kommt ein Push nach dem Idle-Stopp ohne Handler an (Chrome zeigt dann
// eine Zwangs-Meldung, iOS entzieht nach wenigen Fällen das Push-Abo).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

function readPayload(data) {
  if (!data) return {};
  try {
    return data.json() || {};
  } catch {
    return {};
  }
}

self.addEventListener("push", (event) => {
  const msg = readPayload(event.data);
  const d = msg.data || {};
  const n = msg.notification || {};
  const title = d.title || n.title || "Geschenke-Manager";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const appFocused = wins.some((w) => w.focused);
      const options = {
        body: d.body || n.body || "",
        icon: "/pwa-192x192.png",
        badge: "/pwa-64x64.png",
        tag: d.tag || "gm-general",
        renotify: d.renotify === "1",
        // IMMER eine sichtbare Meldung (iOS/Chrome-Pflicht), bei offener
        // App aber ohne Ton.
        silent: appFocused,
        data: {
          url: d.url || "/",
          type: d.type || "",
          groupId: d.groupId || "",
          giftId: d.giftId || "",
        },
      };
      try {
        await self.registration.showNotification(title, options);
      } catch {
        // Nie ohne Meldung enden — Minimal-Variante ohne Extras.
        await self.registration.showNotification(title, { body: options.body });
      }
      wins.forEach((w) => w.postMessage({ type: "GM_PUSH", data: d }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  );
  // Nur App-interne Ziele öffnen.
  if (target.origin !== self.location.origin) {
    target = new URL("/", self.location.origin);
  }
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const win = wins.find((w) => new URL(w.url).origin === target.origin);
      if (win) {
        // Das Fenster wird nicht von diesem SW kontrolliert (anderer Scope),
        // deshalb navigiert die App selbst (usePushNavigation).
        await win.focus();
        win.postMessage({
          type: "GM_NAVIGATE",
          url: target.pathname + target.search,
        });
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});

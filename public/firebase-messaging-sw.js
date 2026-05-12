/* eslint-disable no-undef */
// Background-Push-Worker. Wird vom Firebase-Messaging-SDK an Scope
// /firebase-cloud-messaging-push-scope registriert und läuft parallel zum
// Workbox-SW (Scope /). Beide stören sich nicht.
//
// Werte unten werden zur Build-Zeit per vite-plugin-pwa includeAssets
// statisch ausgeliefert. Wenn du Firebase-Config änderst, hier mit pflegen.
importScripts(
  "https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js",
);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

// Diese Werte werden vom Client beim ersten getToken() via postMessage an
// den SW geschickt — so vermeiden wir hardcoded API-Keys im Public-Ordner.
let messaging = null;
function initMessaging(config) {
  if (messaging || !config) return;
  firebase.initializeApp(config);
  messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? "Geschenke-Manager";
    const options = {
      body: payload.notification?.body ?? "",
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      data: payload.data ?? {},
      tag: payload.data?.tag ?? "gm-stack-update",
    };
    return self.registration.showNotification(title, options);
  });
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG") {
    initMessaging(event.data.config);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((wins) => {
      const existing = wins.find((w) => w.url.endsWith(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});

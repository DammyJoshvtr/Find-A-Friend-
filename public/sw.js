const CACHE_NAME = "faf-v3";
const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const oldCaches = keys.filter((k) => k !== CACHE_NAME);
      const isUpdate = oldCaches.length > 0;

      await Promise.all(oldCaches.map((k) => caches.delete(k)));
      await self.clients.claim();

      // Only tell clients to reload when this is an update, not the first install.
      if (isUpdate) {
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((client) =>
          client.postMessage({ type: "SW_UPDATED" })
        );
      }
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // 1. HTML pages and root navigation: Network-First (fallback to Cache)
  if (event.request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname === "/") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // 2. JS, CSS, images, and other assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // Fallback to cached version if network fails
      return cached || fetchPromise;
    })
  );
});

// Allow the page to manually trigger a SW swap (sent from +html.tsx)
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Web Push (VAPID) ─────────────────────────────────────────────────────────
// Fired when the dashboard sends a web push notification.
// Works even when the PWA tab is closed (iOS 16.4+ Add to Home Screen).
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "FAF", body: event.data.text() };
  }

  const title = payload.title || "FAF";
  const body = payload.body || "You have a new update.";
  const type = payload.type || "announcement";

  const options = {
    body,
    icon: "/assets/images/icon.png",
    badge: "/assets/images/icon.png",
    data: { type, url: payload.url || "/" },
    tag: type, // deduplicate: iOS replaces same-tag notifications
    renotify: true,
    // Vibrate pattern only works on Android
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// When the user taps the notification, open/focus the PWA
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an existing window if one is open
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

const CACHE = "osakevahti-shell-v2.17.8-alpha-issue77-repair1";
const SHELL = [
  "./",
  "./index.html",
  "./image-reader.js",
  "./alpha-import-engine.mjs",
  "./engine/acceptance.mjs",
  "./engine/numbers.mjs",
  "./engine/csv.mjs",
  "./engine/holdings.mjs",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      // CacheStorage is origin-wide, not scoped to this service worker.
      // Other GitHub Pages PWAs on this origin must keep their own caches.
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith("osakevahti-shell-") && k !== CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Financial JSON must never be served from the PWA cache.
  if (url.origin === self.location.origin && url.pathname.endsWith(".json")) {
    event.respondWith(fetch(req));
    return;
  }

  if (url.origin !== self.location.origin) return;
  // Acquire the handle before awaiting network. A retired worker must not
  // reopen its cache after a new worker has deleted it during activation.
  const cacheReady = caches.open(CACHE).catch(() => null);
  const read = key => cacheReady.then(cache => cache?.match(key));
  const network = key => fetch(req).then(async res => {
    if (res.ok) {
      try { const cache = await cacheReady; if (cache) await cache.put(key, res.clone()); }
      catch { /* Storage failure must not discard a valid online response. */ }
    }
    return res;
  });
  let response;
  if (req.mode === "navigate") {
    response = network("./index.html").catch(async () =>
      (await read("./index.html")) || Response.error());
  } else if (url.pathname.endsWith("/image-reader.js")) {
    response = network(req).catch(async () => (await read(req)) || Response.error());
  } else {
    response = read(req).then(cached => cached || network(req));
  }
  event.respondWith(response);
  // Response completion includes cache writes; retain the worker until settled.
  event.waitUntil(response.then(() => undefined, () => undefined));
});

// Push handler is ready. Subscription and VAPID backend are added later.
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "Osakevahti";
  const options = {
    body: data.body || "Uusi tärkeä markkinahälytys.",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: data.tag || "osakevahti-alert",
    renotify: false,
    data: { url: data.url || "./" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "./"));
});

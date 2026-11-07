const CACHE = "osakevahti-shell-v2.17.9-alpha-private-data1";
const SHELL = [
  "./",
  "./index.html",
  "./image-reader.js",
  "./alpha-import-engine.mjs",
  "./engine/acceptance.mjs",
  "./engine/numbers.mjs",
  "./engine/csv.mjs",
  "./engine/holdings.mjs",
  "./engine/public-nav-backup.mjs",
  "./engine/public-nav-backup.mjs?nav-reader=2",
  "./engine/nav-consent.mjs",
  "./engine/instrument-data.mjs",
  "./engine/instrument-client.mjs",
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
  // The versioned shell is written ONLY by install/addAll. A retired worker
  // can still finish a fetch after activate deletes its cache. match() never
  // creates a namespace; open()/put() here could resurrect the retired shell.
  // Online responses are returned, but become offline assets only after the
  // next successfully installed worker version (never a mixed-version shell).
  const read = key => caches.match(new URL(key.url || key, self.location.href).href,
    {cacheName:CACHE}).catch(() => undefined);
  const network = () => fetch(req);
  let response;
  if (req.mode === "navigate") {
    response = network().catch(async () =>
      (await read("./index.html")) || Response.error());
  } else if (url.pathname.endsWith("/image-reader.js")) {
    response = network().catch(async () => (await read(req)) || Response.error());
  } else {
    response = read(req).then(cached => cached || network());
  }
  event.respondWith(response);
  // Keep pending offline reads alive until the response settles.
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

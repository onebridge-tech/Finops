// Keeps the field screen usable with no signal (FS-08). Only the field page and
// static app files are cached; nothing else is stored on the device.
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![PAGES, STATIC].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  // Sent on sign-out so the next person on this phone can't open a cached copy.
  if (e.data === "clear") e.waitUntil(caches.delete(PAGES));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate" && (url.pathname === "/field" || url.pathname.startsWith("/field/"))) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.pathname === "/field") { const copy = res.clone(); caches.open(PAGES).then((c) => c.put("/field", copy)); }
          return res;
        })
        .catch(async () => (await caches.match("/field")) || new Response("You are offline and the field screen has not been opened on this phone yet.", { status: 503, headers: { "Content-Type": "text/plain" } })),
    );
  }
});

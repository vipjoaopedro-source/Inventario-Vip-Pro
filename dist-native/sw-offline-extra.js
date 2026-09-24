// Offline-first navigation support.
// Precaches the app's HTML shells at install time so the app works
// without any network connection, even on first launch after install.

const HTML_CACHE = "contagem-html";
const SHELL_ROUTES = ["/", "/nova", "/config", "/catalogo"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(HTML_CACHE);
      await Promise.allSettled(
        SHELL_ROUTES.map(async (route) => {
          const response = await fetch(route, { cache: "reload" });
          if (response && response.ok) await cache.put(route, response.clone());
        }),
      );
    })(),
  );
});

// Navigations: try network, fall back to any cached HTML (route itself, then "/").
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(HTML_CACHE);
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
          await cache.put(new Request(new URL(request.url).pathname), fresh.clone());
        }
        return fresh;
      } catch {
        const pathname = new URL(request.url).pathname;
        return (
          (await cache.match(pathname)) ||
          (await cache.match("/")) ||
          Response.error()
        );
      }
    })(),
  );
});

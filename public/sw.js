const CACHE_NAME = "fabric-care-shell-v5";
const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/manifest.webmanifest",
  "/fabric-care-logo.png",
  "/fabric-care-banner.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/favicon.ico",
];

// Install: Cache App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[SW] Pre-cache failed:", err))
  );
});

// Activate: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never cache non-GET requests, tRPC API calls, or database endpoints
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/trpc") ||
    url.pathname.startsWith("/api") ||
    url.hostname.includes("mongodb") ||
    url.hostname.includes("auth")
  ) {
    return; // Pass through to network
  }

  // 2. Navigation requests (HTML pages) -> Network first, fallback to cached index.html, then offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const cachedIndex = await caches.match("/index.html");
          if (cachedIndex) return cachedIndex;

          // Offline fallback UI
          return new Response(
            `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fabric Care — Offline</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0F4C5C; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; text-align: center; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 36px 28px; max-width: 380px; box-shadow: 0 10px 30px rgba(15,76,92,0.08); }
    .logo { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 14px; }
    h1 { font-size: 20px; font-weight: 800; margin: 0 0 8px; color: #0F4C5C; }
    p { font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 20px; }
    button { background: #0F4C5C; color: #ffffff; border: none; border-radius: 12px; font-size: 13px; font-weight: 700; padding: 12px 24px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <img src="/fabric-care-logo.png" alt="Fabric Care" class="logo" />
    <h1>You are currently offline</h1>
    <p>Fabric Care couldn't reach the server. Please check your internet connection and try again.</p>
    <button onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`,
            {
              headers: { "Content-Type": "text/html;charset=utf-8" },
            }
          );
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Images, Fonts) -> Stale While Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Message listener for skipWaiting update trigger
self.addEventListener("message", (event) => {
  if (event.data && (event.data.action === "SKIP_WAITING" || event.data.type === "SKIP_WAITING")) {
    self.skipWaiting();
  }
});

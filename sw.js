// ══════════════════════════════════════════
// SERVICE WORKER — offline app-shell support
// Built 4 Aug 2026 (last item on the original Known Issues backlog).
//
// This app has no backend and no persisted data — every quotation/job/
// customer lives in in-memory JS arrays seeded fresh on each full page
// load (see data.js). "Offline support" here means exactly one thing:
// the app SHELL (this static HTML/CSS/JS) still loads with no network
// connection, so the PIN screen and every module render — it does NOT
// mean data survives a reload, online or offline, since this app never
// persists data across reloads at all, regardless of network state.
//
// Strategy: network-first, falling back to cache. NOT cache-first — this
// codebase changes every session (multiple commits some days), and a
// naive cache-first worker would silently serve stale JS to a user who
// has a perfectly good connection, which would be a real regression, not
// a feature. The cache exists purely as the offline fallback; every
// successful online fetch refreshes it.
// ══════════════════════════════════════════

const CACHE_VERSION = "amd-app-v66"; // v66: the crew clock — the one way hours are logged
const CORE_ASSETS = [
  "./", "./index.html", "./styles.css", "./dashboard-tokens.css", "./owner-dashboard.css", "./sales-dashboard.css", "./estimator.css", "./ops-dashboard.css", "./purchase.css", "./production.css", "./manifest.json", "./logo.jpeg",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png",
  "./data.js", "./purchase-item-gate.js", "./purchase-data.js", "./purchase-ui.js", "./store-data.js", "./production-data.js", "./production-ui.js", "./chart-widgets.js", "./planner-tasks.js", "./ops-dashboard.js", "./auth.js", "./approval-queue.js", "./print.js", "./teamcomms.js", "./shell.js",
  "./operations.js", "./curtain.js",
  "./purchasing.js", "./storekeeper.js", "./sales-dashboard.js", "./sales.js", "./estimator-dashboard.js", "./estimator.js",
  "./approver.js", "./jobs.js", "./accounts.js", "./hr.js", "./exec-shell.js", "./owner-dashboard.js", "./owner.js", "./admin.js",
  "./dept-pipeline-ui.js", "./joinery.js", "./upholstery.js", "./upholstery-data.js", "./upholstery-ui.js", "./upholstery.css", "./crew-timer-data.js", "./crew-timer.js", "./crew-timer.css", "./painting.js",
  "./fleet-delivery.js", "./demo-data.js"
];

// The Supabase client library is loaded from a CDN (auth.js, Phase 1 of
// the cloud migration) — a cross-origin resource whose CORS behavior
// this app doesn't control. Cached separately and best-effort: if it
// ever fails (CDN down, CORS quirk), that must NOT take down offline
// caching for the entire rest of the app, which is why it's not in
// CORE_ASSETS above.
const OPTIONAL_ASSETS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.0"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS).then(() =>
        cache.addAll(OPTIONAL_ASSETS).catch(() => {})
      ))
      .then(() => self.skipWaiting())
  );
});

// Versioned cache name means every future deploy that bumps CACHE_VERSION
// automatically drops the old cache here — no stale-forever risk.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return undefined;
      }))
  );
});

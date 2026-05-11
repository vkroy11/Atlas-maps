/* Atlas Offline — service worker
 *
 * Bumps the cache version on every change to this file so old clients
 * pick up the new SW after a single reload.
 *
 * Strategies:
 *   - App shell (HTML)          : network-first, cache fallback on offline.
 *   - Static assets (JS/CSS/img): cache-first, network on miss + lazy populate.
 *   - MapTiler assets           : stale-while-revalidate so style.json, sprite,
 *                                 and glyphs survive a cold offline launch.
 *   - Cross-origin / opaque     : passthrough (no caching).
 *
 * Tile PBFs do NOT hit this SW — they're routed via `maplibregl.addProtocol`
 * to IndexedDB and never go through `fetch()`.
 */

const VERSION = 'v1';
const SHELL_CACHE = `atlas-shell-${VERSION}`;
const ASSET_CACHE = `atlas-assets-${VERSION}`;
const MAPTILER_CACHE = `atlas-maptiler-${VERSION}`;

const APP_SHELL = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, MAPTILER_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip non-http(s) schemes (chrome-extension://, blob:, etc.)
  if (!url.protocol.startsWith('http')) return;

  // MapTiler — stale-while-revalidate so style/sprite/glyphs work cold-offline.
  if (url.host === 'api.maptiler.com') {
    event.respondWith(staleWhileRevalidate(req, MAPTILER_CACHE));
    return;
  }

  // Same-origin navigation (HTML) — network-first, cache fallback.
  if (
    url.origin === self.location.origin &&
    (req.mode === 'navigate' || req.destination === 'document')
  ) {
    event.respondWith(networkFirstWithShellFallback(req));
    return;
  }

  // Same-origin static assets — cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }

  // Anything else (cross-origin, opaque): passthrough.
});

async function networkFirstWithShellFallback(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(SHELL_CACHE);
    cache.put(req, fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    const root = await caches.match('/');
    if (root) return root;
    return new Response('offline', { status: 503, statusText: 'offline' });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok && res.type !== 'opaque') cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    return new Response('offline', { status: 503, statusText: 'offline' });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  if (cached) {
    network.catch(() => {});
    return cached;
  }
  const live = await network;
  if (live) return live;
  return new Response('offline', { status: 503, statusText: 'offline' });
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

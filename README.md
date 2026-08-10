# Atlas Offline

Offline-first cross-platform tactical mapping for Delhi NCR. React Native + Web, vector tiles, persistent storage, SHA-256 dedup, predictive prefetching, installable PWA.

**Android App** https://drive.google.com/drive/folders/12Qv9olWBZPfmuWrlhBAwYjmDR0tsQpoZ?usp=sharing

**Live:** https://atlas-maps.vishalkumarroy.xyz/

> Once you've viewed a region online, it stays available offline — same zoom, same clarity, forever.

## Install as a PWA (use the app offline)

The web build ships with a service worker and Web App Manifest, so https://atlas-maps.vishalkumarroy.xyz/ is installable on phones and desktops. After installation the **entire app**, including the map style, sprite, glyphs, and previously-viewed tiles, runs without a network connection.

| Platform                       | How to install                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Android / Chromium desktop** | Open https://atlas-maps.vishalkumarroy.xyz/, then either tap the install icon in the address bar or `⋮ → Install app`. |
| **iOS Safari**                 | Open the URL, tap the **Share** button, choose **Add to Home Screen**.                                                 |
| **Firefox (mobile)**           | `⋮ → Install` (Android) or "Add to home screen" prompt.                                                                |
| **Desktop Edge / Chrome**      | Address-bar install icon, or `⋮ → Apps → Install this site as an app`.                                                 |

After install, launch it from the home screen / app launcher like any native app. The first launch needs network for the initial cache; every subsequent launch works offline.

**One-time setup, every browser:** visit the URL once online so the service worker installs and warms its cache. After that, pan around any region you want available offline (vector tiles are cached per `(z, x, y)` on view), then you can go offline — close the tab, restart the device, disconnect Wi-Fi — and the app still loads and renders the cached map.

## Stack

| Layer                   | Choice                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| App framework           | Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9                                       |
| Routing                 | Expo Router (file-based, `app/`)                                                               |
| Map renderer            | MapLibre GL JS (web) · `@maplibre/maplibre-react-native` v11 (native)                          |
| Tile source             | MapTiler — `streets-v2` OpenMapTiles                                                           |
| Storage                 | SQLite via `expo-sqlite` (native) · IndexedDB via `idb` (web)                                  |
| Hashing                 | SHA-256 — `expo-crypto` (native) · Web Crypto (web)                                            |
| Offline tile protocol   | `maplibregl.addProtocol('offline')` (web) · local HTTP server on `127.0.0.1:<random>` (native) |
| PWA / web offline shell | Custom service worker + Web App Manifest (web only)                                            |
| Settings persistence    | `@react-native-async-storage/async-storage`                                                    |

## Architecture

### High-level layers

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           Atlas Offline                                    │
├────────────────────────────────────────────────────────────────────────────┤
│  Presentation        app/_layout.tsx · MapScreen · StatsScreen · OPS       │
├────────────────────────────────────────────────────────────────────────────┤
│  Hooks               useMapSetup (storage+protocol+style)                  │
│                      usePrefetch (debounce → predict → enqueue)            │
├────────────────────────────────────────────────────────────────────────────┤
│  Renderer            MapView.web.tsx (maplibre-gl)                         │
│                      MapView.native.tsx (@maplibre/maplibre-react-native)  │
├────────────────────────────────────────────────────────────────────────────┤
│  Protocol            web : maplibregl.addProtocol('offline', …)            │
│                      native: HTTP server on 127.0.0.1:<random>             │
├────────────────────────────────────────────────────────────────────────────┤
│  Orchestration       getTile = cache-first + in-flight coalesce            │
│                      PrefetchQueue (concurrency-limited FIFO)              │
├────────────────────────────────────────────────────────────────────────────┤
│  Storage             SQLite (native) · IndexedDB (web)                     │
│                      tile_blobs (hash → bytes, ref_count)                  │
│                      tile_index (z,x,y → hash, last_accessed)              │
├────────────────────────────────────────────────────────────────────────────┤
│  Network             fetchTile = retries · backoff · AbortSignal · 404/429 │
│                      MapTiler vector tiles + style + sprite + glyphs       │
└────────────────────────────────────────────────────────────────────────────┘
```

### Tile request flow

```
                          ┌─────────────────────┐
                          │ MapView (web/native)│
                          │   MapLibre renderer │
                          └──────────┬──────────┘
                                     │ requests offline://{z}/{x}/{y}.pbf
                                     │     (web — addProtocol)
                                     │ or  GET /tiles/{z}/{x}/{y}.pbf on
                                     │     127.0.0.1:<port> (native HTTP)
                                     ▼
                          getTile(storage, coord)
                                     │
                                     │ in-flight coalescer dedups
                                     │ concurrent requests for same coord
                                     ▼
                          ┌──────── storage hit? ────────┐
                         YES                             NO
                          │                              │
                          │                              ▼
                          │                  fetchTile(z, x, y)
                          │                              │
                          │              retries · backoff · AbortSignal
                          │              404 → empty tile · 429/5xx → retry
                          │                              │
                          │                              ▼
                          │                       SHA-256(payload)
                          │                              │
                          │                  ┌───── known hash? ──────┐
                          │                 YES                       NO
                          │                  │                        │
                          │                  ▼                        ▼
                          │           ref_count + 1            insert tile_blobs
                          │                  │                        │
                          │                  └──────────┬─────────────┘
                          │                             ▼
                          │              upsert tile_index → hash
                          ▼                             │
                update last_accessed                     │
                          │                             │
                          └──────────────┬──────────────┘
                                         ▼
                                  return bytes
```

Identical PBF payloads (common between adjacent tiles) share one blob in `tile_blobs`. Replacing a tile decrements the old blob's ref-count and frees it when it reaches zero. `tile_index` is the only place the `(z, x, y) → hash` mapping lives.

### Predictive prefetch flow

```
move-end / region-did-change
            │
            ▼
   center {z, x, y} ──► debounce 500ms ──► predictNeighbors(center, radius)
                                                       │
                            ┌──────────────────────────┴───────────────────┐
                            ▼                                              ▼
                  (2r+1)² ring at same z          4 children at z+1 · 1 parent at z-1
                            └──────────────────────────┬───────────────────┘
                                                       │
                                              filter: within Delhi NCR
                                                       │
                                                       ▼
                                              PrefetchQueue
                                          (concurrency 4, dedup)
                                                       │
                                                       ▼
                                         getTile per coord (background)
```

### Web offline shell

```
First visit (online)          Every subsequent visit (online OR offline)
┌─────────────────┐           ┌─────────────────────────────────────────┐
│  GET /          │           │  GET /        ── handled by sw.js       │
│  GET /sw.js     │           │  └─ network-first, cache fallback       │
│   ↓ register    │           │  GET /_expo/static/js/…  ── cache-first │
│  install event  │           │  GET /_expo/static/css/… ── cache-first │
│   ↓ preload     │           │  GET api.maptiler.com/maps/style.json   │
│  / + manifest   │           │       and sprite/glyphs                 │
└─────────────────┘           │  └─ stale-while-revalidate              │
                              │  GET offline://{z}/{x}/{y}.pbf          │
                              │  └─ maplibregl.addProtocol → IndexedDB  │
                              └─────────────────────────────────────────┘
```

Three layered caches:

1. `atlas-shell-v1` — HTML, manifest, top-level navigations.
2. `atlas-assets-v1` — JS / CSS / images at the same origin.
3. `atlas-maptiler-v1` — MapTiler style JSON, sprite, glyphs.
4. **IndexedDB** (`atlas-offline` DB) — tile PBFs, addressed by `(z, x, y) → SHA-256`.

Tile bytes **never** flow through the service worker; they're served by maplibre-gl's `addProtocol` handler from IndexedDB.

## Prerequisites

- Node 20+
- A MapTiler key (free at https://cloud.maptiler.com/account/keys/)
- For native dev builds: Xcode (iOS) or Android Studio + SDK (Android)

## Setup

```bash
git clone <repo>
cd map
npm install
cp .env.example .env    # set MAPTILER_KEY=<your-key>
```

## Run

| Target                        | Command                                              | Notes                                                                               |
| ----------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Web (dev)**                 | `npm run web`                                        | Opens http://localhost:8081 — fastest dev loop                                      |
| **Web (production bundle)**   | `npm run build:web`                                  | Writes static SPA into `dist/` with PWA bits injected; serve with any static host   |
| **Native dev client (local)** | `npx expo run:ios` / `run:android`                   | First build is slow (10–20 min); then `npx expo start --dev-client` for live reload |
| **Native dev client (EAS)**   | `eas build --profile development --platform android` | Cloud build; needs `eas secret:create --name MAPTILER_KEY --value <key>` first      |
| **Tests**                     | `npm test`                                           | Jest, 64+ unit tests                                                                |
| **Typecheck**                 | `npm run typecheck`                                  |                                                                                     |
| **Lint / format**             | `npm run lint` / `npm run format`                    |                                                                                     |
| **Regenerate icons**          | `npm run icons`                                      | Reads `scripts/generate-icons.mjs`, writes PNGs into `assets/` and `public/`        |

## Deploy the web build

`npm run build:web` produces a static SPA under `dist/`. Drop it on any static host (Vercel, Netlify, Cloudflare Pages, S3 + CloudFront, etc.).

My current deployment lives at https://atlas-maps.vishalkumarroy.xyz/ on Vercel.

Vercel project settings:

- **Build command**: `npm run build:web`
- **Output directory**: `dist`
- **Environment variable**: `MAPTILER_KEY` (set as an Encrypted secret — Vercel does not auto-upload local `.env`).

**Important**: restrict your MapTiler key to your domain. https://cloud.maptiler.com/account/keys/ → key → **Allowed origins** → add `https://atlas-maps.vishalkumarroy.xyz` (and `http://localhost:8081`, `http://localhost:4173` for development). The key ships in the JS bundle on the web — origin restriction is what stops randos from abusing it.

## What you'll see

- **Map screen (`/`)** — Delhi NCR map clamped to zoom 10–16. Pan around to populate the cache. Header has links to **STATS** and **OPS**.
- **STATS** — Tile-coord count, post-dedup blob count, dedup ratio, total cached bytes. "CLEAR CACHE" wipes the local storage.
- **OPS** — Toggle predictive prefetch, pick radius (3×3 / 5×5 / 7×7). Persisted via AsyncStorage.

## Project layout

```
app/                     Expo Router routes (thin re-exports)
  _layout.tsx            Root Stack + header navigation
  index.tsx              → MapScreen
  stats.tsx              → StatsScreen
  settings.tsx           → SettingsScreen
public/                  Static files copied to dist/ root by Expo CLI
  sw.js                  Service worker (shell + asset + MapTiler caching)
  manifest.json          PWA Web App Manifest
  icon-192.png · icon-512.png · icon-maskable-512.png · apple-touch-icon.png
src/
  screens/               MapScreen, StatsScreen, SettingsScreen
  components/            Reusable UI (status overlays, etc.)
  hooks/                 useMapSetup, usePrefetch
  map/                   Style loader + MapView (.web.tsx / .native.tsx split)
  protocols/             Web addProtocol + native HTTP server + register API
  services/
    tiles/               fetchTile (network), getTile (cache-first + coalesce)
    storage/             TileStorage interface, SQLite & IndexedDB backends, singleton
    hashing/             SHA-256 (.web.ts / .native.ts split)
    prefetch/            PrefetchQueue, predictNeighbors, AsyncStorage settings
  database/              SQLite schema
  utils/                 Tile math + Delhi NCR bounds
  types/                 Ambient declarations
scripts/
  generate-icons.mjs     SVG → PNG icon generator (assets/ + public/)
  inject-pwa.mjs         Post-build HTML injector (manifest + SW registration)
jest/                    Test-only mocks for native modules
```

## Database schema

```sql
CREATE TABLE tile_blobs (
  hash       TEXT PRIMARY KEY,
  data       BLOB NOT NULL,
  ref_count  INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE tile_index (
  z              INTEGER NOT NULL,
  x              INTEGER NOT NULL,
  y              INTEGER NOT NULL,
  hash           TEXT NOT NULL,
  last_accessed  INTEGER NOT NULL,
  PRIMARY KEY (z, x, y),
  FOREIGN KEY (hash) REFERENCES tile_blobs(hash)
);

CREATE INDEX idx_tile_index_hash ON tile_index(hash);
```

The IndexedDB backend mirrors the same shape with two object stores (`tile_blobs` keyed by `hash`, `tile_index` keyed by `[z, x, y]`).

## Configuration knobs

In `app.config.ts` and `src/utils/tileMath.ts`:

- `DELHI_NCR_BOUNDS` — geographic clamp (lat 28.40–28.90, lon 76.80–77.40)
- `ZOOM_RANGE` — 10–16 for the MVP
- `extra.maptilerKey` — pulled from `process.env.MAPTILER_KEY` at config-eval time

Prefetch defaults in `src/services/prefetch/settings.ts`:

- `enabled: true`
- `radius: 1` (3×3 neighbors per move)
- `concurrency: 4`

Service-worker cache versions in `public/sw.js` — bump `VERSION` to invalidate old client caches.

## Testing

```bash
npm test               # 64 unit tests across hashing, storage dedup,
                       # tile fetch retry/backoff, cache orchestrator
                       # coalescing, prefetch queue, predictor, protocols
npm run typecheck      # tsc --noEmit, strict
npm run lint           # eslint
```

The native HTTP tile server and MapLibre native bindings can't run under Jest — those are covered by manual smoke tests on a dev client build (see `CLAUDE.md`).

## License

Private. Not for distribution.

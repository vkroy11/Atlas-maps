# Atlas Offline

Offline-first cross-platform tactical mapping for Delhi NCR. React Native + Web, vector tiles, persistent storage, SHA-256 dedup, predictive prefetching.

> Once you've viewed a region online, it stays available offline — same zoom, same clarity, forever.

## Stack

| Layer | Choice |
|---|---|
| App framework | Expo SDK 54, React Native 0.81, React 19, TypeScript 5.9 |
| Routing | Expo Router (file-based, `app/`) |
| Map renderer | MapLibre GL JS (web) · `@maplibre/maplibre-react-native` v11 (native) |
| Tile source | MapTiler — `streets-v2` OpenMapTiles |
| Storage | SQLite via `expo-sqlite` (native) · IndexedDB via `idb` (web) |
| Hashing | SHA-256 — `expo-crypto` (native) · Web Crypto (web) |
| Offline protocol | `maplibregl.addProtocol('offline')` (web) · local HTTP server on `127.0.0.1:<random>` (native) |
| Settings persistence | `@react-native-async-storage/async-storage` |

## Architecture at a glance

```
                            ┌─────────────────────┐
                            │ MapView (web/native)│
                            │   MapLibre renderer │
                            └──────────┬──────────┘
                                       │
                  ┌────────── offline protocol ──────────┐
                  │                                      │
        web: addProtocol('offline')           native: GET /tiles/{z}/{x}/{y}.pbf
                  │                                      │
                  └────────────┬─────────────────────────┘
                               ▼
                       getTile(storage, coord)
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
            Storage hit               Storage miss
            (last_accessed              │
              touched)                  ▼
                              MapTiler fetch + SHA-256 dedup
                                        │
                                        ▼
                              tile_blobs ← tile_index
```

Tiles are stored content-addressed (`tile_blobs`, keyed by SHA-256 with a `ref_count`) and referenced from `tile_index` by `(z, x, y)` — identical PBF payloads share one blob, ref-counted on insert and freed when the last referring coord is replaced.

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

| Target | Command | Notes |
|---|---|---|
| **Web** (no dev client) | `npm run web` | Opens http://localhost:8081 — fastest dev loop |
| **Native dev client (local)** | `npx expo run:ios` / `run:android` | First build is slow (10–20 min); then `npx expo start --dev-client` for live reload |
| **Native dev client (EAS)** | `eas build --profile development --platform android` | Cloud build; needs `eas secret:create --name MAPTILER_KEY --value <key>` first |
| **Tests** | `npm test` | Jest, 64+ unit tests |
| **Typecheck** | `npm run typecheck` | |
| **Lint / format** | `npm run lint` / `npm run format` | |
| **Regenerate icons** | `npm run icons` | Reads `scripts/generate-icons.mjs`, writes PNGs into `assets/` |

## What you'll see

- **Map screen (`/`)** — Delhi NCR map clamped to zoom 10–16. Pan around to populate the cache. Header has links to **STATS** and **OPS**.
- **STATS** — Tile-coord count, post-dedup blob count, dedup ratio, total bytes. "CLEAR CACHE" wipes the local storage.
- **OPS** — Toggle predictive prefetch, pick radius (3×3 / 5×5 / 7×7). Persisted via AsyncStorage.

## Project layout

```
app/                     Expo Router routes (thin re-exports)
  _layout.tsx            Root Stack + header navigation
  index.tsx              → MapScreen
  stats.tsx              → StatsScreen
  settings.tsx           → SettingsScreen
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
  generate-icons.mjs     SVG → PNG icon generator
jest/                    Test-only mocks for native modules
```

## Configuration knobs

All in `app.config.ts` and `src/utils/tileMath.ts`:

- `DELHI_NCR_BOUNDS` — geographic clamp
- `ZOOM_RANGE` — 10–16 for MVP
- `extra.maptilerKey` — pulled from `process.env.MAPTILER_KEY` at config-eval time

Prefetch defaults in `src/services/prefetch/settings.ts`:
- `enabled: true`
- `radius: 1` (3×3 neighbors per move)
- `concurrency: 4`

## Out of scope (per PRD §4)

Live navigation, routing, satellite imagery, terrain rendering, MGRS, multi-user sync, encrypted storage, cloud sync, differential tile updates.

## License

Private. Not for distribution.

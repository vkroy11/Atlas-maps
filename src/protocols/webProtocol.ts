import type { TileStorage } from '../services/storage';
import { getTile, TileNotFoundError } from '../services/tiles';

/**
 * Web-side `offline://` resolver.
 *
 * MapLibre GL JS lets us register a custom protocol via `addProtocol`. We use
 * it to point all vector tile sources at `offline://{z}/{x}/{y}.pbf`; the
 * handler routes every tile request through our cache-first orchestrator.
 *
 * `maplibre-gl` is required lazily so this file is safe to import from
 * Node-side tests (Jest has no DOM, and maplibre-gl assumes a browser).
 */

export const OFFLINE_TILE_TEMPLATE = 'offline://{z}/{x}/{y}.pbf';

const URL_RE = /^offline:\/\/(\d+)\/(\d+)\/(\d+)\.pbf$/;

export function parseOfflineUrl(url: string): { z: number; x: number; y: number } | null {
  const m = URL_RE.exec(url);
  if (!m) return null;
  return { z: Number(m[1]), x: Number(m[2]), y: Number(m[3]) };
}

/**
 * Pure handler — given a URL and an abort signal, returns the tile bytes as an
 * ArrayBuffer. Out-of-bounds tiles (404 from MapTiler) resolve to an empty
 * buffer so MapLibre renders empty space instead of erroring the whole style.
 */
export async function resolveOfflineTile(
  storage: TileStorage,
  url: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const coord = parseOfflineUrl(url);
  if (!coord) {
    throw new Error(`Invalid offline:// URL: ${url}`);
  }
  try {
    const bytes = await getTile(storage, coord, { signal });
    return toArrayBuffer(bytes);
  } catch (err) {
    if (err instanceof TileNotFoundError) return new ArrayBuffer(0);
    throw err;
  }
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

interface MapLibreLike {
  addProtocol: (
    scheme: string,
    fn: (params: { url: string }, ctl: AbortController) => Promise<{ data: ArrayBuffer }>,
  ) => void;
  removeProtocol: (scheme: string) => void;
}

/**
 * Registers `offline://` with MapLibre GL JS. Returns a cleanup function that
 * removes the protocol — call on unmount to avoid leaking handlers across HMR.
 */
export function registerOfflineProtocol(storage: TileStorage): () => void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const mod = require('maplibre-gl');
  const maplibregl: MapLibreLike = mod.default ?? mod;

  maplibregl.addProtocol('offline', async (params, ctl) => {
    const data = await resolveOfflineTile(storage, params.url, ctl.signal);
    return { data };
  });

  return () => {
    maplibregl.removeProtocol('offline');
  };
}

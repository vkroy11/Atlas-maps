import type { TileCoord, TileStorage } from '../storage';

import { fetchTile, TileNotFoundError, type FetchTileOptions } from './fetchTile';

export interface GetTileOptions extends FetchTileOptions {
  /** When true, skip the cache and force a network fetch. */
  forceRefresh?: boolean;
  /** Test seam — defaults to the real `fetchTile`. */
  fetcher?: typeof fetchTile;
}

const inFlight = new Map<string, Promise<Uint8Array>>();

function key(coord: TileCoord): string {
  return `${coord.z}/${coord.x}/${coord.y}`;
}

/**
 * Cache-first tile resolver.
 *
 *   1. Check `storage` — return immediately on hit.
 *   2. If a request for the same coord is already in flight, await it.
 *   3. Otherwise fetch from network, write to cache (which dedups), return.
 *
 * Re-throws `TileNotFoundError` from the network layer so callers can decide
 * whether to render an empty tile or treat it as a hard error.
 */
export async function getTile(
  storage: TileStorage,
  coord: TileCoord,
  opts: GetTileOptions = {},
): Promise<Uint8Array> {
  const { forceRefresh = false, fetcher = fetchTile, ...fetchOpts } = opts;

  if (!forceRefresh) {
    const cached = await storage.getTile(coord);
    if (cached) return cached;
  }

  const k = key(coord);
  const pending = inFlight.get(k);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const data = await fetcher(coord.z, coord.x, coord.y, fetchOpts);
      await storage.putTile(coord, data);
      return data;
    } finally {
      inFlight.delete(k);
    }
  })();

  inFlight.set(k, promise);
  return promise;
}

/** Test helper — clear coalescer state between tests. */
export function __resetInFlight(): void {
  inFlight.clear();
}

export { TileNotFoundError };

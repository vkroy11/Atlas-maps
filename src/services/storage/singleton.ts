import { createTileStorage } from './factory';
import type { TileStorage } from './types';

/**
 * Process-wide shared TileStorage. Stats / Settings / Map all read from the
 * same SQLite (or IndexedDB) instance — avoids opening multiple connections
 * to the same file and lets writes from one screen surface immediately in
 * another.
 *
 * Never closed in MVP: storage handles are cheap to keep open, and there's
 * no clean app-quit lifecycle hook to tear them down anyway.
 */

let instance: TileStorage | null = null;
let initPromise: Promise<TileStorage> | null = null;

export async function getSharedStorage(): Promise<TileStorage> {
  if (instance) return instance;
  if (!initPromise) {
    initPromise = createTileStorage().then((s) => {
      instance = s;
      return s;
    });
  }
  return initPromise;
}

/** Test seam — clear the cached instance between tests. */
export function __resetSharedStorage(): void {
  instance = null;
  initPromise = null;
}

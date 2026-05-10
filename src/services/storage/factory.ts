import { IndexedDBStorage } from './indexeddbStorage';

import type { TileStorage } from './types';

/**
 * Default factory — used by web bundle and Jest test env.
 * Native (`factory.native.ts`) returns a SQLite-backed instance.
 */
export async function createTileStorage(): Promise<TileStorage> {
  const storage = new IndexedDBStorage();
  await storage.init();
  return storage;
}

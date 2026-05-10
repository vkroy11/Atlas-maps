import { SQLiteStorage } from './sqliteStorage';

import type { TileStorage } from './types';

export async function createTileStorage(): Promise<TileStorage> {
  const storage = new SQLiteStorage();
  await storage.init();
  return storage;
}

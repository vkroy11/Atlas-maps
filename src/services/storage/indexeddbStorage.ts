import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

import { hashTile } from '../hashing';

import type { StorageStats, TileCoord, TileStorage } from './types';

const DB_NAME = 'atlas-offline';
const DB_VERSION = 1;
const STORE_BLOBS = 'tile_blobs';
const STORE_INDEX = 'tile_index';

interface BlobRecord {
  hash: string;
  data: Uint8Array;
  refCount: number;
  createdAt: number;
}

interface IndexRecord {
  z: number;
  x: number;
  y: number;
  hash: string;
  lastAccessed: number;
}

interface AtlasDB extends DBSchema {
  tile_blobs: {
    key: string;
    value: BlobRecord;
  };
  tile_index: {
    key: [number, number, number];
    value: IndexRecord;
    indexes: { 'by-hash': string };
  };
}

/**
 * Web tile cache backed by IndexedDB (via the `idb` wrapper).
 *
 * Mirrors the SQLite backend's two-store dedup logic so behavior is identical
 * across platforms — the smoke test in `factory.test.ts` exercises this path.
 */
export class IndexedDBStorage implements TileStorage {
  private db: IDBPDatabase<AtlasDB> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await openDB<AtlasDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'hash' });
        }
        if (!db.objectStoreNames.contains(STORE_INDEX)) {
          const idx = db.createObjectStore(STORE_INDEX, { keyPath: ['z', 'x', 'y'] });
          idx.createIndex('by-hash', 'hash');
        }
      },
    });
  }

  async getTile(coord: TileCoord): Promise<Uint8Array | null> {
    const db = this.requireDb();
    const tx = db.transaction([STORE_INDEX, STORE_BLOBS], 'readwrite');
    const indexStore = tx.objectStore(STORE_INDEX);
    const blobsStore = tx.objectStore(STORE_BLOBS);

    const indexRow = await indexStore.get([coord.z, coord.x, coord.y]);
    if (!indexRow) {
      await tx.done;
      return null;
    }
    const blob = await blobsStore.get(indexRow.hash);

    indexRow.lastAccessed = Date.now();
    await indexStore.put(indexRow);
    await tx.done;

    return blob ? blob.data : null;
  }

  async putTile(coord: TileCoord, data: Uint8Array): Promise<void> {
    const db = this.requireDb();
    const newHash = await hashTile(data);
    const now = Date.now();

    const tx = db.transaction([STORE_INDEX, STORE_BLOBS], 'readwrite');
    const indexStore = tx.objectStore(STORE_INDEX);
    const blobsStore = tx.objectStore(STORE_BLOBS);

    const existing = await indexStore.get([coord.z, coord.x, coord.y]);
    const oldHash = existing?.hash ?? null;

    if (oldHash === newHash) {
      await indexStore.put({
        z: coord.z,
        x: coord.x,
        y: coord.y,
        hash: newHash,
        lastAccessed: now,
      });
      await tx.done;
      return;
    }

    if (oldHash !== null) {
      const oldBlob = await blobsStore.get(oldHash);
      if (oldBlob) {
        oldBlob.refCount -= 1;
        if (oldBlob.refCount <= 0) {
          await blobsStore.delete(oldHash);
        } else {
          await blobsStore.put(oldBlob);
        }
      }
    }

    const newBlob = await blobsStore.get(newHash);
    if (newBlob) {
      newBlob.refCount += 1;
      await blobsStore.put(newBlob);
    } else {
      await blobsStore.put({ hash: newHash, data, refCount: 1, createdAt: now });
    }

    await indexStore.put({ z: coord.z, x: coord.x, y: coord.y, hash: newHash, lastAccessed: now });
    await tx.done;
  }

  async hasTile(coord: TileCoord): Promise<boolean> {
    const db = this.requireDb();
    const key = await db.getKey(STORE_INDEX, [coord.z, coord.x, coord.y]);
    return key !== undefined;
  }

  async getStats(): Promise<StorageStats> {
    const db = this.requireDb();
    const tx = db.transaction([STORE_INDEX, STORE_BLOBS], 'readonly');
    const tileCount = await tx.objectStore(STORE_INDEX).count();
    const blobs = await tx.objectStore(STORE_BLOBS).getAll();
    await tx.done;

    const blobCount = blobs.length;
    const totalBytes = blobs.reduce((sum, b) => sum + b.data.byteLength, 0);
    return {
      tileCount,
      blobCount,
      totalBytes,
      dedupRatio: blobCount === 0 ? 0 : tileCount / blobCount,
    };
  }

  async clear(): Promise<void> {
    const db = this.requireDb();
    const tx = db.transaction([STORE_INDEX, STORE_BLOBS], 'readwrite');
    await tx.objectStore(STORE_INDEX).clear();
    await tx.objectStore(STORE_BLOBS).clear();
    await tx.done;
  }

  async close(): Promise<void> {
    if (!this.db) return;
    this.db.close();
    this.db = null;
  }

  private requireDb(): IDBPDatabase<AtlasDB> {
    if (!this.db) {
      throw new Error('IndexedDBStorage.init() must be called before use');
    }
    return this.db;
  }
}

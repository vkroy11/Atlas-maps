/**
 * Platform-agnostic tile storage contract.
 *
 * Two backends implement this:
 *   - native: expo-sqlite (`sqliteStorage.ts`)
 *   - web:    IndexedDB via `idb` (`indexeddbStorage.ts`)
 *
 * Both store tiles using a two-table design that decouples coordinate keys
 * from blob storage so identical PBF payloads dedupe via SHA-256.
 *
 *   tile_blobs (hash PK, data, ref_count, created_at)
 *   tile_index (z, x, y) PK -> hash FK -> tile_blobs.hash
 */

export type TileCoord = {
  z: number;
  x: number;
  y: number;
};

export type TileBlob = {
  hash: string;
  data: Uint8Array;
  refCount: number;
  createdAt: number;
};

export type TileIndexRow = {
  z: number;
  x: number;
  y: number;
  hash: string;
  lastAccessed: number;
};

export type StorageStats = {
  /** Number of distinct (z,x,y) tile-coord rows in `tile_index`. */
  tileCount: number;
  /** Number of distinct blobs in `tile_blobs` (post-dedup). */
  blobCount: number;
  /** Sum of all blob byte sizes — approximate on-disk cost. */
  totalBytes: number;
  /**
   * tileCount / blobCount. 1.0 means no dedup; >1 means dedup is helping.
   * Returns 0 when blobCount is 0.
   */
  dedupRatio: number;
};

export interface TileStorage {
  /** Create tables / object stores if missing. Idempotent. */
  init(): Promise<void>;

  /**
   * Read a tile by coordinate. Updates `last_accessed` on hit.
   * Returns `null` on miss.
   */
  getTile(coord: TileCoord): Promise<Uint8Array | null>;

  /**
   * Write a tile. Hashes the payload, upserts into `tile_blobs`
   * (insert or `ref_count + 1`), upserts the (z,x,y) row in `tile_index`.
   * Atomic — partial writes are rolled back.
   */
  putTile(coord: TileCoord, data: Uint8Array): Promise<void>;

  /** Cheap existence check; does not touch `last_accessed`. */
  hasTile(coord: TileCoord): Promise<boolean>;

  /** Aggregate stats for the stats screen and dedup verification. */
  getStats(): Promise<StorageStats>;

  /** Drop everything. Used for tests and a "clear cache" UX action. */
  clear(): Promise<void>;

  /** Release native handles / close DB. Safe to call multiple times. */
  close(): Promise<void>;
}

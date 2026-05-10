/**
 * SQLite schema for the native tile cache.
 *
 * Two-table design (corrected from PRD §11) so SHA-256 dedup actually saves space:
 *   - tile_blobs : one row per distinct payload, ref-counted.
 *   - tile_index : one row per (z,x,y) coord, pointing at a blob hash.
 *
 * The IndexedDB backend (`indexeddbStorage.ts`) mirrors this with two object stores.
 */

export const DB_NAME = 'atlas.db';

export const SCHEMA_STATEMENTS = [
  `PRAGMA journal_mode = WAL;`,
  `PRAGMA foreign_keys = ON;`,
  `CREATE TABLE IF NOT EXISTS tile_blobs (
     hash TEXT PRIMARY KEY,
     data BLOB NOT NULL,
     ref_count INTEGER NOT NULL,
     created_at INTEGER NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS tile_index (
     z INTEGER NOT NULL,
     x INTEGER NOT NULL,
     y INTEGER NOT NULL,
     hash TEXT NOT NULL,
     last_accessed INTEGER NOT NULL,
     PRIMARY KEY (z, x, y),
     FOREIGN KEY (hash) REFERENCES tile_blobs(hash)
   );`,
  `CREATE INDEX IF NOT EXISTS idx_tile_index_hash ON tile_index(hash);`,
];

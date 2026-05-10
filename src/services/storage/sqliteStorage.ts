import * as SQLite from 'expo-sqlite';

import { DB_NAME, SCHEMA_STATEMENTS } from '../../database/schema';
import { hashTile } from '../hashing';

import type { StorageStats, TileCoord, TileStorage } from './types';

/**
 * Native tile cache backed by `expo-sqlite`.
 *
 * Dedup algorithm in `putTile`:
 *   1. Hash the new payload.
 *   2. Look up the existing hash for (z,x,y), if any.
 *   3. If the hash hasn't changed, only bump `last_accessed`.
 *   4. Otherwise, decrement (and possibly delete) the old blob, then insert
 *      the new blob (or bump its ref_count), then upsert the index row.
 * All steps run inside a single transaction so partial failures roll back.
 */
export class SQLiteStorage implements TileStorage {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await SQLite.openDatabaseAsync(DB_NAME);
    for (const stmt of SCHEMA_STATEMENTS) {
      await this.db.execAsync(stmt);
    }
  }

  async getTile(coord: TileCoord): Promise<Uint8Array | null> {
    const db = this.requireDb();
    const row = await db.getFirstAsync<{ data: Uint8Array }>(
      `SELECT b.data AS data
       FROM tile_index i JOIN tile_blobs b ON b.hash = i.hash
       WHERE i.z = ? AND i.x = ? AND i.y = ?`,
      [coord.z, coord.x, coord.y],
    );
    if (!row) return null;

    await db.runAsync(`UPDATE tile_index SET last_accessed = ? WHERE z = ? AND x = ? AND y = ?`, [
      Date.now(),
      coord.z,
      coord.x,
      coord.y,
    ]);

    return row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data);
  }

  async putTile(coord: TileCoord, data: Uint8Array): Promise<void> {
    const db = this.requireDb();
    const newHash = await hashTile(data);
    const now = Date.now();

    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<{ hash: string }>(
        `SELECT hash FROM tile_index WHERE z = ? AND x = ? AND y = ?`,
        [coord.z, coord.x, coord.y],
      );
      const oldHash = existing?.hash ?? null;

      if (oldHash === newHash) {
        await db.runAsync(
          `UPDATE tile_index SET last_accessed = ? WHERE z = ? AND x = ? AND y = ?`,
          [now, coord.z, coord.x, coord.y],
        );
        return;
      }

      if (oldHash !== null) {
        await db.runAsync(`UPDATE tile_blobs SET ref_count = ref_count - 1 WHERE hash = ?`, [
          oldHash,
        ]);
        await db.runAsync(`DELETE FROM tile_blobs WHERE hash = ? AND ref_count <= 0`, [oldHash]);
      }

      await db.runAsync(
        `INSERT INTO tile_blobs (hash, data, ref_count, created_at) VALUES (?, ?, 1, ?)
         ON CONFLICT(hash) DO UPDATE SET ref_count = ref_count + 1`,
        [newHash, data, now],
      );

      await db.runAsync(
        `INSERT OR REPLACE INTO tile_index (z, x, y, hash, last_accessed) VALUES (?, ?, ?, ?, ?)`,
        [coord.z, coord.x, coord.y, newHash, now],
      );
    });
  }

  async hasTile(coord: TileCoord): Promise<boolean> {
    const db = this.requireDb();
    const row = await db.getFirstAsync<{ one: number }>(
      `SELECT 1 AS one FROM tile_index WHERE z = ? AND x = ? AND y = ? LIMIT 1`,
      [coord.z, coord.x, coord.y],
    );
    return !!row;
  }

  async getStats(): Promise<StorageStats> {
    const db = this.requireDb();
    const tiles = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM tile_index`);
    const blobs = await db.getFirstAsync<{ n: number; bytes: number | null }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)), 0) AS bytes FROM tile_blobs`,
    );

    const tileCount = tiles?.n ?? 0;
    const blobCount = blobs?.n ?? 0;
    return {
      tileCount,
      blobCount,
      totalBytes: blobs?.bytes ?? 0,
      dedupRatio: blobCount === 0 ? 0 : tileCount / blobCount,
    };
  }

  async clear(): Promise<void> {
    const db = this.requireDb();
    await db.withTransactionAsync(async () => {
      await db.execAsync(`DELETE FROM tile_index;`);
      await db.execAsync(`DELETE FROM tile_blobs;`);
    });
  }

  async close(): Promise<void> {
    if (!this.db) return;
    await this.db.closeAsync();
    this.db = null;
  }

  private requireDb(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('SQLiteStorage.init() must be called before use');
    }
    return this.db;
  }
}

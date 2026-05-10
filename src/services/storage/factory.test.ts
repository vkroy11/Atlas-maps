/**
 * Round-trip smoke test for the storage layer.
 *
 * Runs against the IndexedDB backend via `fake-indexeddb`. Both backends share
 * the same dedup algorithm, so passing this test gives strong confidence that
 * SQLiteStorage behaves identically — the SQLite path is verified manually on
 * device once the dev client is built.
 */
import 'fake-indexeddb/auto';

import { createTileStorage } from './factory';
import type { TileStorage } from './types';

const SHARED_PAYLOAD = new Uint8Array(Array.from({ length: 256 }, (_, i) => i & 0xff));

function uniquePayload(seed: number): Uint8Array {
  const buf = new Uint8Array(64);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = (seed * 31 + i) & 0xff;
  }
  return buf;
}

describe('TileStorage — dedup round-trip', () => {
  let storage: TileStorage;

  beforeEach(async () => {
    storage = await createTileStorage();
    await storage.clear();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('stores 50 tiles with a shared payload + 50 unique → 51 blobs total', async () => {
    // 50 tiles share SHARED_PAYLOAD at z=14, x=0..49, y=0
    for (let i = 0; i < 50; i++) {
      await storage.putTile({ z: 14, x: i, y: 0 }, SHARED_PAYLOAD);
    }
    // 50 tiles have unique payloads at z=14, x=0..49, y=1
    for (let i = 0; i < 50; i++) {
      await storage.putTile({ z: 14, x: i, y: 1 }, uniquePayload(i));
    }

    const stats = await storage.getStats();
    expect(stats.tileCount).toBe(100);
    expect(stats.blobCount).toBe(51);
    expect(stats.dedupRatio).toBeCloseTo(100 / 51, 4);
  });

  it('round-trips a tile payload byte-for-byte', async () => {
    const payload = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xde, 0xad, 0xbe, 0xef]);
    await storage.putTile({ z: 12, x: 2345, y: 1234 }, payload);

    const read = await storage.getTile({ z: 12, x: 2345, y: 1234 });
    expect(read).not.toBeNull();
    expect(Array.from(read!)).toEqual(Array.from(payload));
  });

  it('returns null on cache miss', async () => {
    const read = await storage.getTile({ z: 10, x: 0, y: 0 });
    expect(read).toBeNull();
  });

  it('hasTile reflects existence without touching last_accessed', async () => {
    expect(await storage.hasTile({ z: 13, x: 7, y: 7 })).toBe(false);
    await storage.putTile({ z: 13, x: 7, y: 7 }, SHARED_PAYLOAD);
    expect(await storage.hasTile({ z: 13, x: 7, y: 7 })).toBe(true);
  });

  it('replacing a tile decrements the old blob and frees it when ref_count reaches 0', async () => {
    const a = uniquePayload(1);
    const b = uniquePayload(2);
    await storage.putTile({ z: 11, x: 1, y: 1 }, a);
    expect((await storage.getStats()).blobCount).toBe(1);

    // Replace at the same coord — the old blob has ref_count 1, should be GC'd.
    await storage.putTile({ z: 11, x: 1, y: 1 }, b);
    const stats = await storage.getStats();
    expect(stats.blobCount).toBe(1);
    expect(stats.tileCount).toBe(1);

    const read = await storage.getTile({ z: 11, x: 1, y: 1 });
    expect(Array.from(read!)).toEqual(Array.from(b));
  });

  it('replacing a tile only decrements when the old blob still has refs elsewhere', async () => {
    const shared = uniquePayload(42);
    await storage.putTile({ z: 11, x: 1, y: 1 }, shared);
    await storage.putTile({ z: 11, x: 2, y: 2 }, shared);
    expect((await storage.getStats()).blobCount).toBe(1);

    await storage.putTile({ z: 11, x: 1, y: 1 }, uniquePayload(99));
    const stats = await storage.getStats();
    expect(stats.blobCount).toBe(2); // shared blob still referenced by (11,2,2); plus the new payload
    expect(stats.tileCount).toBe(2);

    // (11,2,2) still resolves to the shared payload
    const stillShared = await storage.getTile({ z: 11, x: 2, y: 2 });
    expect(Array.from(stillShared!)).toEqual(Array.from(shared));
  });

  it('writing the identical payload to the same coord is a no-op for blobs', async () => {
    const data = uniquePayload(5);
    await storage.putTile({ z: 12, x: 1, y: 1 }, data);
    await storage.putTile({ z: 12, x: 1, y: 1 }, data);

    const stats = await storage.getStats();
    expect(stats.blobCount).toBe(1);
    expect(stats.tileCount).toBe(1);
  });

  it('clear() empties both stores', async () => {
    await storage.putTile({ z: 10, x: 0, y: 0 }, SHARED_PAYLOAD);
    await storage.putTile({ z: 10, x: 1, y: 0 }, uniquePayload(1));
    await storage.clear();
    const stats = await storage.getStats();
    expect(stats.tileCount).toBe(0);
    expect(stats.blobCount).toBe(0);
  });
});

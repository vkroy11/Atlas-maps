import 'fake-indexeddb/auto';

import { createTileStorage } from '../storage';
import type { TileStorage } from '../storage';

import { __resetInFlight, getTile } from './getTile';

// Flush enough microtasks for the orchestrator's cache-lookup awaits to settle.
const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('getTile — cache-first orchestrator', () => {
  let storage: TileStorage;

  beforeEach(async () => {
    __resetInFlight();
    storage = await createTileStorage();
    await storage.clear();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('returns the cached payload without calling the fetcher on a hit', async () => {
    const payload = new Uint8Array([7, 7, 7]);
    await storage.putTile({ z: 12, x: 1, y: 1 }, payload);

    const fetcher = jest.fn();
    const out = await getTile(storage, { z: 12, x: 1, y: 1 }, { fetcher });

    expect(Array.from(out)).toEqual([7, 7, 7]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fetches + stores on a cache miss', async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const fetcher = jest.fn().mockResolvedValue(payload);

    const out = await getTile(storage, { z: 14, x: 100, y: 200 }, { fetcher });
    expect(Array.from(out)).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledWith(14, 100, 200, expect.any(Object));

    // Second call hits cache.
    const out2 = await getTile(storage, { z: 14, x: 100, y: 200 }, { fetcher });
    expect(Array.from(out2)).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent requests for the same coord into one fetch', async () => {
    let resolveFetch!: (v: Uint8Array) => void;
    const fetcher = jest.fn(
      () =>
        new Promise<Uint8Array>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const a = getTile(storage, { z: 10, x: 5, y: 5 }, { fetcher });
    const b = getTile(storage, { z: 10, x: 5, y: 5 }, { fetcher });
    const c = getTile(storage, { z: 10, x: 5, y: 5 }, { fetcher });

    // Wait for the storage.getTile() awaits in each call to settle so the
    // fetcher actually fires before we assert.
    await flushPromises();
    await flushPromises();
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch(new Uint8Array([42]));
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    expect(Array.from(ra)).toEqual([42]);
    expect(Array.from(rb)).toEqual([42]);
    expect(Array.from(rc)).toEqual([42]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does NOT coalesce different coords', async () => {
    const fetcher = jest
      .fn<Promise<Uint8Array>, [number, number, number]>()
      .mockImplementation(async (_z, x) => new Uint8Array([x]));

    const [r1, r2] = await Promise.all([
      getTile(storage, { z: 10, x: 1, y: 0 }, { fetcher }),
      getTile(storage, { z: 10, x: 2, y: 0 }, { fetcher }),
    ]);
    expect(r1[0]).toBe(1);
    expect(r2[0]).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('forceRefresh bypasses the cache', async () => {
    const original = new Uint8Array([1]);
    await storage.putTile({ z: 11, x: 0, y: 0 }, original);

    const fetcher = jest.fn().mockResolvedValue(new Uint8Array([2]));
    const out = await getTile(storage, { z: 11, x: 0, y: 0 }, { fetcher, forceRefresh: true });

    expect(Array.from(out)).toEqual([2]);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Cache was overwritten with the fresh value.
    const cached = await storage.getTile({ z: 11, x: 0, y: 0 });
    expect(Array.from(cached!)).toEqual([2]);
  });

  it('clears in-flight entry on fetch failure so the next call retries', async () => {
    const fetcher = jest
      .fn<Promise<Uint8Array>, [number, number, number]>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Uint8Array([99]));

    await expect(getTile(storage, { z: 10, x: 0, y: 0 }, { fetcher })).rejects.toThrow(
      'network down',
    );

    const out = await getTile(storage, { z: 10, x: 0, y: 0 }, { fetcher });
    expect(Array.from(out)).toEqual([99]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

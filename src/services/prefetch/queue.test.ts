import type { TileCoord, TileStorage } from '../storage';

import { PrefetchQueue } from './queue';

function makeStorage(): TileStorage {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    getTile: jest.fn().mockResolvedValue(null),
    putTile: jest.fn().mockResolvedValue(undefined),
    hasTile: jest.fn().mockResolvedValue(false),
    getStats: jest.fn().mockResolvedValue({
      tileCount: 0,
      blobCount: 0,
      totalBytes: 0,
      dedupRatio: 0,
    }),
    clear: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  } as unknown as TileStorage;
}

describe('PrefetchQueue', () => {
  it('resolves enqueued coords through the resolver', async () => {
    const storage = makeStorage();
    const resolver = jest.fn().mockResolvedValue(new Uint8Array());
    const q = new PrefetchQueue({ storage, resolver, concurrency: 2 });

    q.enqueue({ z: 14, x: 0, y: 0 });
    q.enqueue({ z: 14, x: 1, y: 0 });
    q.enqueue({ z: 14, x: 2, y: 0 });
    await q.drain();

    expect(resolver).toHaveBeenCalledTimes(3);
  });

  it('dedupes identical coords still pending', async () => {
    const storage = makeStorage();
    let resolveFirst!: () => void;
    const resolver = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const q = new PrefetchQueue({ storage, resolver, concurrency: 1 });

    const coord: TileCoord = { z: 12, x: 10, y: 10 };
    q.enqueue(coord);
    q.enqueue(coord);
    q.enqueue(coord);

    expect(q.pendingCount).toBe(1);
    expect(resolver).toHaveBeenCalledTimes(1);

    resolveFirst();
    await q.drain();
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('honors the concurrency limit', async () => {
    const storage = makeStorage();
    let inFlight = 0;
    let maxInFlight = 0;
    const resolver = jest.fn(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });

    const q = new PrefetchQueue({ storage, resolver, concurrency: 3 });
    for (let i = 0; i < 10; i++) q.enqueue({ z: 14, x: i, y: 0 });
    await q.drain();

    expect(resolver).toHaveBeenCalledTimes(10);
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1); // proves we actually parallelized
  });

  it('swallows resolver failures (best-effort prefetch)', async () => {
    const storage = makeStorage();
    const resolver = jest
      .fn<Promise<void>, [TileStorage, TileCoord]>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);

    const q = new PrefetchQueue({ storage, resolver, concurrency: 1 });
    q.enqueue({ z: 10, x: 0, y: 0 });
    q.enqueue({ z: 10, x: 1, y: 0 });

    await q.drain();
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(q.pendingCount).toBe(0);
  });

  it('clear() drops queued work but lets in-flight tasks finish', async () => {
    const storage = makeStorage();
    const blockers: (() => void)[] = [];
    const resolver = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          blockers.push(resolve);
        }),
    );

    const q = new PrefetchQueue({ storage, resolver, concurrency: 2 });
    for (let i = 0; i < 6; i++) q.enqueue({ z: 12, x: i, y: 0 });

    expect(q.activeCount).toBe(2);
    expect(q.queueSize).toBe(4);

    q.clear();
    expect(q.queueSize).toBe(0);
    expect(q.activeCount).toBe(2); // in-flight not cancelled

    blockers.forEach((b) => b());
    await q.drain();
  });
});

import type { TileCoord, TileStorage } from '../storage';
import { getTile } from '../tiles';

/**
 * Concurrency-limited FIFO queue for predictive tile prefetching.
 *
 * Calls go through the cache-first orchestrator (`getTile`), so:
 *   - cache hits are essentially free,
 *   - in-flight requests for the same coord coalesce with foreground fetches,
 *   - blob-level dedup still happens at the storage layer.
 *
 * Prefetch is best-effort: failures are swallowed so a single bad tile
 * doesn't poison the queue or surface as a user-visible error.
 */

export interface PrefetchQueueOptions {
  storage: TileStorage;
  /** Maximum parallel `getTile` calls. Default 4. */
  concurrency?: number;
  /** Override the resolver — used by tests. */
  resolver?: (storage: TileStorage, coord: TileCoord) => Promise<unknown>;
}

const DEFAULT_CONCURRENCY = 4;

export class PrefetchQueue {
  private readonly storage: TileStorage;
  private readonly concurrency: number;
  private readonly resolver: (storage: TileStorage, coord: TileCoord) => Promise<unknown>;

  private readonly pending = new Set<string>();
  private readonly queue: TileCoord[] = [];
  private active = 0;

  constructor(opts: PrefetchQueueOptions) {
    this.storage = opts.storage;
    this.concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
    this.resolver = opts.resolver ?? ((s, c) => getTile(s, c));
  }

  enqueue(coord: TileCoord): void {
    const k = key(coord);
    if (this.pending.has(k)) return;
    this.pending.add(k);
    this.queue.push(coord);
    this.tick();
  }

  enqueueAll(coords: Iterable<TileCoord>): void {
    for (const c of coords) this.enqueue(c);
  }

  /** Drops queued work that hasn't started; in-flight tasks finish. */
  clear(): void {
    for (const c of this.queue) this.pending.delete(key(c));
    this.queue.length = 0;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  get queueSize(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.active;
  }

  /** Resolves once the queue (and all in-flight tasks) is empty. */
  async drain(): Promise<void> {
    if (this.pending.size === 0) return;
    await new Promise<void>((resolve) => {
      const check = () => {
        if (this.pending.size === 0) resolve();
        else setTimeout(check, 25);
      };
      check();
    });
  }

  private tick(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const coord = this.queue.shift()!;
      this.active++;
      void this.run(coord);
    }
  }

  private async run(coord: TileCoord): Promise<void> {
    const k = key(coord);
    try {
      await this.resolver(this.storage, coord);
    } catch {
      // best-effort
    } finally {
      this.pending.delete(k);
      this.active--;
      this.tick();
    }
  }
}

function key(coord: TileCoord): string {
  return `${coord.z}/${coord.x}/${coord.y}`;
}

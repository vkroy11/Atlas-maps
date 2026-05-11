import { useEffect, useRef } from 'react';

import { predictNeighbors, PrefetchQueue } from '../services/prefetch';
import type { PrefetchSettings } from '../services/prefetch';
import type { TileCoord, TileStorage } from '../services/storage';

const DEBOUNCE_MS = 500;

/**
 * Drives predictive prefetching off the map's reported tile center.
 *
 *   center change → debounce → predictNeighbors → enqueueAll
 *
 * The queue lives for the lifetime of the storage instance; pending work is
 * cleared on each new center so we don't waste bandwidth on stale predictions
 * after a fast pan.
 */
export function usePrefetch(
  storage: TileStorage | null,
  center: TileCoord | null,
  settings: PrefetchSettings,
): void {
  const queueRef = useRef<PrefetchQueue | null>(null);

  useEffect(() => {
    if (!storage) {
      queueRef.current = null;
      return;
    }
    queueRef.current = new PrefetchQueue({ storage, concurrency: settings.concurrency });
    return () => {
      queueRef.current?.clear();
      queueRef.current = null;
    };
  }, [storage, settings.concurrency]);

  useEffect(() => {
    if (!queueRef.current || !center || !settings.enabled) return;

    const timer = setTimeout(() => {
      const queue = queueRef.current;
      if (!queue) return;
      queue.clear(); // drop predictions from prior center
      const neighbors = predictNeighbors(center, { radius: settings.radius });
      queue.enqueueAll(neighbors);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [center, settings.enabled, settings.radius]);
}

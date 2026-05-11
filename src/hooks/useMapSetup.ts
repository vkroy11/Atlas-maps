import { useEffect, useRef, useState } from 'react';

import type { MinimalStyleSpec } from '../map/loadStyle';
import { loadOfflineStyle } from '../map/loadStyle';
import type { ProtocolHandle } from '../protocols';
import { registerProtocol } from '../protocols';
import type { TileStorage } from '../services/storage';
import { createTileStorage } from '../services/storage';

export type MapSetupState =
  | { status: 'loading' }
  | { status: 'ready'; style: MinimalStyleSpec; storage: TileStorage }
  | { status: 'error'; error: Error };

/**
 * Mount-time setup for the map screen:
 *   1. Open the platform-appropriate `TileStorage`.
 *   2. Register the offline protocol (web `addProtocol` or native HTTP server).
 *   3. Fetch the MapTiler style and rewrite tile sources to go through (2).
 *
 * Cleans everything up on unmount. Re-running is intentionally not supported —
 * the map screen is mounted once per app session.
 */
export function useMapSetup(): MapSetupState {
  const [state, setState] = useState<MapSetupState>({ status: 'loading' });
  const teardownRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let storage: TileStorage | null = null;
    let handle: ProtocolHandle | null = null;

    (async () => {
      try {
        storage = await createTileStorage();
        handle = await registerProtocol(storage);
        const style = await loadOfflineStyle(handle.tileTemplate);
        if (cancelled) return;
        setState({ status: 'ready', style, storage });
      } catch (err) {
        if (!cancelled) {
          setState({ status: 'error', error: err instanceof Error ? err : new Error(String(err)) });
        }
      }
    })();

    teardownRef.current = async () => {
      if (handle) await handle.stop().catch(() => undefined);
      if (storage) await storage.close().catch(() => undefined);
    };

    return () => {
      cancelled = true;
      void teardownRef.current?.();
    };
    // Intentionally run only once — re-running would tear down the live map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

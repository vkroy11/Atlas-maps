import { useEffect, useRef, useState } from 'react';

import type { MinimalStyleSpec } from '../map/loadStyle';
import { loadOfflineStyle } from '../map/loadStyle';
import type { ProtocolHandle } from '../protocols';
import { registerProtocol } from '../protocols';
import type { TileStorage } from '../services/storage';
import { getSharedStorage } from '../services/storage';

export type MapSetupState =
  | { status: 'loading' }
  | { status: 'ready'; style: MinimalStyleSpec; storage: TileStorage }
  | { status: 'error'; error: Error };

/**
 * Mount-time setup for the map screen:
 *   1. Acquire the shared `TileStorage` (open once per app lifetime).
 *   2. Register the offline protocol (web `addProtocol` or native HTTP server).
 *   3. Fetch the MapTiler style and rewrite tile sources to go through (2).
 *
 * Tears down the protocol handle on unmount, but leaves storage open so other
 * screens (Stats, Settings) can read from it without reopening the DB.
 */
export function useMapSetup(): MapSetupState {
  const [state, setState] = useState<MapSetupState>({ status: 'loading' });
  const teardownRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let handle: ProtocolHandle | null = null;

    (async () => {
      try {
        const storage = await getSharedStorage();
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
    };

    return () => {
      cancelled = true;
      void teardownRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

import type { TileStorage } from '../services/storage';

import { OFFLINE_TILE_TEMPLATE, registerOfflineProtocol } from './webProtocol';

/**
 * Default (web + Jest) implementation of the cross-platform protocol contract.
 * Native devices use `register.native.ts` instead.
 */

export interface ProtocolHandle {
  /** URL template to use in MapLibre style sources. */
  tileTemplate: string;
  /** Tear down — remove protocol handler / shut down server. */
  stop: () => Promise<void>;
}

export async function registerProtocol(storage: TileStorage): Promise<ProtocolHandle> {
  const cleanup = registerOfflineProtocol(storage);
  return {
    tileTemplate: OFFLINE_TILE_TEMPLATE,
    stop: async () => cleanup(),
  };
}

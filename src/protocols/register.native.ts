import type { TileStorage } from '../services/storage';

import { startTileServer } from './nativeServer';

import type { ProtocolHandle } from './register';

export async function registerProtocol(storage: TileStorage): Promise<ProtocolHandle> {
  const server = await startTileServer(storage);
  return {
    tileTemplate: server.tileTemplate,
    stop: server.stop,
  };
}

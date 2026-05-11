import 'fake-indexeddb/auto';

import { createTileStorage } from '../services/storage';
import { __resetInFlight } from '../services/tiles/getTile';

import { parseOfflineUrl, resolveOfflineTile } from './webProtocol';

describe('parseOfflineUrl', () => {
  it('parses well-formed URLs', () => {
    expect(parseOfflineUrl('offline://14/11705/6831.pbf')).toEqual({
      z: 14,
      x: 11705,
      y: 6831,
    });
    expect(parseOfflineUrl('offline://0/0/0.pbf')).toEqual({ z: 0, x: 0, y: 0 });
  });

  it('rejects malformed URLs', () => {
    expect(parseOfflineUrl('offline://14/11705/6831')).toBeNull(); // missing .pbf
    expect(parseOfflineUrl('https://example.com/14/0/0.pbf')).toBeNull(); // wrong scheme
    expect(parseOfflineUrl('offline://abc/0/0.pbf')).toBeNull(); // non-numeric
    expect(parseOfflineUrl('offline://14/0/0.pbf?key=x')).toBeNull(); // query string
  });
});

describe('resolveOfflineTile', () => {
  beforeEach(() => {
    __resetInFlight();
  });

  it('returns the tile bytes when the cache holds the coord', async () => {
    const storage = await createTileStorage();
    await storage.clear();
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    await storage.putTile({ z: 12, x: 1, y: 2 }, payload);

    const buf = await resolveOfflineTile(storage, 'offline://12/1/2.pbf');
    expect(new Uint8Array(buf)).toEqual(payload);

    await storage.close();
  });

  it('throws on a malformed URL', async () => {
    const storage = await createTileStorage();
    await expect(resolveOfflineTile(storage, 'not-a-real-url')).rejects.toThrow(
      'Invalid offline:// URL',
    );
    await storage.close();
  });
});

import { loadOfflineStyle, rewriteTileSources, type MinimalStyleSpec } from './loadStyle';

describe('rewriteTileSources', () => {
  it('replaces TileJSON url with explicit tiles array on vector sources', () => {
    const style: MinimalStyleSpec = {
      sources: {
        openmaptiles: {
          type: 'vector',
          url: 'https://api.maptiler.com/tiles/v3/tiles.json?key=abc',
        },
      },
    };

    rewriteTileSources(style, 'offline://{z}/{x}/{y}.pbf');

    expect(style.sources!.openmaptiles).toEqual({
      type: 'vector',
      tiles: ['offline://{z}/{x}/{y}.pbf'],
      minzoom: 0,
      maxzoom: 14,
    });
  });

  it('also rewrites raster sources', () => {
    const style: MinimalStyleSpec = {
      sources: {
        sat: { type: 'raster', url: 'https://example/satellite.json' },
      },
    };

    rewriteTileSources(style, 'http://127.0.0.1:5500/tiles/{z}/{x}/{y}.pbf');

    expect(style.sources!.sat.tiles).toEqual(['http://127.0.0.1:5500/tiles/{z}/{x}/{y}.pbf']);
    expect(style.sources!.sat.url).toBeUndefined();
  });

  it('preserves existing minzoom / maxzoom', () => {
    const style: MinimalStyleSpec = {
      sources: {
        v: { type: 'vector', url: 'https://x', minzoom: 5, maxzoom: 18 },
      },
    };

    rewriteTileSources(style, 't');

    expect(style.sources!.v.minzoom).toBe(5);
    expect(style.sources!.v.maxzoom).toBe(18);
  });

  it('leaves geojson / shape sources alone', () => {
    const style: MinimalStyleSpec = {
      sources: {
        labels: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as unknown },
      },
    };

    rewriteTileSources(style, 't');

    expect(style.sources!.labels).toEqual({
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  });

  it('is a no-op when sources is missing', () => {
    const style: MinimalStyleSpec = {};
    rewriteTileSources(style, 't');
    expect(style).toEqual({});
  });
});

describe('loadOfflineStyle', () => {
  it('fetches the style URL and rewrites tile sources', async () => {
    const remoteStyle: MinimalStyleSpec = {
      version: 8,
      sources: {
        openmaptiles: { type: 'vector', url: 'https://api.maptiler.com/.../tiles.json' },
      },
      layers: [],
    } as MinimalStyleSpec;

    const fetcher = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(remoteStyle), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const style = await loadOfflineStyle('offline://{z}/{x}/{y}.pbf', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0] as string).toContain('api.maptiler.com/maps');
    expect(style.sources!.openmaptiles.tiles).toEqual(['offline://{z}/{x}/{y}.pbf']);
    expect(style.sources!.openmaptiles.url).toBeUndefined();
  });

  it('throws a clear error on non-2xx', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(new Response('', { status: 403, statusText: 'Forbidden' }));

    await expect(loadOfflineStyle('t', fetcher)).rejects.toThrow('HTTP 403');
  });
});

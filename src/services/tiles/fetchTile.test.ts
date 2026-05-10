import { fetchTile, TileFetchError, TileNotFoundError } from './fetchTile';

const buildUrl = (z: number, x: number, y: number) => `https://test/tiles/${z}/${x}/${y}.pbf`;

function mockResponse(body: Uint8Array, status = 200): Response {
  // Copy into a fresh ArrayBuffer so TS sees a non-shared, BodyInit-compatible
  // buffer regardless of the source view's underlying type.
  const buf = new ArrayBuffer(body.byteLength);
  new Uint8Array(buf).set(body);
  return new Response(buf, { status });
}

describe('fetchTile', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns the tile bytes on 200', async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    fetchSpy.mockResolvedValueOnce(mockResponse(payload));

    const out = await fetchTile(14, 11705, 6831, { buildUrl, retries: 0 });
    expect(Array.from(out)).toEqual([1, 2, 3, 4]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('https://test/tiles/14/11705/6831.pbf');
  });

  it('throws TileNotFoundError on 404 without retrying', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(new Uint8Array(), 404));

    await expect(fetchTile(14, 0, 0, { buildUrl, retries: 3 })).rejects.toBeInstanceOf(
      TileNotFoundError,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 then succeeds', async () => {
    const payload = new Uint8Array([9, 9]);
    fetchSpy
      .mockResolvedValueOnce(mockResponse(new Uint8Array(), 429))
      .mockResolvedValueOnce(mockResponse(payload));

    const out = await fetchTile(12, 0, 0, { buildUrl, retries: 2 });
    expect(Array.from(out)).toEqual([9, 9]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx then surfaces TileFetchError after exhausting retries', async () => {
    fetchSpy.mockResolvedValue(mockResponse(new Uint8Array(), 503));

    await expect(fetchTile(12, 0, 0, { buildUrl, retries: 2 })).rejects.toBeInstanceOf(
      TileFetchError,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('throws TileFetchError on a non-retryable 4xx', async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(new Uint8Array(), 401));

    await expect(fetchTile(12, 0, 0, { buildUrl, retries: 3 })).rejects.toMatchObject({
      name: 'TileFetchError',
      status: 401,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('aborts when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('caller-cancelled'));

    await expect(
      fetchTile(12, 0, 0, { buildUrl, retries: 0, signal: controller.signal }),
    ).rejects.toThrow('caller-cancelled');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

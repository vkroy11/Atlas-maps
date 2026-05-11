/**
 * Pure-logic tests for the native tile server.
 *
 * The full TCP server can only run on a real device — these tests cover the
 * request parser and the HTTP response builders, which are the parts that
 * could silently break the wire format.
 */
import { buildStatusResponse, buildTileResponseHeader, parseTileRequest } from './nativeServer';

describe('parseTileRequest', () => {
  it('parses well-formed GET lines', () => {
    expect(parseTileRequest('GET /tiles/14/11705/6831.pbf HTTP/1.1')).toEqual({
      z: 14,
      x: 11705,
      y: 6831,
    });
    expect(parseTileRequest('GET /tiles/0/0/0.pbf HTTP/1.1')).toEqual({ z: 0, x: 0, y: 0 });
  });

  it('rejects non-GET methods', () => {
    expect(parseTileRequest('POST /tiles/14/0/0.pbf HTTP/1.1')).toBeNull();
    expect(parseTileRequest('OPTIONS /tiles/14/0/0.pbf HTTP/1.1')).toBeNull();
  });

  it('rejects unknown paths', () => {
    expect(parseTileRequest('GET /style.json HTTP/1.1')).toBeNull();
    expect(parseTileRequest('GET /tiles/14/0/0 HTTP/1.1')).toBeNull(); // missing .pbf
  });

  it('rejects non-numeric coords', () => {
    expect(parseTileRequest('GET /tiles/abc/0/0.pbf HTTP/1.1')).toBeNull();
  });

  it('accepts query strings on the path', () => {
    expect(parseTileRequest('GET /tiles/14/100/200.pbf?nocache=1 HTTP/1.1')).toEqual({
      z: 14,
      x: 100,
      y: 200,
    });
  });
});

describe('buildTileResponseHeader', () => {
  it('embeds the byte length and serves raw PBF (no Content-Encoding)', () => {
    const headers = buildTileResponseHeader(12345);
    expect(headers).toContain('HTTP/1.1 200 OK');
    expect(headers).toContain('Content-Type: application/x-protobuf');
    expect(headers).toContain('Content-Length: 12345');
    expect(headers).toContain('Connection: close');
    // RN fetch transparently decompresses gzip — what we cache & serve is raw
    // PBF, and advertising gzip would make MapLibre fail decompression.
    expect(headers).not.toContain('Content-Encoding');
    expect(headers.endsWith('\r\n\r\n')).toBe(true);
  });
});

describe('buildStatusResponse', () => {
  it('builds a complete 404 response with body', () => {
    const buf = buildStatusResponse(404, 'Not Found');
    const text = buf.toString('utf-8');
    expect(text).toMatch(/^HTTP\/1\.1 404 Not Found\r\n/);
    expect(text).toContain('Content-Type: text/plain');
    expect(text).toContain('Content-Length: ');
    expect(text).toMatch(/\r\n\r\n404 Not Found\n$/);
  });

  it('byte length matches Content-Length header', () => {
    const buf = buildStatusResponse(500, 'Internal Server Error');
    const text = buf.toString('utf-8');
    const m = /Content-Length: (\d+)/.exec(text);
    expect(m).not.toBeNull();
    const declared = Number(m![1]);
    const bodyStart = text.indexOf('\r\n\r\n') + 4;
    const actualBodyLen = Buffer.from(text.slice(bodyStart), 'utf-8').length;
    expect(actualBodyLen).toBe(declared);
  });
});

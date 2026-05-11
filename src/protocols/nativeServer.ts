import { Buffer } from 'buffer';
import TcpSocket from 'react-native-tcp-socket';

import type { TileStorage } from '../services/storage';
import { getTile, TileNotFoundError } from '../services/tiles';

/**
 * Local HTTP tile server for native (iOS / Android).
 *
 * MapLibre React Native doesn't expose `addProtocol` like maplibre-gl JS does,
 * so we run a tiny TCP-based HTTP server bound to `127.0.0.1:<random>` and
 * point the map style's tile sources at it. Each request goes through the
 * same cache-first orchestrator the web protocol uses.
 *
 * Wire format:
 *   GET /tiles/{z}/{x}/{y}.pbf  →  200 with PBF bytes (gzipped, as MapTiler
 *                                  delivers them — Content-Encoding: gzip)
 *                                  404 if MapTiler had no tile for the coord
 *                                  500 on storage / network failure
 */

export interface NativeTileServer {
  /** e.g. `http://127.0.0.1:54321` */
  url: string;
  /** e.g. `http://127.0.0.1:54321/tiles/{z}/{x}/{y}.pbf` */
  tileTemplate: string;
  port: number;
  stop: () => Promise<void>;
}

const MAX_REQUEST_BYTES = 8 * 1024;

export async function startTileServer(storage: TileStorage): Promise<NativeTileServer> {
  return new Promise((resolve, reject) => {
    const server = TcpSocket.createServer((socket) => {
      attachConnection(socket, storage);
    });

    server.on('error', (err) => {
      reject(err);
    });

    server.listen({ port: 0, host: '127.0.0.1' }, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Tile server failed to bind'));
        return;
      }
      const port = addr.port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        tileTemplate: `http://127.0.0.1:${port}/tiles/{z}/{x}/{y}.pbf`,
        port,
        stop: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

interface SocketLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: 'data' | 'error' | 'close', cb: (...args: any[]) => void): unknown;
  write(data: Buffer | Uint8Array | string): unknown;
  end(): unknown;
  destroy(): unknown;
}

function attachConnection(socket: SocketLike, storage: TileStorage): void {
  let buffered: Buffer = Buffer.alloc(0);
  let handled = false;

  const onData = (chunk: Buffer | string) => {
    if (handled) return;
    const part = typeof chunk === 'string' ? Buffer.from(chunk, 'latin1') : chunk;
    buffered = Buffer.concat([buffered, part]);

    if (buffered.length > MAX_REQUEST_BYTES) {
      handled = true;
      writeStatus(socket, 413, 'Payload Too Large');
      return;
    }

    const headerEnd = buffered.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    handled = true;
    const requestLine = buffered.slice(0, headerEnd).toString('latin1').split('\r\n')[0] ?? '';
    void handleRequest(socket, requestLine, storage);
  };

  socket.on('data', onData);
  socket.on('error', () => {
    handled = true;
    socket.destroy();
  });
}

const TILE_PATH_RE = /^GET\s+\/tiles\/(\d+)\/(\d+)\/(\d+)\.pbf(?:\s|\?|$)/;

export function parseTileRequest(requestLine: string): { z: number; x: number; y: number } | null {
  const m = TILE_PATH_RE.exec(requestLine);
  if (!m) return null;
  return { z: Number(m[1]), x: Number(m[2]), y: Number(m[3]) };
}

async function handleRequest(
  socket: SocketLike,
  requestLine: string,
  storage: TileStorage,
): Promise<void> {
  const coord = parseTileRequest(requestLine);
  if (!coord) {
    writeStatus(socket, 404, 'Not Found');
    return;
  }

  try {
    const data = await getTile(storage, coord);
    writeTileResponse(socket, data);
  } catch (err) {
    if (err instanceof TileNotFoundError) {
      writeStatus(socket, 404, 'Not Found');
    } else {
      // eslint-disable-next-line no-console
      console.error('[tileServer]', err);
      writeStatus(socket, 500, 'Internal Server Error');
    }
  }
}

export function buildTileResponseHeader(byteLength: number): string {
  return [
    'HTTP/1.1 200 OK',
    'Content-Type: application/x-protobuf',
    // NOTE: React Native's fetch transparently decompresses gzip responses
    // from MapTiler, so what we stored (and now serve) is already-decompressed
    // PBF bytes. We must NOT advertise Content-Encoding: gzip here —
    // MapLibre would try to gunzip raw PBF and fail with "unexpected end of stream".
    `Content-Length: ${byteLength}`,
    'Cache-Control: no-store',
    'Connection: close',
    '',
    '',
  ].join('\r\n');
}

function writeTileResponse(socket: SocketLike, data: Uint8Array): void {
  const headerBytes = Buffer.from(buildTileResponseHeader(data.byteLength), 'latin1');
  socket.write(Buffer.concat([headerBytes, Buffer.from(data)]));
  socket.end();
}

export function buildStatusResponse(status: number, statusText: string): Buffer {
  const body = Buffer.from(`${status} ${statusText}\n`, 'utf-8');
  const headers = [
    `HTTP/1.1 ${status} ${statusText}`,
    'Content-Type: text/plain; charset=utf-8',
    `Content-Length: ${body.length}`,
    'Connection: close',
    '',
    '',
  ].join('\r\n');
  return Buffer.concat([Buffer.from(headers, 'latin1'), body]);
}

function writeStatus(socket: SocketLike, status: number, statusText: string): void {
  socket.write(buildStatusResponse(status, statusText));
  socket.end();
}

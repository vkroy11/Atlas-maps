import { getTileUrl } from '../../map/style';

/**
 * Errors with a stable shape so callers (and the orchestrator) can branch on type.
 */
export class TileNotFoundError extends Error {
  constructor(
    public z: number,
    public x: number,
    public y: number,
  ) {
    super(`Tile ${z}/${x}/${y} not found (404)`);
    this.name = 'TileNotFoundError';
  }
}

export class TileFetchError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'TileFetchError';
  }
}

export interface FetchTileOptions {
  signal?: AbortSignal;
  /** Total attempts = retries + 1. Default 2 (so up to 3 attempts). */
  retries?: number;
  /** Per-attempt timeout. Default 10s. */
  timeoutMs?: number;
  /** Override URL builder — useful for tests. */
  buildUrl?: (z: number, x: number, y: number) => string;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetch a single PBF tile from MapTiler with retries, per-attempt timeout, and
 * exponential backoff on transient failures.
 *
 * Surfaces `TileNotFoundError` for 404 (out-of-bounds tiles MapTiler doesn't
 * serve) and `TileFetchError` for everything else after retries exhaust.
 */
export async function fetchTile(
  z: number,
  x: number,
  y: number,
  opts: FetchTileOptions = {},
): Promise<Uint8Array> {
  const {
    signal,
    retries = DEFAULT_RETRIES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    buildUrl = getTileUrl,
  } = opts;

  const url = buildUrl(z, x, y);
  const totalAttempts = retries + 1;

  let lastError: unknown;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    if (signal?.aborted) throw signal.reason ?? new Error('Aborted');

    const timeoutCtl = new AbortController();
    const timeoutId = setTimeout(() => timeoutCtl.abort(), timeoutMs);
    const composed = signal ? anySignal([signal, timeoutCtl.signal]) : timeoutCtl.signal;

    try {
      const res = await fetch(url, { signal: composed });

      if (res.status === 404) {
        throw new TileNotFoundError(z, x, y);
      }
      if (res.status === 429 || res.status >= 500) {
        // Transient — retry with backoff.
        lastError = new TileFetchError(`HTTP ${res.status}`, res.status);
        await backoff(attempt, totalAttempts, signal);
        continue;
      }
      if (!res.ok) {
        // Non-retryable client error (401, 403, 400, etc.) — fail fast.
        throw new TileFetchError(`HTTP ${res.status}`, res.status);
      }

      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } catch (err) {
      // Deliberate, non-retryable errors short-circuit the retry loop.
      if (err instanceof TileNotFoundError) throw err;
      if (err instanceof TileFetchError) throw err;
      if (signal?.aborted) throw err;
      // Network errors / aborted-by-timeout → retry if budget remains.
      lastError = err;
      if (attempt < totalAttempts - 1) {
        await backoff(attempt, totalAttempts, signal);
        continue;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new TileFetchError('fetchTile exhausted retries');
}

async function backoff(attempt: number, total: number, signal?: AbortSignal): Promise<void> {
  if (attempt >= total - 1) return;
  // 250ms, 500ms, 1000ms, capped at 4s.
  const delay = Math.min(250 * 2 ** attempt, 4000);
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, delay);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(signal.reason ?? new Error('Aborted'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Polyfill-ish AbortSignal.any — Node 20+ has it natively, RN does not yet.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof (AbortSignal as unknown as { any?: typeof AbortSignal.any }).any === 'function') {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

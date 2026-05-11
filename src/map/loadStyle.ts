import { getMapStyleUrl } from './style';

/**
 * Fetches the MapTiler style JSON and rewrites every vector/raster source so
 * its tiles flow through our protocol layer (offline:// on web, the local
 * HTTP server on native). MapLibre then never talks to MapTiler directly for
 * tiles — only for the initial style.json, sprites, and glyphs.
 *
 * The minimal type below is deliberately loose: we want to mutate sources we
 * recognize and pass everything else through untouched.
 */

export interface MinimalStyleSource {
  type?: string;
  url?: string;
  tiles?: string[];
  minzoom?: number;
  maxzoom?: number;
  [key: string]: unknown;
}

export interface MinimalStyleSpec {
  sources?: Record<string, MinimalStyleSource>;
  [key: string]: unknown;
}

const REWRITABLE_SOURCE_TYPES = new Set(['vector', 'raster', 'raster-dem']);

/**
 * Replace `url:` (TileJSON) with explicit `tiles:` pointing at our protocol,
 * mutating in place. Exposed for testing.
 */
export function rewriteTileSources(style: MinimalStyleSpec, tileTemplate: string): void {
  if (!style.sources) return;
  for (const id of Object.keys(style.sources)) {
    const src = style.sources[id];
    if (!src.type || !REWRITABLE_SOURCE_TYPES.has(src.type)) continue;
    src.tiles = [tileTemplate];
    delete src.url;
    src.minzoom = src.minzoom ?? 0;
    src.maxzoom = src.maxzoom ?? 14;
  }
}

export async function loadOfflineStyle(
  tileTemplate: string,
  fetcher: typeof fetch = fetch,
): Promise<MinimalStyleSpec> {
  const styleUrl = getMapStyleUrl();
  const res = await fetcher(styleUrl);
  if (!res.ok) {
    throw new Error(`Failed to load MapTiler style (HTTP ${res.status})`);
  }
  const style = (await res.json()) as MinimalStyleSpec;
  rewriteTileSources(style, tileTemplate);
  return style;
}

import Constants from 'expo-constants';

const STYLE_ID = 'streets-v2';

/**
 * MapTiler vector tile + style URL builders.
 *
 * The key flows: `.env` → `app.config.ts` (`extra.maptilerKey`) → `Constants.expoConfig`.
 * We read it lazily so a missing key surfaces the moment something tries to fetch,
 * not at module load.
 */

export function getMaptilerKey(): string {
  const extra = Constants.expoConfig?.extra as { maptilerKey?: string } | undefined;
  const key = extra?.maptilerKey;
  if (!key) {
    throw new Error(
      'MAPTILER_KEY is not set. Copy `.env.example` to `.env` and add your key from https://cloud.maptiler.com/account/keys/',
    );
  }
  return key;
}

export function buildTileUrl(z: number, x: number, y: number, key: string): string {
  return `https://api.maptiler.com/tiles/v3/${z}/${x}/${y}.pbf?key=${encodeURIComponent(key)}`;
}

export function buildStyleUrl(key: string): string {
  return `https://api.maptiler.com/maps/${STYLE_ID}/style.json?key=${encodeURIComponent(key)}`;
}

/** Convenience — uses the runtime key. */
export function getTileUrl(z: number, x: number, y: number): string {
  return buildTileUrl(z, x, y, getMaptilerKey());
}

export function getMapStyleUrl(): string {
  return buildStyleUrl(getMaptilerKey());
}

/**
 * Slippy-map tile math (XYZ scheme) and Delhi NCR bounds for the MVP.
 *
 *   x = floor( (lon + 180) / 360 * 2^z )
 *   y = floor( (1 - ln(tan(lat) + sec(lat)) / pi) / 2 * 2^z )
 *
 * Reference: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */

export type LonLat = { lon: number; lat: number };

export type BBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

/** PRD §8 — Delhi NCR coverage area for the MVP. */
export const DELHI_NCR_BOUNDS: BBox = {
  minLat: 28.4,
  maxLat: 28.9,
  minLon: 76.8,
  maxLon: 77.4,
};

/** PRD §9 — supported zoom range for the MVP. */
export const ZOOM_RANGE = { min: 10, max: 16 } as const;

export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tileToBBox(z: number, x: number, y: number): BBox {
  const n = 2 ** z;
  return {
    minLon: (x / n) * 360 - 180,
    maxLon: ((x + 1) / n) * 360 - 180,
    maxLat: tileYToLat(y, z),
    minLat: tileYToLat(y + 1, z),
  };
}

/** True when the tile's bbox intersects `bounds` at all. */
export function tileIntersects(
  z: number,
  x: number,
  y: number,
  bounds: BBox = DELHI_NCR_BOUNDS,
): boolean {
  const tile = tileToBBox(z, x, y);
  return (
    tile.maxLat >= bounds.minLat &&
    tile.minLat <= bounds.maxLat &&
    tile.maxLon >= bounds.minLon &&
    tile.minLon <= bounds.maxLon
  );
}

/** True iff the tile is in-zoom AND intersects Delhi NCR. */
export function isWithinDelhi(z: number, x: number, y: number): boolean {
  if (z < ZOOM_RANGE.min || z > ZOOM_RANGE.max) return false;
  const max = 2 ** z;
  if (x < 0 || x >= max || y < 0 || y >= max) return false;
  return tileIntersects(z, x, y, DELHI_NCR_BOUNDS);
}

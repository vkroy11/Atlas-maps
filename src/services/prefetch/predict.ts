import type { TileCoord } from '../storage';
import { isWithinDelhi, ZOOM_RANGE } from '../../utils/tileMath';

export interface PredictOptions {
  /** Radius of the neighbor ring at the current zoom. 1 = 3×3 (default). */
  radius?: number;
  /** Include 4 children at z+1 (default true). */
  includeChildren?: boolean;
  /** Include 1 parent at z-1 (default true). */
  includeParent?: boolean;
  /** Bounds filter — defaults to Delhi NCR. */
  filter?: (coord: TileCoord) => boolean;
}

const DEFAULT_RADIUS = 1;

/**
 * Given the user's current tile, returns the set of tiles likely needed next.
 *
 * Strategy (PRD §14):
 *   - (2*radius+1)² same-zoom neighbors, center excluded.
 *   - 4 children at z+1 (the tiles you see when zooming in).
 *   - 1 parent  at z-1 (the tile you see when zooming out).
 *
 * Default filter rejects anything outside Delhi NCR and outside the MVP zoom
 * range, so the queue never wastes a request on a tile MapTiler doesn't have.
 */
export function predictNeighbors(center: TileCoord, options: PredictOptions = {}): TileCoord[] {
  const radius = options.radius ?? DEFAULT_RADIUS;
  const includeChildren = options.includeChildren ?? true;
  const includeParent = options.includeParent ?? true;
  const filter = options.filter ?? defaultFilter;

  const out: TileCoord[] = [];

  // Same-zoom ring (skip the center — it's already loaded by the foreground fetch).
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      out.push({ z: center.z, x: center.x + dx, y: center.y + dy });
    }
  }

  // Zoom-in: 4 children.
  if (includeChildren && center.z + 1 <= ZOOM_RANGE.max) {
    const cx = center.x * 2;
    const cy = center.y * 2;
    out.push({ z: center.z + 1, x: cx, y: cy });
    out.push({ z: center.z + 1, x: cx + 1, y: cy });
    out.push({ z: center.z + 1, x: cx, y: cy + 1 });
    out.push({ z: center.z + 1, x: cx + 1, y: cy + 1 });
  }

  // Zoom-out: 1 parent.
  if (includeParent && center.z - 1 >= ZOOM_RANGE.min) {
    out.push({
      z: center.z - 1,
      x: Math.floor(center.x / 2),
      y: Math.floor(center.y / 2),
    });
  }

  return out.filter(filter);
}

function defaultFilter(coord: TileCoord): boolean {
  return isWithinDelhi(coord.z, coord.x, coord.y);
}

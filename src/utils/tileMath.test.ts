import {
  DELHI_NCR_BOUNDS,
  ZOOM_RANGE,
  isWithinDelhi,
  lonLatToTile,
  tileIntersects,
  tileToBBox,
} from './tileMath';

describe('lonLatToTile', () => {
  it('returns (0,0) for the world origin at z=0', () => {
    expect(lonLatToTile(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('places New Delhi (28.6139, 77.2090) at z=14 inside the Delhi bounds tile range', () => {
    const t = lonLatToTile(77.209, 28.6139, 14);
    // Hand-computed reference: ~(11705, 6831) for z=14.
    expect(t.x).toBeGreaterThanOrEqual(11700);
    expect(t.x).toBeLessThanOrEqual(11710);
    expect(t.y).toBeGreaterThanOrEqual(6826);
    expect(t.y).toBeLessThanOrEqual(6836);
  });

  it('round-trips: tileToBBox(lonLatToTile(p, z), z) contains p', () => {
    const points = [
      { lon: 77.209, lat: 28.6139 }, // New Delhi
      { lon: 76.85, lat: 28.45 }, // SW corner of Delhi NCR
      { lon: 77.35, lat: 28.85 }, // NE corner
    ];
    for (const p of points) {
      for (let z = ZOOM_RANGE.min; z <= ZOOM_RANGE.max; z++) {
        const { x, y } = lonLatToTile(p.lon, p.lat, z);
        const bbox = tileToBBox(z, x, y);
        expect(p.lon).toBeGreaterThanOrEqual(bbox.minLon);
        expect(p.lon).toBeLessThanOrEqual(bbox.maxLon);
        expect(p.lat).toBeGreaterThanOrEqual(bbox.minLat);
        expect(p.lat).toBeLessThanOrEqual(bbox.maxLat);
      }
    }
  });
});

describe('tileToBBox', () => {
  it('produces the canonical world bbox at z=0', () => {
    const bb = tileToBBox(0, 0, 0);
    expect(bb.minLon).toBeCloseTo(-180, 5);
    expect(bb.maxLon).toBeCloseTo(180, 5);
    // Web Mercator latitude bounds ~ ±85.05113
    expect(bb.minLat).toBeCloseTo(-85.0511, 3);
    expect(bb.maxLat).toBeCloseTo(85.0511, 3);
  });
});

describe('tileIntersects / isWithinDelhi', () => {
  it('marks the Delhi center tile at z=14 as in-bounds', () => {
    const { x, y } = lonLatToTile(77.209, 28.6139, 14);
    expect(tileIntersects(14, x, y, DELHI_NCR_BOUNDS)).toBe(true);
    expect(isWithinDelhi(14, x, y)).toBe(true);
  });

  it('rejects a tile far outside Delhi (e.g. London)', () => {
    const { x, y } = lonLatToTile(-0.1276, 51.5074, 14); // London
    expect(tileIntersects(14, x, y, DELHI_NCR_BOUNDS)).toBe(false);
    expect(isWithinDelhi(14, x, y)).toBe(false);
  });

  it('rejects out-of-zoom-range coords', () => {
    const { x, y } = lonLatToTile(77.209, 28.6139, 9);
    expect(isWithinDelhi(9, x, y)).toBe(false);
    const { x: x17, y: y17 } = lonLatToTile(77.209, 28.6139, 17);
    expect(isWithinDelhi(17, x17, y17)).toBe(false);
  });

  it('rejects coords outside the 2^z grid', () => {
    expect(isWithinDelhi(10, -1, 0)).toBe(false);
    expect(isWithinDelhi(10, 1024, 0)).toBe(false);
  });
});

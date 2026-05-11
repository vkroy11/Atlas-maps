import { lonLatToTile } from '../../utils/tileMath';

import { predictNeighbors } from './predict';

const DELHI_CENTER_Z14 = ((): { z: number; x: number; y: number } => {
  const { x, y } = lonLatToTile(77.209, 28.6139, 14);
  return { z: 14, x, y };
})();

describe('predictNeighbors', () => {
  it('returns 8 ring + 4 children + 1 parent = 13 tiles at z=14 inside Delhi', () => {
    const out = predictNeighbors(DELHI_CENTER_Z14, { radius: 1 });
    expect(out).toHaveLength(13);

    // Same-zoom ring excludes the center itself.
    const sameZoom = out.filter((c) => c.z === DELHI_CENTER_Z14.z);
    expect(sameZoom).toHaveLength(8);
    expect(sameZoom).not.toContainEqual(DELHI_CENTER_Z14);

    const children = out.filter((c) => c.z === DELHI_CENTER_Z14.z + 1);
    expect(children).toHaveLength(4);

    const parent = out.filter((c) => c.z === DELHI_CENTER_Z14.z - 1);
    expect(parent).toHaveLength(1);
  });

  it('radius=2 yields a 5×5 ring (24 same-zoom) + children + parent inside Delhi', () => {
    const out = predictNeighbors(DELHI_CENTER_Z14, { radius: 2 });
    const sameZoom = out.filter((c) => c.z === DELHI_CENTER_Z14.z);
    expect(sameZoom).toHaveLength(24);
  });

  it('omits z+1 children when at the max MVP zoom', () => {
    const max = { z: 16, x: DELHI_CENTER_Z14.x * 4, y: DELHI_CENTER_Z14.y * 4 };
    const out = predictNeighbors(max, { radius: 1 });
    expect(out.filter((c) => c.z === 17)).toHaveLength(0);
  });

  it('omits z-1 parent when at the min MVP zoom', () => {
    const min = {
      z: 10,
      x: Math.floor(DELHI_CENTER_Z14.x / 16),
      y: Math.floor(DELHI_CENTER_Z14.y / 16),
    };
    const out = predictNeighbors(min, { radius: 1 });
    expect(out.filter((c) => c.z === 9)).toHaveLength(0);
  });

  it('default filter drops tiles outside Delhi NCR', () => {
    const london = lonLatToTile(-0.1276, 51.5074, 14);
    const out = predictNeighbors({ z: 14, x: london.x, y: london.y });
    expect(out).toEqual([]);
  });

  it('respects a custom filter that lets everything through', () => {
    const out = predictNeighbors(
      { z: 14, x: 0, y: 0 },
      { radius: 1, filter: () => true, includeChildren: false, includeParent: false },
    );
    expect(out).toHaveLength(8);
  });

  it('includeChildren=false / includeParent=false trims to ring only', () => {
    const out = predictNeighbors(DELHI_CENTER_Z14, {
      includeChildren: false,
      includeParent: false,
    });
    expect(out.every((c) => c.z === DELHI_CENTER_Z14.z)).toBe(true);
    expect(out).toHaveLength(8);
  });
});

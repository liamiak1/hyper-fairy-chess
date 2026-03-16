import { describe, it, expect } from 'vitest';
import { stepInDirection } from './adjacency';

describe('stepInDirection (circular file-edge topology)', () => {
  it('steps inward (forward) inside section', () => {
    const r = stepInDirection({ section: 'white', sfile: 2, srank: 2 }, 1, 0);
    expect(r).toEqual({
      pos: { section: 'white', sfile: 2, srank: 3 },
      newDsrank: 1,
      newDsfile: 0,
    });
  });

  it('steps sideways inside section', () => {
    const r = stepInDirection({ section: 'white', sfile: 2, srank: 3 }, 0, 1);
    expect(r).toEqual({
      pos: { section: 'white', sfile: 3, srank: 3 },
      newDsrank: 0,
      newDsfile: 1,
    });
  });

  it('White sfile=8 clockwise → Black sfile=1 (same srank)', () => {
    const r = stepInDirection({ section: 'white', sfile: 8, srank: 2 }, 0, 1);
    expect(r).toEqual({
      pos: { section: 'black', sfile: 1, srank: 2 },
      newDsrank: 0,
      newDsfile: 1,
    });
  });

  it('Black sfile=8 clockwise → Red sfile=1 (same srank)', () => {
    const r = stepInDirection({ section: 'black', sfile: 8, srank: 3 }, 0, 1);
    expect(r).toEqual({
      pos: { section: 'red', sfile: 1, srank: 3 },
      newDsrank: 0,
      newDsfile: 1,
    });
  });

  it('Red sfile=8 clockwise → White sfile=1 (same srank)', () => {
    const r = stepInDirection({ section: 'red', sfile: 8, srank: 1 }, 0, 1);
    expect(r).toEqual({
      pos: { section: 'white', sfile: 1, srank: 1 },
      newDsrank: 0,
      newDsfile: 1,
    });
  });

  it('White sfile=1 counterclockwise → Red sfile=8', () => {
    const r = stepInDirection({ section: 'white', sfile: 1, srank: 2 }, 0, -1);
    expect(r).toEqual({
      pos: { section: 'red', sfile: 8, srank: 2 },
      newDsrank: 0,
      newDsfile: -1,
    });
  });

  it('Red sfile=1 counterclockwise → Black sfile=8', () => {
    const r = stepInDirection({ section: 'red', sfile: 1, srank: 1 }, 0, -1);
    expect(r).toEqual({
      pos: { section: 'black', sfile: 8, srank: 1 },
      newDsrank: 0,
      newDsfile: -1,
    });
  });

  it('direction is NOT negated when crossing file boundary', () => {
    const r = stepInDirection({ section: 'white', sfile: 8, srank: 3 }, 0, 1);
    expect(r!.newDsrank).toBe(0);
    expect(r!.newDsfile).toBe(1); // unchanged
  });

  it('diagonal across file boundary preserves both direction components', () => {
    const r = stepInDirection({ section: 'white', sfile: 8, srank: 3 }, 1, 1);
    expect(r).toEqual({
      pos: { section: 'black', sfile: 1, srank: 4 },
      newDsrank: 1,
      newDsfile: 1,
    });
  });

  it('returns null when stepping off inner edge (srank > 4)', () => {
    expect(stepInDirection({ section: 'white', sfile: 2, srank: 4 }, 1, 0)).toBeNull();
  });

  it('returns null when stepping off outer edge (srank < 1)', () => {
    expect(stepInDirection({ section: 'white', sfile: 2, srank: 1 }, -1, 0)).toBeNull();
  });

  it('full clockwise traversal stays on the ring', () => {
    // Start at white(1,2), step clockwise 24 times → back to start
    let pos: ThreePos = { section: 'white', sfile: 1, srank: 2 };
    for (let i = 0; i < 24; i++) {
      const r = stepInDirection(pos, 0, 1);
      expect(r).not.toBeNull();
      pos = r!.pos;
    }
    expect(pos).toEqual({ section: 'white', sfile: 1, srank: 2 });
  });
});

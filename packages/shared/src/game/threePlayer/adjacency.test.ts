import { describe, it, expect } from 'vitest';
import { seamNeighbor, stepInDirection, isSeamSquare } from './adjacency';

describe('seamNeighbor', () => {
  it('W(1,8) ↔ R(4,8)', () => {
    const r = seamNeighbor({ section: 'white', sfile: 1, srank: 8 });
    expect(r).toEqual({ section: 'red', sfile: 4, srank: 8 });
  });
  it('W(4,8) ↔ R(1,8)', () => {
    const r = seamNeighbor({ section: 'white', sfile: 4, srank: 8 });
    expect(r).toEqual({ section: 'red', sfile: 1, srank: 8 });
  });
  it('R(1,8) ↔ B(4,8)', () => {
    const r = seamNeighbor({ section: 'red', sfile: 1, srank: 8 });
    expect(r).toEqual({ section: 'black', sfile: 4, srank: 8 });
  });
  it('B(4,8) ↔ W(1,8)', () => {
    const r = seamNeighbor({ section: 'black', sfile: 4, srank: 8 });
    expect(r).toEqual({ section: 'white', sfile: 1, srank: 8 });
  });
  it('forms a full cycle', () => {
    const wb = seamNeighbor({ section: 'white', sfile: 2, srank: 8 });
    expect(wb?.section).toBe('red');
    const rb = seamNeighbor(wb!);
    expect(rb?.section).toBe('black');
    // B–W seam: B(3,8) ↔ W(2,8)
    const bw = seamNeighbor({ section: 'black', sfile: 3, srank: 8 });
    expect(bw).toEqual({ section: 'white', sfile: 2, srank: 8 });
  });
  it('returns null for non-seam square', () => {
    expect(seamNeighbor({ section: 'white', sfile: 1, srank: 7 })).toBeNull();
  });
});

describe('isSeamSquare', () => {
  it('srank 8 is seam', () => {
    expect(isSeamSquare({ section: 'white', sfile: 1, srank: 8 })).toBe(true);
  });
  it('srank 7 is not seam', () => {
    expect(isSeamSquare({ section: 'white', sfile: 1, srank: 7 })).toBe(false);
  });
});

describe('stepInDirection', () => {
  it('steps forward inside section', () => {
    const r = stepInDirection({ section: 'white', sfile: 2, srank: 3 }, 1, 0);
    expect(r).toEqual({
      pos: { section: 'white', sfile: 2, srank: 4 },
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

  it('direction negates when crossing seam', () => {
    // White(2,8) stepping forward (+1,0) crosses to red(3,8) neighbor, then continues to (3,7)
    const r = stepInDirection({ section: 'white', sfile: 2, srank: 8 }, 1, 0);
    expect(r).not.toBeNull();
    expect(r!.pos.section).toBe('red');
    expect(r!.pos.srank).toBe(7); // entered at srank=8, stepped -1 = 7
    expect(r!.newDsrank).toBe(-1); // negated
    expect(r!.newDsfile).toBe(0);
  });

  it('returns null when stepping off back rank (srank<1)', () => {
    const r = stepInDirection({ section: 'white', sfile: 2, srank: 1 }, -1, 0);
    expect(r).toBeNull();
  });

  it('returns null when stepping off side (sfile<1)', () => {
    const r = stepInDirection({ section: 'white', sfile: 1, srank: 3 }, 0, -1);
    expect(r).toBeNull();
  });

  it('returns null when stepping off side (sfile>4)', () => {
    const r = stepInDirection({ section: 'white', sfile: 4, srank: 3 }, 0, 1);
    expect(r).toBeNull();
  });
});

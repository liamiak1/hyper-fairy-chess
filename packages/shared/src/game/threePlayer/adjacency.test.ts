import { describe, it, expect } from 'vitest';
import { seamNeighbor, stepInDirection, isSeamSquare } from './adjacency';

describe('seamNeighbor', () => {
  it('W(1,4) → R(8,4)', () => {
    const r = seamNeighbor({ section: 'white', sfile: 1, srank: 4 });
    expect(r).toEqual({ section: 'red', sfile: 8, srank: 4 });
  });
  it('W(4,4) → R(5,4)', () => {
    const r = seamNeighbor({ section: 'white', sfile: 4, srank: 4 });
    expect(r).toEqual({ section: 'red', sfile: 5, srank: 4 });
  });
  it('R(1,4) → B(8,4)', () => {
    const r = seamNeighbor({ section: 'red', sfile: 1, srank: 4 });
    expect(r).toEqual({ section: 'black', sfile: 8, srank: 4 });
  });
  it('B(8,4) → W(1,4)', () => {
    const r = seamNeighbor({ section: 'black', sfile: 8, srank: 4 });
    expect(r).toEqual({ section: 'white', sfile: 1, srank: 4 });
  });
  it('forms a full cycle', () => {
    const wb = seamNeighbor({ section: 'white', sfile: 2, srank: 4 });
    expect(wb?.section).toBe('red');
    expect(wb?.sfile).toBe(7); // 9-2=7
    const rb = seamNeighbor(wb!);
    expect(rb?.section).toBe('black');
    expect(rb?.sfile).toBe(2); // 9-7=2
    // B–W seam: B(7,4) ↔ W(2,4)
    const bw = seamNeighbor({ section: 'black', sfile: 7, srank: 4 });
    expect(bw).toEqual({ section: 'white', sfile: 2, srank: 4 });
  });
  it('returns null for non-seam square', () => {
    expect(seamNeighbor({ section: 'white', sfile: 1, srank: 3 })).toBeNull();
  });
});

describe('isSeamSquare', () => {
  it('srank 4 is seam', () => {
    expect(isSeamSquare({ section: 'white', sfile: 1, srank: 4 })).toBe(true);
  });
  it('srank 3 is not seam', () => {
    expect(isSeamSquare({ section: 'white', sfile: 1, srank: 3 })).toBe(false);
  });
});

describe('stepInDirection', () => {
  it('steps forward inside section', () => {
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

  it('direction negates when crossing seam', () => {
    // White(2,4) stepping forward (+1,0) crosses to red(7,4) neighbor, then continues to (7,3)
    const r = stepInDirection({ section: 'white', sfile: 2, srank: 4 }, 1, 0);
    expect(r).not.toBeNull();
    expect(r!.pos.section).toBe('red');
    expect(r!.pos.srank).toBe(3); // entered at srank=4, stepped -1 = 3
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

  it('returns null when stepping off side (sfile>8)', () => {
    const r = stepInDirection({ section: 'white', sfile: 8, srank: 3 }, 0, 1);
    expect(r).toBeNull();
  });
});

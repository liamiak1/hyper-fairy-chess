/**
 * Board topology: how squares connect on each board.
 *
 * The 3-player board is the interesting one. Three 8x4 sections meet at the
 * centre, and a piece crossing that seam comes out facing the other way.
 * Getting the seam wrong is what made the previous 3-player attempt a ring
 * with a hole in the middle, so it is pinned down here in detail.
 */

import { describe, it, expect } from 'vitest';
import type { Position, File, Rank } from '../types';
import { positionToString } from '../types';
import {
  RectangularTopology,
  ThreePlayerTopology,
  getTopology,
  sectionOf,
  localFile,
  threePlayerSquare,
} from './topology';

function sq(s: string): Position {
  return { file: s[0] as File, rank: Number(s.slice(1)) as Rank };
}

const three = new ThreePlayerTopology();

/** Step and report the landing square, or null. */
function stepTo(from: string, dx: number, dy: number): string | null {
  const r = three.step(sq(from), dx, dy);
  return r ? positionToString(r.pos) : null;
}

/** Step and report the direction you come out facing. */
function stepDir(from: string, dx: number, dy: number): [number, number] | null {
  const r = three.step(sq(from), dx, dy);
  return r ? [r.dx, r.dy] : null;
}

function offsetTo(from: string, dx: number, dy: number): string | null {
  const r = three.offset(sq(from), dx, dy);
  return r ? positionToString(r) : null;
}

// =============================================================================
// Rectangular boards
// =============================================================================

describe('RectangularTopology', () => {
  const std = new RectangularTopology({ files: 8, ranks: 8 }, '8x8');

  it('steps the obvious way and never changes direction', () => {
    const r = std.step(sq('d4'), 1, 1)!;
    expect(positionToString(r.pos)).toBe('e5');
    expect([r.dx, r.dy]).toEqual([1, 1]);
    expect(r.crossed).toBeFalsy();
  });

  it('stops at the edges', () => {
    expect(std.step(sq('a1'), -1, 0)).toBeNull();
    expect(std.step(sq('a1'), 0, -1)).toBeNull();
    expect(std.step(sq('h8'), 1, 0)).toBeNull();
    expect(std.step(sq('h8'), 0, 1)).toBeNull();
  });

  it('offsets by plain arithmetic', () => {
    expect(positionToString(std.offset(sq('b1'), 1, 2)!)).toBe('c3');
    expect(std.offset(sq('b1'), -3, 0)).toBeNull();
  });

  it('lets a leap pass over a voided 4-player corner but not land on one', () => {
    const cross = new RectangularTopology({ files: 12, ranks: 12 }, '4player');

    // a1 is a voided corner
    expect(cross.isValid(sq('a1'))).toBe(false);
    expect(cross.offset(sq('c3'), -2, -2)).toBeNull(); // would land on a1

    // but a knight may jump across the corner region to a legal square
    expect(positionToString(cross.offset(sq('c1'), -2, 2)!)).toBe('a3');
  });
});

// =============================================================================
// 3-player: coordinates
// =============================================================================

describe('3-player coordinates', () => {
  it('splits the 24 files into three sections', () => {
    expect(sectionOf(sq('a1'))).toBe(0); // white
    expect(sectionOf(sq('h1'))).toBe(0);
    expect(sectionOf(sq('i1'))).toBe(1); // black
    expect(sectionOf(sq('p1'))).toBe(1);
    expect(sectionOf(sq('q1'))).toBe(2); // red
    expect(sectionOf(sq('x1'))).toBe(2);
  });

  it('reports the local file within a section', () => {
    expect(localFile(sq('a1'))).toBe(1);
    expect(localFile(sq('h1'))).toBe(8);
    expect(localFile(sq('i1'))).toBe(1);
    expect(localFile(sq('x1'))).toBe(8);
  });

  it('round-trips through threePlayerSquare', () => {
    for (let section = 0; section < 3; section++) {
      for (let local = 1; local <= 8; local++) {
        const p = threePlayerSquare(section, local, 3);
        expect(sectionOf(p)).toBe(section);
        expect(localFile(p)).toBe(local);
        expect(p.rank).toBe(3);
      }
    }
  });

  it('has 96 squares and no more', () => {
    let count = 0;
    for (let fi = 0; fi < 24; fi++) {
      for (let rank = 1; rank <= 4; rank++) {
        if (three.isValid(threePlayerSquare(Math.floor(fi / 8), (fi % 8) + 1, rank))) {
          count++;
        }
      }
    }
    expect(count).toBe(96);
  });
});

// =============================================================================
// 3-player: ordinary movement inside a section
// =============================================================================

describe('3-player movement inside a section', () => {
  it('moves normally away from the seam', () => {
    expect(stepTo('d2', 1, 0)).toBe('e2');
    expect(stepTo('d2', -1, 0)).toBe('c2');
    expect(stepTo('d2', 0, 1)).toBe('d3');
    expect(stepTo('d2', 0, -1)).toBe('d1');
    expect(stepTo('d2', 1, 1)).toBe('e3');
  });

  it('keeps the direction unchanged when not crossing', () => {
    expect(stepDir('d2', 1, 1)).toEqual([1, 1]);
    expect(three.step(sq('d2'), 1, 1)!.crossed).toBeFalsy();
  });

  it('treats a section side edge as the rim of the board', () => {
    // The sections do NOT wrap around the outside — h and i are different
    // sections and are not connected.
    expect(stepTo('h2', 1, 0)).toBeNull();
    expect(stepTo('a2', -1, 0)).toBeNull();
    expect(stepTo('i2', -1, 0)).toBeNull();
    expect(stepTo('x2', 1, 0)).toBeNull();
  });

  it('treats rank 1 as the back of the board', () => {
    expect(stepTo('d1', 0, -1)).toBeNull();
  });
});

// =============================================================================
// 3-player: the fold at the centre
// =============================================================================

describe('3-player fold at the centre', () => {
  it('pairs each half of an inner rank with a different neighbour', () => {
    // White's right half (e-h) folds into black; local f <-> local 9-f
    expect(stepTo('e4', 0, 1)).toBe('l4'); // white local 5 -> black local 4
    expect(stepTo('f4', 0, 1)).toBe('k4'); // white local 6 -> black local 3
    expect(stepTo('g4', 0, 1)).toBe('j4'); // white local 7 -> black local 2
    expect(stepTo('h4', 0, 1)).toBe('i4'); // white local 8 -> black local 1

    // White's left half (a-d) folds into red
    expect(stepTo('d4', 0, 1)).toBe('u4'); // white local 4 -> red local 5
    expect(stepTo('a4', 0, 1)).toBe('x4'); // white local 1 -> red local 8
  });

  it('is symmetric: crossing back returns you to where you started', () => {
    // Every one of the 24 inner squares must fold onto exactly one partner,
    // and that partner must fold back.
    for (let fi = 0; fi < 24; fi++) {
      const from = threePlayerSquare(Math.floor(fi / 8), (fi % 8) + 1, 4);
      const across = three.step(from, 0, 1);
      expect(across, `${positionToString(from)} has no partner`).not.toBeNull();

      // The direction handed back points onwards, into the neighbour's
      // territory; turning round and stepping back must undo the crossing.
      const back = three.step(across!.pos, -across!.dx, -across!.dy);
      expect(back, `no way back from ${positionToString(across!.pos)}`).not.toBeNull();
      expect(positionToString(back!.pos)).toBe(positionToString(from));
    }
  });

  it('always lands in a different section', () => {
    for (let fi = 0; fi < 24; fi++) {
      const from = threePlayerSquare(Math.floor(fi / 8), (fi % 8) + 1, 4);
      const across = three.step(from, 0, 1)!;
      expect(sectionOf(across.pos)).not.toBe(sectionOf(from));
    }
  });

  it('reaches both opponents from one section', () => {
    const reached = new Set<number>();
    for (let local = 1; local <= 8; local++) {
      const from = threePlayerSquare(0, local, 4);
      reached.add(sectionOf(three.step(from, 0, 1)!.pos));
    }
    expect([...reached].sort()).toEqual([1, 2]); // black and red
  });

  it('flips the direction on the way through', () => {
    expect(stepDir('h4', 0, 1)).toEqual([0, -1]);
    expect(three.step(sq('h4'), 0, 1)!.crossed).toBe(true);

    // A diagonal flips both components
    expect(stepDir('f4', 1, 1)).toEqual([-1, -1]);
  });

  it('mirrors the sideways part of a diagonal crossing', () => {
    // f4 (white local 6) pairs with k4 (black local 3). Files run the other
    // way across the join, so "forward and right" arrives one to black's left.
    expect(stepTo('f4', 0, 1)).toBe('k4');
    expect(stepTo('f4', 1, 1)).toBe('j4');
    expect(stepTo('f4', -1, 1)).toBe('l4');
  });

  it('runs off the board when a diagonal crossing overshoots the join', () => {
    // h4 pairs with i4, black's leftmost file; one further left is the rim.
    expect(stepTo('h4', 0, 1)).toBe('i4');
    expect(stepTo('h4', 1, 1)).toBeNull();
  });

  it('does not cross sideways along the inner rank', () => {
    // Sliding along rank 4 stays in your own section; the fold is only
    // reachable by moving forwards through it.
    expect(stepTo('h4', 1, 0)).toBeNull();
    expect(stepTo('a4', -1, 0)).toBeNull();
  });
});

// =============================================================================
// 3-player: sliding through the fold
// =============================================================================

describe('3-player sliding through the fold', () => {
  /** Slide from a square in a direction, threading the direction as a rook does. */
  function slide(from: string, dx: number, dy: number): string[] {
    const path: string[] = [];
    let cursor = { pos: sq(from), dx, dy };
    for (let i = 0; i < 20; i++) {
      const next = three.step(cursor.pos, cursor.dx, cursor.dy);
      if (!next) break;
      path.push(positionToString(next.pos));
      cursor = { pos: next.pos, dx: next.dx, dy: next.dy };
    }
    return path;
  }

  it('carries a rook from its own back rank into an opponent territory', () => {
    // Straight up white's e-file, through the fold, down black's l-file.
    expect(slide('e1', 0, 1)).toEqual(['e2', 'e3', 'e4', 'l4', 'l3', 'l2', 'l1']);
  });

  it('gives a full-length path from every starting square', () => {
    // Seven squares ahead of you from your own back rank, on any file —
    // the same reach a rook has on a standard board.
    for (let local = 1; local <= 8; local++) {
      const from = positionToString(threePlayerSquare(0, local, 1));
      expect(slide(from, 0, 1), `from ${from}`).toHaveLength(7);
    }
  });

  it('does not loop forever', () => {
    // A slide must terminate on the rim, not circle the board.
    const path = slide('e1', 0, 1);
    expect(path.length).toBeLessThan(20);
    expect(new Set(path).size).toBe(path.length); // no square visited twice
  });

  it('slides a diagonal through the fold', () => {
    // c1 diagonally: up to f4, across the fold into black, then onwards.
    const path = slide('c1', 1, 1);
    expect(path.slice(0, 3)).toEqual(['d2', 'e3', 'f4']);
    // f4 (white local 6) folds to black local 3 = k4, and the sideways part
    // of the step is mirrored, so it lands one further on at j4.
    expect(path[3]).toBe('j4');
    // Direction is now (-1, -1), heading down black's section
    expect(path[4]).toBe('i3');
  });

  it('stops a diagonal that overshoots the edge of the join', () => {
    // e1 diagonally reaches h4, whose partner i4 is black's leftmost file —
    // one further left is the rim, so the slide ends there.
    expect(slide('e1', 1, 1)).toEqual(['f2', 'g3', 'h4']);
  });
});

// =============================================================================
// 3-player: leaps
// =============================================================================

describe('3-player leaps', () => {
  it('leaps normally away from the seam', () => {
    expect(offsetTo('d1', 1, 2)).toBe('e3');
    expect(offsetTo('d2', 2, 1)).toBe('f3');
    expect(offsetTo('d2', -2, -1)).toBe('b1');
  });

  it('runs off the rim rather than wrapping between sections', () => {
    expect(offsetTo('h2', 2, 1)).toBeNull();
    expect(offsetTo('a2', -2, 1)).toBeNull();
  });

  it('carries a knight through the fold', () => {
    // From e3: diagonal step to f4, then the remaining rank step crosses.
    const landed = offsetTo('e3', 1, 2);
    expect(landed).not.toBeNull();
    expect(sectionOf(sq(landed!))).toBe(1); // ends up in black's section
  });

  it('lands every knight leap on a real square or nowhere', () => {
    const leaps = [
      [1, 2], [2, 1], [-1, 2], [-2, 1],
      [1, -2], [2, -1], [-1, -2], [-2, -1],
    ];
    for (let fi = 0; fi < 24; fi++) {
      for (let rank = 1; rank <= 4; rank++) {
        const from = threePlayerSquare(Math.floor(fi / 8), (fi % 8) + 1, rank);
        for (const [dx, dy] of leaps) {
          const to = three.offset(from, dx, dy);
          if (to !== null) {
            expect(three.isValid(to), `${positionToString(from)} +${dx},${dy}`).toBe(true);
            // and never a no-op
            expect(positionToString(to)).not.toBe(positionToString(from));
          }
        }
      }
    }
  });
});

// =============================================================================
// Lookup
// =============================================================================

describe('getTopology', () => {
  it('returns the folded board for 3player', () => {
    const t = getTopology({ files: 24, ranks: 4, boardSize: '3player' });
    expect(t).toBeInstanceOf(ThreePlayerTopology);
  });

  it('returns a rectangular board for everything else', () => {
    expect(getTopology({ files: 8, ranks: 8, boardSize: '8x8' }))
      .toBeInstanceOf(RectangularTopology);
    expect(getTopology({ files: 12, ranks: 12, boardSize: '4player' }))
      .toBeInstanceOf(RectangularTopology);
    // No boardSize at all still works
    expect(getTopology({ files: 8, ranks: 8 })).toBeInstanceOf(RectangularTopology);
  });
});

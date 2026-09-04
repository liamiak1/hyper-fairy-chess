/**
 * Board topology — how squares connect to each other.
 *
 * Every board in this game is a grid of (file, rank) squares, but they do not
 * all connect the same way. A rectangular board connects the obvious way and a
 * direction never changes. The 3-player board is folded at its centre, so a
 * piece that crosses the seam comes out facing the other way.
 *
 * Move generation goes through this interface so that piece movement is written
 * once and works on any board. Adding a board (a cylinder, a torus, a bigger
 * hexagon) means adding a topology, not another move generator.
 *
 * The two primitives are:
 *
 *   step(pos, dx, dy)    one square, returning the NEW DIRECTION as well as the
 *                        new square. Sliding pieces feed that direction back in
 *                        on the next step, which is what makes a rook come out
 *                        of the fold going the right way.
 *
 *   offset(pos, dx, dy)  land dx/dy away in one jump, for leapers.
 *
 * On rectangular boards step() returns the direction unchanged and offset() is
 * plain arithmetic, so those boards behave exactly as they always have.
 */

import type { Position, BoardDimensions, BoardSize, File, Rank } from '../types';
import { fileToIndex, indexToFile } from './files';

/** One square of travel: where you land, and which way you are now facing. */
export interface Step {
  pos: Position;
  dx: number;
  dy: number;
  /** True if this step passed through a seam and flipped the direction. */
  crossed?: boolean;
}

export interface BoardTopology {
  readonly dimensions: BoardDimensions;

  /** Is this a real square on this board? */
  isValid(pos: Position): boolean;

  /**
   * Move one square in direction (dx, dy), where each component is -1, 0 or 1.
   * Returns the square landed on and the direction to continue in, or null if
   * that step leaves the board.
   */
  step(pos: Position, dx: number, dy: number): Step | null;

  /**
   * Land dx files and dy ranks away, as a leaper does — the squares in between
   * are jumped over, not visited.
   */
  offset(pos: Position, dx: number, dy: number): Position | null;
}

// =============================================================================
// Rectangular boards (8x8, 10x8, 10x10, and the 4-player cross)
// =============================================================================

/**
 * An ordinary grid. Directions are preserved, and off the edge is off the board.
 *
 * The 4-player cross board is a rectangle with its corners voided; a leap may
 * pass over a voided corner but may not land on one, which is how this board
 * has always behaved.
 */
export class RectangularTopology implements BoardTopology {
  constructor(
    readonly dimensions: BoardDimensions,
    private readonly boardSize?: BoardSize
  ) {}

  isValid(pos: Position): boolean {
    const fi = fileToIndex(pos.file);
    if (fi < 0 || fi >= this.dimensions.files) return false;
    if (pos.rank < 1 || pos.rank > this.dimensions.ranks) return false;
    if (this.boardSize === '4player' && isVoidCorner(pos)) return false;
    return true;
  }

  offset(pos: Position, dx: number, dy: number): Position | null {
    const fi = fileToIndex(pos.file) + dx;
    const rank = pos.rank + dy;

    if (fi < 0 || fi >= this.dimensions.files) return null;
    if (rank < 1 || rank > this.dimensions.ranks) return null;

    const file = indexToFile(fi);
    if (!file) return null;

    const next: Position = { file, rank: rank as Rank };
    if (this.boardSize === '4player' && isVoidCorner(next)) return null;

    return next;
  }

  step(pos: Position, dx: number, dy: number): Step | null {
    const next = this.offset(pos, dx, dy);
    return next ? { pos: next, dx, dy } : null;
  }
}

/** The 2x2 corners cut out of the 12x12 4-player board. */
function isVoidCorner(pos: Position): boolean {
  const fi = fileToIndex(pos.file) + 1; // 1-indexed
  const r = pos.rank;
  return (fi <= 2 || fi >= 11) && (r <= 2 || r >= 11);
}

// =============================================================================
// The 3-player board
// =============================================================================

/**
 * Three 8x4 sections that meet, and fold into each other, at the centre.
 *
 * Squares are addressed globally as files a..x by ranks 1..4. Files a-h are
 * white's section, i-p black's, q-x red's. Within a section, rank 1 is that
 * player's back rank and rank 4 is the inner rank at the centre of the board.
 *
 *        rank 1  a b c d e f g h    <- white's back rank
 *        rank 4  a b c d e f g h    <- white's inner rank, at the centre
 *                \_______/\______/
 *                 folds to  folds to
 *                   red      black
 *
 * A section's inner rank is split down the middle. Its right half (local files
 * 5-8) is glued to the clockwise neighbour's left half, and its left half
 * (local files 1-4) to the anticlockwise neighbour's right half, with the files
 * running in opposite directions across the join:
 *
 *      white e4 - h4  <->  black d4 - a4       (local f <-> local 9-f)
 *      black e4 - h4  <->  red   d4 - a4
 *      red   e4 - h4  <->  white d4 - a4
 *
 * So a piece advancing off white's inner rank arrives on an opponent's inner
 * rank and continues down towards their back rank. Its direction is negated on
 * the way through, because the neighbour's axes point the opposite way: what
 * was "forwards, to the right" becomes "backwards, to the left" in the frame it
 * lands in. That negation is the whole reason step() returns a direction.
 *
 * A pawn therefore has a real journey: three squares up its own section, across
 * the fold, then three more down an opponent's section to promote on their back
 * rank — seven squares, near enough to standard chess.
 *
 * A section's outer file edges (local file 1 and local file 8) are the rim of
 * the board, not a join, so nothing wraps around the outside.
 */
export class ThreePlayerTopology implements BoardTopology {
  readonly dimensions: BoardDimensions = { files: 24, ranks: 4 };

  isValid(pos: Position): boolean {
    const fi = fileToIndex(pos.file);
    return fi >= 0 && fi < 24 && pos.rank >= 1 && pos.rank <= 4;
  }

  step(pos: Position, dx: number, dy: number): Step | null {
    if (!this.isValid(pos)) return null;

    const fi = fileToIndex(pos.file);
    const section = Math.floor(fi / 8);
    const local = fi % 8; // 0..7 within the section
    const rank = pos.rank + dy;

    // Off the back of your own section: the rim of the board.
    if (rank < 1) return null;

    if (rank <= 4) {
      // Ordinary step inside a section. The side edges are the board's rim.
      const newLocal = local + dx;
      if (newLocal < 0 || newLocal > 7) return null;
      return makeStep(section * 8 + newLocal, rank, dx, dy);
    }

    // rank === 5: crossing the fold at the centre of the board.
    //
    // The partner square is the mirror of this one (local -> 7 - local) in the
    // neighbouring section: the right half of a section joins the clockwise
    // neighbour, the left half the anticlockwise one.
    const partnerSection =
      local >= 4 ? (section + 1) % 3 : (section + 2) % 3;

    // Files run backwards across the join, so the sideways part of this step is
    // applied in the opposite direction once we are through.
    const partnerLocal = 7 - local - dx;
    if (partnerLocal < 0 || partnerLocal > 7) return null;

    return makeStep(partnerSection * 8 + partnerLocal, 4, negate(dx), negate(dy), true);
  }

  /**
   * Leaps walk the fold rather than jumping it arithmetically, since files and
   * ranks mean different things either side of the seam.
   *
   * The path convention is: travel diagonally for as long as both components
   * have distance left, then straight for the remainder. Squares along the way
   * are passed over, not landed on — this only decides which square a leap
   * arrives at, not whether the path is blocked.
   */
  offset(pos: Position, dx: number, dy: number): Position | null {
    let current = pos;
    let dirX = Math.sign(dx);
    let dirY = Math.sign(dy);
    let remainingX = Math.abs(dx);
    let remainingY = Math.abs(dy);

    while (remainingX > 0 || remainingY > 0) {
      // Diagonal while both components have distance left, then straight.
      const stepX = remainingX > 0 ? dirX : 0;
      const stepY = remainingY > 0 ? dirY : 0;

      const next = this.step(current, stepX, stepY);
      if (!next) return null;

      if (remainingX > 0) remainingX--;
      if (remainingY > 0) remainingY--;

      current = next.pos;

      // Crossing the fold flips the whole frame, including the component we
      // were not stepping this time.
      if (next.crossed) {
        dirX = -dirX;
        dirY = -dirY;
      }
    }

    return current;
  }
}

/** Negate without producing -0, which compares oddly and leaks into tests. */
function negate(v: number): number {
  return v === 0 ? 0 : -v;
}

function makeStep(
  fileIndex: number,
  rank: number,
  dx: number,
  dy: number,
  crossed = false
): Step | null {
  const file = indexToFile(fileIndex);
  if (!file) return null;
  return { pos: { file, rank: rank as Rank }, dx, dy, crossed };
}

// =============================================================================
// Lookup
// =============================================================================

/**
 * The topology for a board.
 *
 * Takes the dimensions object move generation already threads around, which
 * carries an optional boardSize, so call sites do not have to change.
 */
export function getTopology(
  dimensions: BoardDimensions & { boardSize?: BoardSize }
): BoardTopology {
  if (dimensions.boardSize === '3player') {
    return THREE_PLAYER_TOPOLOGY;
  }
  return new RectangularTopology(dimensions, dimensions.boardSize);
}

/** Shared instance — the 3-player board has no per-board configuration. */
export const THREE_PLAYER_TOPOLOGY = new ThreePlayerTopology();

/** Which section (0 = white, 1 = black, 2 = red) a 3-player square belongs to. */
export function sectionOf(pos: Position): number {
  return Math.floor(fileToIndex(pos.file) / 8);
}

/** The local file (1-8) of a 3-player square within its own section. */
export function localFile(pos: Position): number {
  return (fileToIndex(pos.file) % 8) + 1;
}

/** Build a 3-player position from a section (0-2), local file (1-8) and rank. */
export function threePlayerSquare(
  section: number,
  local: number,
  rank: number
): Position {
  const file = indexToFile(section * 8 + (local - 1));
  if (!file) throw new Error(`bad 3-player square: ${section}/${local}`);
  return { file: file as File, rank: rank as Rank };
}

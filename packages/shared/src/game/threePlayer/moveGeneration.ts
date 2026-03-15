/**
 * Move generation for 3-player GreenChess board.
 *
 * Uses stepInDirection for all sliding moves so they correctly cross seams.
 * Pawns move toward increasing srank (forward = +1 srank direction).
 * Promotion: pawn reaching srank=1 of an opponent section (enemy back rank).
 */

import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import { stepInDirection, secondarySeamNeighbor } from './adjacency';
import type { ThreePos, ThreeGameState, ThreePiece, Section } from './types';
import { threeposKey, threeposEqual } from './types';

// All 8 sliding directions (dsrank, dsfile)
const ORTH_DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
] as const;

const DIAG_DIRS = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;

const ALL_DIRS = [...ORTH_DIRS, ...DIAG_DIRS] as const;

// Knight L-shapes: (dsrank, dsfile)
const KNIGHT_LEAPS = [
  [2, 1], [2, -1], [-2, 1], [-2, -1],
  [1, 2], [1, -2], [-1, 2], [-1, -2],
] as const;

function getPieceAt(state: ThreeGameState, pos: ThreePos): ThreePiece | null {
  return state.board.positionMap.get(threeposKey(pos)) ?? null;
}

/**
 * Generate all pseudo-legal destinations for a piece (does not filter check).
 */
export function getValidThreeMoves(state: ThreeGameState, pieceId: string): ThreePos[] {
  const piece = state.board.pieces.find((p) => p.id === pieceId);
  if (!piece) return [];

  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return [];

  const moves: ThreePos[] = [];

  const slides = pieceType.movement.slides;
  const leaps = pieceType.movement.leaps;
  const special = pieceType.movement.special;

  // Sliding moves
  for (const slideDir of slides) {
    const dirs =
      slideDir === 'orthogonal' ? ORTH_DIRS :
      slideDir === 'diagonal' ? DIAG_DIRS :
      ALL_DIRS;

    for (const [dr, df] of dirs) {
      // Bishop at seam: branch into both cross-seam continuations
      // We handle this naturally: stepInDirection at the seam will pick the
      // specific seam neighbor based on position. For bishop branches at a
      // diagonal seam crossing, we generate both branch directions.
      if (slideDir === 'diagonal' || slideDir === 'all') {
        addSlide(state, piece, dr, df, moves, true);
      } else {
        addSlide(state, piece, dr, df, moves, false);
      }
    }
  }

  // Knight leaps
  if (leaps.some((l) => l.dx === 2 && l.dy === 1 && l.symmetric)) {
    for (const [dr, df] of KNIGHT_LEAPS) {
      addKnightLeap(state, piece, dr, df, moves);
    }
  }

  // Special movements
  for (const sm of special) {
    switch (sm) {
      case 'pawn-forward':
        addPawnMoves(state, piece, moves);
        break;
      case 'king-one-square':
        addKingMoves(state, piece, moves);
        break;
    }
  }

  return moves;
}

/**
 * Slide along a direction using stepInDirection, stopping at board edge, friendly, or after capture.
 * For diagonal slides at seam squares, also branches into the alternative diagonal cross-seam path.
 */
function addSlide(
  state: ThreeGameState,
  piece: ThreePiece,
  dr: number,
  df: number,
  moves: ThreePos[],
  isDiagonal: boolean,
) {
  let pos = piece.position;
  let cdr = dr;
  let cdf = df;

  while (true) {
    // If we're at a seam square and this is a diagonal, try branching to the other adjacent section
    if (isDiagonal && pos.srank === 4) {
      // We're continuing a diagonal slide from the seam. The normal stepInDirection
      // will handle the primary path. We also need to try the alternative seam cross.
      addDiagonalSeamBranch(state, piece, pos, cdr, cdf, moves);
    }

    const step = stepInDirection(pos, cdr, cdf);
    if (!step) break;

    const target = getPieceAt(state, step.pos);
    if (target) {
      if (target.owner !== piece.owner) {
        moves.push(step.pos); // capture
      }
      break; // blocked
    }

    moves.push(step.pos);
    pos = step.pos;
    cdr = step.newDsrank;
    cdf = step.newDsfile;
  }
}

/**
 * When a diagonal slide reaches a seam square, it can continue into EITHER adjacent section.
 * The primary path is handled by addSlide. This adds the ALTERNATIVE branch.
 *
 * At seam square (s, f, 8), the piece came from direction (dr, df).
 * The seam neighbor is (s', 5-f, 8). In s', direction negates to (-dr, -df).
 * But there are two diagonals crossing into the seam neighbor:
 *   - The one stepInDirection already handles (primary)
 *   - The mirrored diagonal via the seam neighbor (alternative, currently just the other diagonal continuation from seam neighbor)
 *
 * In practice for GreenChess: from seam square, bishop can slide diagonally into
 * the seam neighbor section. stepInDirection handles one. We add the continuation
 * from the seam neighbor in the other diagonal direction.
 */
function addDiagonalSeamBranch(
  state: ThreeGameState,
  piece: ThreePiece,
  seamPos: ThreePos,
  dr: number,
  df: number,
  moves: ThreePos[],
) {
  // The secondary seam neighbor (primary is handled by the main slide loop)
  const neighbor = secondarySeamNeighbor(seamPos);
  if (!neighbor) return;

  // Continue from the seam neighbor with an alternative diagonal direction
  // In the seam neighbor section, the "other" diagonal from the seam is (-dr, df) mirrored
  // Since direction negates at seam: normal continuation is (-dr, -df)
  // The alternative continuation would use the sfile-flipped: (-dr, +df) or similar
  // Per GreenChess rules, we slide from the neighbor in BOTH diagonal directions that lead away from the seam
  const altDr = -dr;
  // Try both sfile directions away from seam
  for (const altDf of [-df, df]) {
    let pos = neighbor;
    let cdr = altDr;
    let cdf = altDf;

    while (true) {
      const step = stepInDirection(pos, cdr, cdf);
      if (!step) break;
      const target = getPieceAt(state, step.pos);
      if (target) {
        if (target.owner !== piece.owner) {
          moves.push(step.pos);
        }
        break;
      }
      moves.push(step.pos);
      pos = step.pos;
      cdr = step.newDsrank;
      cdf = step.newDsfile;
    }
  }
}

/**
 * Knight leap: step through seam adjacency for each L-shape.
 * Uses two sequential steps to implement the L-shape properly across seams.
 */
function addKnightLeap(
  state: ThreeGameState,
  piece: ThreePiece,
  dr: number,
  df: number,
  moves: ThreePos[],
) {
  // An L-shape of (dr, df) can be decomposed as:
  // Option A: long leg first (abs(dr)=2 or abs(df)=2), then short leg
  // We step through the board one square at a time to respect seam crossings.
  const longDr = Math.abs(dr) === 2 ? Math.sign(dr) : 0;
  const longDf = Math.abs(df) === 2 ? Math.sign(df) : 0;
  const shortDr = dr - longDr * 2;
  const shortDf = df - longDf * 2;

  // Step 1: move in long direction twice
  let pos = piece.position;
  let cdr = longDr;
  let cdf = longDf;

  const step1 = stepInDirection(pos, cdr, cdf);
  if (!step1) return;
  const step2 = stepInDirection(step1.pos, step1.newDsrank, step1.newDsfile);
  if (!step2) return;

  // After 2 steps in long direction, take 1 step in short direction.
  // If the seam was crossed, direction negates, so short leg also negates.
  const seamCrossed = step2.pos.section !== pos.section;
  const adjShortDr = seamCrossed ? -shortDr : shortDr;
  const adjShortDf = seamCrossed ? -shortDf : shortDf;

  const step3 = stepInDirection(step2.pos, adjShortDr, adjShortDf);
  if (!step3) return;

  const dest = step3.pos;
  const target = getPieceAt(state, dest);
  if (!target || target.owner !== piece.owner) {
    moves.push(dest);
  }
}

function addPawnMoves(state: ThreeGameState, piece: ThreePiece, moves: ThreePos[]) {
  const pos = piece.position;

  // Forward = +1 srank
  const fwd = stepInDirection(pos, 1, 0);
  if (fwd && !getPieceAt(state, fwd.pos)) {
    moves.push(fwd.pos);

    // Double step from starting rank 2
    if (!piece.hasMoved && pos.srank === 2) {
      const fwd2 = stepInDirection(fwd.pos, fwd.newDsrank, fwd.newDsfile);
      if (fwd2 && !getPieceAt(state, fwd2.pos)) {
        moves.push(fwd2.pos);
      }
    }
  }

  // Diagonal captures
  for (const df of [-1, 1] as const) {
    const diag = stepInDirection(pos, 1, df);
    if (diag) {
      const target = getPieceAt(state, diag.pos);
      if (target && target.owner !== piece.owner) {
        moves.push(diag.pos);
      }
      // En passant
      if (state.enPassantTarget && threeposEqual(diag.pos, state.enPassantTarget)) {
        moves.push(diag.pos);
      }
    }
  }
}

function addKingMoves(state: ThreeGameState, piece: ThreePiece, moves: ThreePos[]) {
  for (const [dr, df] of ALL_DIRS) {
    const step = stepInDirection(piece.position, dr, df);
    if (!step) continue;
    const target = getPieceAt(state, step.pos);
    if (!target || target.owner !== piece.owner) {
      moves.push(step.pos);
    }
  }
}

/** Check if a pawn at the given position has reached an opponent's back rank (srank=1 in another section). */
export function isPawnPromotion(pos: ThreePos, owner: Section): boolean {
  if (pos.srank !== 1) return false;
  // Pawn is on back rank of ANOTHER section (not its own)
  return pos.section !== owner;
}

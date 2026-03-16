/**
 * Move generation for 3-player circular GreenChess.
 *
 * Uses stepInDirection for all sliding moves — file-edge crossings between
 * sections are handled transparently with no direction negation.
 *
 * Pawns move inward (toward the center hub) = +1 srank direction.
 * Promotion: pawn reaches srank=4 (innermost rank, can advance no further).
 */

import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import { stepInDirection } from './adjacency';
import type { ThreePos, ThreeGameState, ThreePiece, Section } from './types';
import { threeposKey, threeposEqual } from './types';

const ORTH_DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
] as const;

const DIAG_DIRS = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;

const ALL_DIRS = [...ORTH_DIRS, ...DIAG_DIRS] as const;

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
  const { slides, leaps, special } = pieceType.movement;

  for (const slideDir of slides) {
    const dirs =
      slideDir === 'orthogonal' ? ORTH_DIRS :
      slideDir === 'diagonal' ? DIAG_DIRS :
      ALL_DIRS;
    for (const [dr, df] of dirs) {
      addSlide(state, piece, dr, df, moves);
    }
  }

  if (leaps.some((l) => l.dx === 2 && l.dy === 1 && l.symmetric)) {
    for (const [dr, df] of KNIGHT_LEAPS) {
      addKnightLeap(state, piece, dr, df, moves);
    }
  }

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
 * Slide along a direction using stepInDirection.
 * File-edge crossings are handled by stepInDirection with no direction change.
 */
function addSlide(
  state: ThreeGameState,
  piece: ThreePiece,
  dr: number,
  df: number,
  moves: ThreePos[],
) {
  let pos = piece.position;
  let cdr = dr;
  let cdf = df;

  while (true) {
    const step = stepInDirection(pos, cdr, cdf);
    if (!step) break;

    const target = getPieceAt(state, step.pos);
    if (target) {
      if (target.owner !== piece.owner) moves.push(step.pos); // capture
      break; // blocked
    }

    moves.push(step.pos);
    pos = step.pos;
    cdr = step.newDsrank;
    cdf = step.newDsfile;
  }
}

/**
 * Knight leap: decompose L-shape into unit steps through stepInDirection.
 * Direction is never negated at boundaries so no section-crossing adjustment needed.
 */
function addKnightLeap(
  state: ThreeGameState,
  piece: ThreePiece,
  dr: number,
  df: number,
  moves: ThreePos[],
) {
  const longDr = Math.abs(dr) === 2 ? Math.sign(dr) : 0;
  const longDf = Math.abs(df) === 2 ? Math.sign(df) : 0;
  const shortDr = dr - longDr * 2;
  const shortDf = df - longDf * 2;

  const step1 = stepInDirection(piece.position, longDr, longDf);
  if (!step1) return;
  const step2 = stepInDirection(step1.pos, longDr, longDf);
  if (!step2) return;
  const step3 = stepInDirection(step2.pos, shortDr, shortDf);
  if (!step3) return;

  const dest = step3.pos;
  const target = getPieceAt(state, dest);
  if (!target || target.owner !== piece.owner) {
    moves.push(dest);
  }
}

function addPawnMoves(state: ThreeGameState, piece: ThreePiece, moves: ThreePos[]) {
  const pos = piece.position;

  // Forward = +1 srank (toward center)
  const fwd = stepInDirection(pos, 1, 0);
  if (fwd && !getPieceAt(state, fwd.pos)) {
    moves.push(fwd.pos);

    // Double step on first move (from srank=1 or srank=2)
    if (!piece.hasMoved) {
      const fwd2 = stepInDirection(fwd.pos, 1, 0);
      if (fwd2 && !getPieceAt(state, fwd2.pos)) {
        moves.push(fwd2.pos);
      }
    }
  }

  // Diagonal captures (+1 srank, ±1 sfile)
  for (const df of [-1, 1] as const) {
    const diag = stepInDirection(pos, 1, df);
    if (diag) {
      const target = getPieceAt(state, diag.pos);
      if (target && target.owner !== piece.owner) {
        moves.push(diag.pos);
      }
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

/** Pawn promotion: reached srank=4 (innermost rank, can advance no further). */
export function isPawnPromotion(pos: ThreePos, _owner: Section): boolean {
  return pos.srank === 4;
}

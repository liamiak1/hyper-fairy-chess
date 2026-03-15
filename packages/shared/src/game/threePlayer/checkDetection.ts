/**
 * Check detection for 3-player GreenChess.
 */

import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import { getValidThreeMoves } from './moveGeneration';
import type { ThreeGameState, ThreePos, Section, ThreePiece } from './types';
import { threeposKey, threeposEqual } from './types';

/** Returns the position of the royal piece for a section, or null. */
function findKing(state: ThreeGameState, section: Section): ThreePos | null {
  for (const piece of state.board.pieces) {
    if (piece.owner === section) {
      const pt = PIECE_BY_ID[piece.typeId];
      if (pt?.isRoyal) {
        return piece.position;
      }
    }
  }
  return null;
}

/** Is the given section's king in check? */
export function isInThreeCheck(state: ThreeGameState, section: Section): boolean {
  const kingPos = findKing(state, section);
  if (!kingPos) return false;

  for (const piece of state.board.pieces) {
    if (piece.owner === section) continue;
    const moves = getValidThreeMoves(state, piece.id);
    if (moves.some((m) => threeposEqual(m, kingPos))) {
      return true;
    }
  }
  return false;
}

/** Returns legal moves for a piece (filters moves that leave own king in check). */
export function getThreeLegalMoves(state: ThreeGameState, pieceId: string): ThreePos[] {
  const piece = state.board.pieces.find((p) => p.id === pieceId);
  if (!piece) return [];

  const pseudoLegal = getValidThreeMoves(state, pieceId);
  return pseudoLegal.filter((to) => {
    const simulated = simulateThreeMove(state, piece.position, to);
    return !isInThreeCheck(simulated, piece.owner);
  });
}

/** Simulate a move and return the resulting state (for check detection). */
export function simulateThreeMove(
  state: ThreeGameState,
  from: ThreePos,
  to: ThreePos,
): ThreeGameState {
  const newPieces: ThreePiece[] = [];
  for (const p of state.board.pieces) {
    if (threeposEqual(p.position, to)) continue; // captured
    if (threeposEqual(p.position, from)) {
      newPieces.push({ ...p, position: to, hasMoved: true });
    } else {
      newPieces.push(p);
    }
  }

  const newMap = new Map<string, ThreePiece>();
  for (const p of newPieces) {
    newMap.set(threeposKey(p.position), p);
  }

  return {
    ...state,
    board: {
      ...state.board,
      pieces: newPieces,
      positionMap: newMap,
    },
  };
}

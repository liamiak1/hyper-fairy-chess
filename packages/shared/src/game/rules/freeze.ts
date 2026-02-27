/**
 * Freeze mechanics for Immobilizer, Inquisitor, Herald, and Chameleon interactions
 *
 * Rules:
 * - Immobilizer & Inquisitor: Freeze adjacent ENEMY pieces
 * - Herald: Freezes ALL adjacent pieces (friendly and enemy)
 * - Chameleon: Can freeze freezers that are adjacent to it (acts like what it captures)
 */

import type { BoardState, PieceInstance, PlayerColor } from '../types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import { areAdjacent, createPositionMap } from '../board/boardUtils';

// =============================================================================
// Freeze Calculation
// =============================================================================

/**
 * Check if a piece is a freezer (can freeze other pieces)
 */
function isFreezer(piece: PieceInstance): boolean {
  const pieceType = PIECE_BY_ID[piece.typeId];
  return pieceType?.canFreeze === true;
}

/**
 * Check if a piece is a Herald (freezes all adjacent, not just enemies)
 */
function isHerald(piece: PieceInstance): boolean {
  return piece.typeId === 'herald';
}

/**
 * Check if a piece is a Chameleon (can freeze freezers)
 */
function isChameleon(piece: PieceInstance): boolean {
  return piece.typeId === 'chameleon';
}

/**
 * Determine if piece A freezes piece B based on the rules:
 * - Herald freezes all adjacent pieces (friendly and enemy)
 * - Other freezers (Immobilizer, Inquisitor) freeze only adjacent enemies
 * - Chameleon freezes adjacent enemy freezers
 */
function doesFreeze(freezer: PieceInstance, target: PieceInstance): boolean {
  // Both must be on the board
  if (!freezer.position || !target.position) return false;

  // Must be adjacent
  if (!areAdjacent(freezer.position, target.position)) return false;

  // Can't freeze yourself
  if (freezer.id === target.id) return false;

  // Check if this is a Chameleon freezing a freezer
  if (isChameleon(freezer)) {
    // Chameleon freezes adjacent enemy freezers
    if (freezer.owner !== target.owner && isFreezer(target)) {
      return true;
    }
    return false;
  }

  // Check if this is a Herald (freezes all adjacent)
  if (isHerald(freezer)) {
    return true; // Freezes all adjacent pieces
  }

  // Other freezers (Immobilizer, Inquisitor) freeze only enemies
  if (isFreezer(freezer)) {
    return freezer.owner !== target.owner;
  }

  return false;
}

/**
 * Calculate frozen state for a single piece
 */
function calculateFrozenState(
  piece: PieceInstance,
  allPieces: PieceInstance[]
): boolean {
  if (!piece.position) return false;

  // Check if any piece on the board freezes this piece
  for (const other of allPieces) {
    if (doesFreeze(other, piece)) {
      return true;
    }
  }

  return false;
}

/**
 * Update frozen states for all pieces on the board
 * Returns a new board state with updated isFrozen values
 */
export function updateFrozenStates(board: BoardState): BoardState {
  const piecesOnBoard = board.pieces.filter(p => p.position !== null);

  const updatedPieces = board.pieces.map(piece => {
    if (!piece.position) {
      // Captured pieces are not frozen
      return { ...piece, isFrozen: false };
    }

    const isFrozen = calculateFrozenState(piece, piecesOnBoard);

    // Only create a new object if the frozen state changed
    if (piece.isFrozen !== isFrozen) {
      return { ...piece, isFrozen };
    }

    return piece;
  });

  // Check if any pieces actually changed
  const hasChanges = updatedPieces.some((p, i) => p !== board.pieces[i]);

  if (!hasChanges) {
    return board;
  }

  return {
    ...board,
    pieces: updatedPieces,
    positionMap: createPositionMap(updatedPieces),
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get all pieces that are currently frozen
 */
export function getFrozenPieces(board: BoardState): PieceInstance[] {
  return board.pieces.filter(p => p.position !== null && p.isFrozen);
}

/**
 * Get all freezer pieces for a given color
 */
export function getFreezers(board: BoardState, color: PlayerColor): PieceInstance[] {
  return board.pieces.filter(p => {
    if (p.position === null) return false;
    if (p.owner !== color) return false;
    return isFreezer(p) || isChameleon(p);
  });
}

/**
 * Check if a specific piece is frozen
 */
export function isPieceFrozen(board: BoardState, pieceId: string): boolean {
  const piece = board.pieces.find(p => p.id === pieceId);
  return piece?.isFrozen ?? false;
}

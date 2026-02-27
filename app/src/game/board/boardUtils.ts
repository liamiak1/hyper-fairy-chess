/**
 * Board utility functions for position manipulation and board state helpers
 */

import type {
  File,
  Rank,
  Position,
  BoardDimensions,
  BoardState,
  PieceInstance,
  PlayerColor,
} from '../types';
import { positionToString } from '../types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';

// =============================================================================
// File/Rank Conversion
// =============================================================================

const FILES: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

export function fileToIndex(file: File): number {
  return FILES.indexOf(file);
}

export function indexToFile(index: number): File | null {
  if (index < 0 || index >= FILES.length) return null;
  return FILES[index];
}

// =============================================================================
// Position Manipulation
// =============================================================================

/**
 * Offset a position by dx (files) and dy (ranks)
 * Returns null if the resulting position would be off the board
 */
export function offsetPosition(
  pos: Position,
  dx: number,
  dy: number,
  dimensions: BoardDimensions
): Position | null {
  const newFileIndex = fileToIndex(pos.file) + dx;
  const newRank = pos.rank + dy;

  if (newFileIndex < 0 || newFileIndex >= dimensions.files) return null;
  if (newRank < 1 || newRank > dimensions.ranks) return null;

  const newFile = indexToFile(newFileIndex);
  if (!newFile) return null;

  return { file: newFile, rank: newRank as Rank };
}

/**
 * Check if a position is valid within the given board dimensions
 */
export function isValidPosition(pos: Position, dimensions: BoardDimensions): boolean {
  const fileIndex = fileToIndex(pos.file);
  return (
    fileIndex >= 0 &&
    fileIndex < dimensions.files &&
    pos.rank >= 1 &&
    pos.rank <= dimensions.ranks
  );
}

/**
 * Get the distance between two positions (Chebyshev distance)
 */
export function getDistance(from: Position, to: Position): number {
  const dx = Math.abs(fileToIndex(to.file) - fileToIndex(from.file));
  const dy = Math.abs(to.rank - from.rank);
  return Math.max(dx, dy);
}

/**
 * Check if two positions are adjacent (including diagonally)
 */
export function areAdjacent(a: Position, b: Position): boolean {
  return getDistance(a, b) === 1;
}

// =============================================================================
// Board State Helpers
// =============================================================================

/**
 * Get the piece at a given position, or null if empty
 */
export function getPieceAt(board: BoardState, pos: Position): PieceInstance | null {
  const posKey = positionToString(pos);
  const pieceId = board.positionMap.get(posKey);
  if (!pieceId) return null;
  return board.pieces.find((p) => p.id === pieceId) ?? null;
}

/**
 * Get a piece by its ID
 */
export function getPieceById(board: BoardState, id: string): PieceInstance | null {
  return board.pieces.find((p) => p.id === id) ?? null;
}

/**
 * Get the royal piece (King or king-replacing piece) for a given color
 * Looks for pieces with isRoyal: true (King, Phantom King, Regent)
 */
export function getKing(board: BoardState, color: PlayerColor): PieceInstance | null {
  return board.pieces.find((p) => {
    if (p.owner !== color || p.position === null) return false;
    const pieceType = PIECE_BY_ID[p.typeId];
    return pieceType?.isRoyal === true;
  }) ?? null;
}

/**
 * Get all pieces for a given color that are still on the board
 */
export function getAllPieces(board: BoardState, color: PlayerColor): PieceInstance[] {
  return board.pieces.filter((p) => p.owner === color && p.position !== null);
}

/**
 * Get all pieces of a specific type for a color
 */
export function getPiecesOfType(
  board: BoardState,
  color: PlayerColor,
  typeId: string
): PieceInstance[] {
  return board.pieces.filter(
    (p) => p.owner === color && p.typeId === typeId && p.position !== null
  );
}

/**
 * Check if a square is empty
 */
export function isSquareEmpty(board: BoardState, pos: Position): boolean {
  return getPieceAt(board, pos) === null;
}

/**
 * Check if a square contains an enemy piece
 */
export function hasEnemyPiece(
  board: BoardState,
  pos: Position,
  friendlyColor: PlayerColor
): boolean {
  const piece = getPieceAt(board, pos);
  return piece !== null && piece.owner !== friendlyColor;
}

/**
 * Check if a square contains an enemy piece that CAN be captured
 * (Fool and Jester have canBeCaptured: false)
 */
export function hasCapturableEnemyPiece(
  board: BoardState,
  pos: Position,
  friendlyColor: PlayerColor
): boolean {
  const piece = getPieceAt(board, pos);
  if (!piece || piece.owner === friendlyColor) return false;

  const pieceType = PIECE_BY_ID[piece.typeId];
  return pieceType?.canBeCaptured !== false;
}

/**
 * Check if a square contains a friendly piece
 */
export function hasFriendlyPiece(
  board: BoardState,
  pos: Position,
  friendlyColor: PlayerColor
): boolean {
  const piece = getPieceAt(board, pos);
  return piece !== null && piece.owner === friendlyColor;
}

// =============================================================================
// Board State Manipulation
// =============================================================================

/**
 * Create a position map from a list of pieces
 */
export function createPositionMap(pieces: PieceInstance[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const piece of pieces) {
    if (piece.position) {
      map.set(positionToString(piece.position), piece.id);
    }
  }
  return map;
}

/**
 * Clone a board state (deep copy)
 */
export function cloneBoardState(board: BoardState): BoardState {
  const clonedPieces = board.pieces.map((p) => ({
    ...p,
    position: p.position ? { ...p.position } : null,
  }));

  return {
    dimensions: { ...board.dimensions },
    pieces: clonedPieces,
    positionMap: createPositionMap(clonedPieces),
    // Preserve royalty tracking for Regent logic
    hadMultipleRoyals: board.hadMultipleRoyals
      ? { ...board.hadMultipleRoyals }
      : undefined,
  };
}

/**
 * Create an initial board state with given pieces
 */
export function createBoardState(
  dimensions: BoardDimensions,
  pieces: PieceInstance[]
): BoardState {
  return {
    dimensions,
    pieces,
    positionMap: createPositionMap(pieces),
  };
}

/**
 * Count royalty-tier pieces for a player (Queen, Fairy Queen, Withdrawer, Jester, etc.)
 * Used for Regent logic - Regent gains queen powers when other royalty is captured
 */
export function countRoyaltyTierPieces(pieces: PieceInstance[], color: PlayerColor): number {
  let count = 0;
  for (const piece of pieces) {
    if (piece.owner === color) {
      const pieceType = PIECE_BY_ID[piece.typeId];
      if (pieceType?.tier === 'royalty') {
        count++;
      }
    }
  }
  return count;
}

/**
 * Initialize hadMultipleRoyals tracking based on current pieces
 * Call this at the end of placement phase
 * Tracks royalty-tier pieces (not just isRoyal) for Regent logic
 */
export function initializeRoyalTracking(board: BoardState): BoardState {
  const whiteRoyalty = countRoyaltyTierPieces(board.pieces, 'white');
  const blackRoyalty = countRoyaltyTierPieces(board.pieces, 'black');

  return {
    ...board,
    hadMultipleRoyals: {
      white: whiteRoyalty > 1,
      black: blackRoyalty > 1,
    },
  };
}

/**
 * Update a piece's position in the board state
 * Returns a new board state (immutable update)
 */
export function movePiece(
  board: BoardState,
  pieceId: string,
  newPosition: Position | null
): BoardState {
  const newPieces = board.pieces.map((p) => {
    if (p.id === pieceId) {
      return { ...p, position: newPosition, hasMoved: true };
    }
    return p;
  });

  return {
    ...board,
    pieces: newPieces,
    positionMap: createPositionMap(newPieces),
  };
}

/**
 * Remove a piece from the board (set position to null)
 */
export function removePiece(board: BoardState, pieceId: string): BoardState {
  return movePiece(board, pieceId, null);
}

// =============================================================================
// Direction Vectors
// =============================================================================

export interface DirectionVector {
  dx: number;
  dy: number;
}

export const ORTHOGONAL_DIRECTIONS: DirectionVector[] = [
  { dx: 0, dy: 1 },   // up
  { dx: 0, dy: -1 },  // down
  { dx: 1, dy: 0 },   // right
  { dx: -1, dy: 0 },  // left
];

export const DIAGONAL_DIRECTIONS: DirectionVector[] = [
  { dx: 1, dy: 1 },   // up-right
  { dx: 1, dy: -1 },  // down-right
  { dx: -1, dy: 1 },  // up-left
  { dx: -1, dy: -1 }, // down-left
];

export const ALL_DIRECTIONS: DirectionVector[] = [
  ...ORTHOGONAL_DIRECTIONS,
  ...DIAGONAL_DIRECTIONS,
];

/**
 * Get direction vectors for a slide direction type
 */
export function getDirectionVectors(slideDir: 'orthogonal' | 'diagonal' | 'all'): DirectionVector[] {
  switch (slideDir) {
    case 'orthogonal':
      return ORTHOGONAL_DIRECTIONS;
    case 'diagonal':
      return DIAGONAL_DIRECTIONS;
    case 'all':
      return ALL_DIRECTIONS;
  }
}

// =============================================================================
// Leap Offset Expansion
// =============================================================================

/**
 * Expand a leap offset with symmetry into all actual offsets
 * For example, (2,1) symmetric becomes all 8 knight moves
 */
export function expandLeapOffset(leap: { dx: number; dy: number; symmetric: boolean }): DirectionVector[] {
  if (!leap.symmetric) {
    return [{ dx: leap.dx, dy: leap.dy }];
  }

  const offsets: DirectionVector[] = [];
  const { dx, dy } = leap;

  // Add all sign combinations
  const signs = [1, -1];
  for (const sx of signs) {
    for (const sy of signs) {
      offsets.push({ dx: dx * sx, dy: dy * sy });
      // If dx !== dy, also swap them
      if (dx !== dy) {
        offsets.push({ dx: dy * sx, dy: dx * sy });
      }
    }
  }

  // Remove duplicates (e.g., when dx or dy is 0)
  const seen = new Set<string>();
  return offsets.filter((o) => {
    const key = `${o.dx},${o.dy}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =============================================================================
// Pawn Helpers
// =============================================================================

/**
 * Get the forward direction for a player color
 */
export function getPawnDirection(color: PlayerColor): number {
  return color === 'white' ? 1 : -1;
}

/**
 * Get the starting rank for pawns of a given color
 */
export function getPawnStartRank(color: PlayerColor): Rank {
  return color === 'white' ? 2 : 7;
}

/**
 * Get the promotion rank for a given color
 */
export function getPromotionRank(color: PlayerColor, dimensions: BoardDimensions): Rank {
  return color === 'white' ? (dimensions.ranks as Rank) : 1;
}

/**
 * Check if a pawn can double-move from its current position
 */
export function canPawnDoubleMove(piece: PieceInstance, color: PlayerColor): boolean {
  if (!piece.position) return false;
  if (piece.hasMoved) return false;

  // Can double move from rank 1 or 2 (for white) or rank 7 or 8 (for black)
  // Based on PLANNING.md rules
  if (color === 'white') {
    return piece.position.rank <= 2;
  } else {
    return piece.position.rank >= 7;
  }
}

// =============================================================================
// Castling Helpers
// =============================================================================

/**
 * Get the home rank for a player
 */
export function getHomeRank(color: PlayerColor): Rank {
  return color === 'white' ? 1 : 8;
}

/**
 * Get the opponent's color
 */
export function getOpponentColor(color: PlayerColor): PlayerColor {
  return color === 'white' ? 'black' : 'white';
}

// =============================================================================
// Capture Type Helpers
// =============================================================================

/**
 * Check if a piece can capture by displacement (landing on enemy piece)
 * Pieces with special capture types (coordinator, boxer, withdrawal, thief, long-leap, none)
 * cannot capture by displacement - they have other capture mechanics
 */
export function canCaptureByDisplacement(piece: PieceInstance): boolean {
  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return false;

  // These capture types cannot capture by landing on pieces
  const nonDisplacementCaptures = ['coordinator', 'boxer', 'withdrawal', 'thief', 'long-leap', 'none'];
  return !nonDisplacementCaptures.includes(pieceType.captureType);
}

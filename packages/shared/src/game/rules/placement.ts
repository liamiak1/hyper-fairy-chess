/**
 * Piece placement logic for the placement phase
 */

import type {
  Position,
  BoardState,
  BoardSize,
  PieceInstance,
  PieceTier,
  PlayerColor,
  File,
  Rank,
} from '../types';
import { BOARD_CONFIGS, positionToString } from '../types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import type { PlayerDraft } from './draft';
import { createPiecesFromDraft } from './draft';

// =============================================================================
// Types
// =============================================================================

export interface PlacementZone {
  position: Position;
  allowedTiers: PieceTier[];
}

export interface PlacementState {
  whitePiecesToPlace: PieceInstance[];
  blackPiecesToPlace: PieceInstance[];
  currentPlacer: PlayerColor;
  selectedPieceId: string | null;
  mode: 'alternating' | 'blind';
  whiteReady: boolean;
  blackReady: boolean;
}

// =============================================================================
// Placement Zone Definitions
// =============================================================================

const ALL_FILES: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

/**
 * Get piece files for a given board width (edge files, excluding center 2 for royalty)
 * For 8 files: a, b, c, f, g, h (4 pieces per side, 2 center for royalty)
 * For 10 files: a, b, c, d, g, h, i, j (4 pieces per side, 2 center for royalty)
 */
function getPieceFiles(numFiles: number): File[] {
  const allFiles = ALL_FILES.slice(0, numFiles);
  const centerIndex = Math.floor(numFiles / 2);
  // Exclude the center 2 files (royalty positions)
  return allFiles.filter((_, i) => i < centerIndex - 1 || i > centerIndex);
}

/**
 * Get royalty files (center 2 files)
 * For 8 files: d, e (indices 3, 4)
 * For 10 files: e, f (indices 4, 5)
 */
function getRoyaltyFiles(numFiles: number): File[] {
  const centerIndex = Math.floor(numFiles / 2);
  return [ALL_FILES[centerIndex - 1], ALL_FILES[centerIndex]];
}

/**
 * Get herald files (first and last file of the board)
 */
function getHeraldFiles(numFiles: number): File[] {
  return [ALL_FILES[0], ALL_FILES[numFiles - 1]];
}

/**
 * Get placement zones for a player on a given board size
 */
export function getPlacementZones(boardSize: BoardSize, color: PlayerColor): PlacementZone[] {
  const config = BOARD_CONFIGS[boardSize];
  const zones: PlacementZone[] = [];

  // Determine ranks based on color
  const backRank: Rank = color === 'white' ? 1 : (config.ranks as Rank);
  const pawnRank: Rank = color === 'white' ? 2 : ((config.ranks - 1) as Rank);

  // Get available files based on board size
  const allFiles = ALL_FILES.slice(0, config.files);
  const royaltyFiles = getRoyaltyFiles(config.files);
  const pieceFiles = getPieceFiles(config.files);

  // Back rank - pieces (Tier 2) on edges, royalty (Tier 3) in center
  for (const file of allFiles) {
    const position: Position = { file, rank: backRank };

    if (royaltyFiles.includes(file)) {
      // Center squares for royalty
      zones.push({ position, allowedTiers: ['royalty'] });
    } else if (pieceFiles.includes(file)) {
      // Edge squares for pieces
      zones.push({ position, allowedTiers: ['piece'] });
    }
  }

  // Pawn rank - all squares for pawns (Tier 1)
  for (const file of allFiles) {
    const position: Position = { file, rank: pawnRank };
    zones.push({ position, allowedTiers: ['pawn'] });
  }

  return zones;
}

/**
 * Get valid placement squares for a piece
 */
export function getValidPlacementSquares(
  board: BoardState,
  piece: PieceInstance,
  zones: PlacementZone[],
  dimensions?: { ranks: number; files: number }
): Position[] {
  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return [];

  const validSquares: Position[] = [];
  const isHeraldPiece = piece.typeId === 'herald';
  const isPawn = pieceType.tier === 'pawn';
  const heraldFiles = dimensions ? getHeraldFiles(dimensions.files) : getHeraldFiles(8);

  for (const zone of zones) {
    // Check if this zone allows this piece's tier
    if (!zone.allowedTiers.includes(pieceType.tier)) continue;

    // Herald can only be placed on edge files
    if (isHeraldPiece && !heraldFiles.includes(zone.position.file)) continue;

    // Check if the square is empty
    const posKey = positionToString(zone.position);
    if (board.positionMap.has(posKey)) continue;

    // Block non-pawn pieces from back rank squares where a Herald occupies the pawn rank
    // (those squares are reserved for pawns only once a Herald is there)
    if (pieceType.tier === 'piece' && dimensions && heraldFiles.includes(zone.position.file)) {
      const backRank: Rank = piece.owner === 'white' ? 1 : (dimensions.ranks as Rank);
      if (zone.position.rank === backRank) {
        // Check if there's a Herald on the pawn rank in this file
        const pawnRank: Rank = piece.owner === 'white' ? 2 : ((dimensions.ranks - 1) as Rank);
        const pawnPosKey = positionToString({ file: zone.position.file, rank: pawnRank });
        const pieceIdOnPawnRank = board.positionMap.get(pawnPosKey);
        if (pieceIdOnPawnRank) {
          const pieceOnPawnRank = board.pieces.find((p) => p.id === pieceIdOnPawnRank);
          if (pieceOnPawnRank?.typeId === 'herald') {
            continue; // Skip this square - Herald is present, only pawns allowed here
          }
        }
      }
    }

    validSquares.push(zone.position);
  }

  // Special handling for pawns: allow back rank positions where Herald is present
  if (isPawn && dimensions) {
    for (const file of heraldFiles) {
      // Check if there's a Herald on the pawn rank in this file
      const pawnRank: Rank = piece.owner === 'white' ? 2 : ((dimensions.ranks - 1) as Rank);
      const pawnPosKey = positionToString({ file, rank: pawnRank });
      const pieceIdOnPawnRank = board.positionMap.get(pawnPosKey);

      if (pieceIdOnPawnRank) {
        const pieceOnPawnRank = board.pieces.find((p) => p.id === pieceIdOnPawnRank);
        if (pieceOnPawnRank?.typeId === 'herald') {
          // Herald is in this file's pawn rank - pawn can go to back rank
          const backRank: Rank = piece.owner === 'white' ? 1 : (dimensions.ranks as Rank);
          const backRankPos: Position = { file, rank: backRank };
          const backRankPosKey = positionToString(backRankPos);

          // Check if back rank position is empty
          if (!board.positionMap.has(backRankPosKey)) {
            // Avoid duplicates
            if (!validSquares.some((p) => p.file === file && p.rank === backRank)) {
              validSquares.push(backRankPos);
            }
          }
        }
      }
    }
  }

  return validSquares;
}

/**
 * Check if a placement is valid
 */
export function isValidPlacement(
  board: BoardState,
  piece: PieceInstance,
  position: Position,
  zones: PlacementZone[]
): boolean {
  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return false;

  // Check if square is empty first
  const posKey = positionToString(position);
  if (board.positionMap.has(posKey)) return false;

  const heraldFiles = getHeraldFiles(board.dimensions.files);

  // Special case: Pawns can be placed on back rank if Herald is on pawn rank in that file
  if (pieceType.tier === 'pawn' && heraldFiles.includes(position.file)) {
    const backRank: Rank = piece.owner === 'white' ? 1 : (board.dimensions.ranks as Rank);
    if (position.rank === backRank) {
      // Check if there's a Herald on the pawn rank in this file
      const pawnRank: Rank = piece.owner === 'white' ? 2 : ((board.dimensions.ranks - 1) as Rank);
      const pawnRankPosKey = positionToString({ file: position.file, rank: pawnRank });
      const pieceIdOnPawnRank = board.positionMap.get(pawnRankPosKey);

      if (pieceIdOnPawnRank) {
        const pieceOnPawnRank = board.pieces.find((p) => p.id === pieceIdOnPawnRank);
        if (pieceOnPawnRank?.typeId === 'herald') {
          return true; // Valid - Herald is present, pawn can go to back rank
        }
      }
      return false; // Back rank not valid without Herald
    }
  }

  // Block non-pawn pieces from back rank squares where a Herald occupies the pawn rank
  if (pieceType.tier === 'piece' && heraldFiles.includes(position.file)) {
    const backRank: Rank = piece.owner === 'white' ? 1 : (board.dimensions.ranks as Rank);
    if (position.rank === backRank) {
      // Check if there's a Herald on the pawn rank in this file
      const pawnRank: Rank = piece.owner === 'white' ? 2 : ((board.dimensions.ranks - 1) as Rank);
      const pawnRankPosKey = positionToString({ file: position.file, rank: pawnRank });
      const pieceIdOnPawnRank = board.positionMap.get(pawnRankPosKey);
      if (pieceIdOnPawnRank) {
        const pieceOnPawnRank = board.pieces.find((p) => p.id === pieceIdOnPawnRank);
        if (pieceOnPawnRank?.typeId === 'herald') {
          return false; // Invalid - Herald is present, only pawns allowed here
        }
      }
    }
  }

  // Find the zone for this position
  const zone = zones.find(
    (z) => z.position.file === position.file && z.position.rank === position.rank
  );

  if (!zone) return false;

  // Check if tier is allowed
  if (!zone.allowedTiers.includes(pieceType.tier)) return false;

  return true;
}

// =============================================================================
// Army Creation
// =============================================================================

let pieceIdCounter = 0;

function createPieceInstance(typeId: string, owner: PlayerColor): PieceInstance {
  return {
    id: `${owner}-${typeId}-${pieceIdCounter++}`,
    typeId,
    owner,
    position: null, // No position during placement phase
    hasMoved: false,
    isFrozen: false,
  };
}

/**
 * Create the standard chess army for a player (pieces without positions)
 */
export function createStandardArmyPieces(color: PlayerColor): PieceInstance[] {
  const pieces: PieceInstance[] = [];

  // Royalty (Tier 3)
  pieces.push(createPieceInstance('king', color));
  pieces.push(createPieceInstance('queen', color));

  // Pieces (Tier 2)
  pieces.push(createPieceInstance('rook', color));
  pieces.push(createPieceInstance('rook', color));
  pieces.push(createPieceInstance('knight', color));
  pieces.push(createPieceInstance('knight', color));
  pieces.push(createPieceInstance('bishop', color));
  pieces.push(createPieceInstance('bishop', color));

  // Pawns (Tier 1)
  for (let i = 0; i < 8; i++) {
    pieces.push(createPieceInstance('pawn', color));
  }

  return pieces;
}

/**
 * Create initial placement state for a new game
 */
export function createInitialPlacementState(): PlacementState {
  // Reset counter for consistent IDs in new games
  pieceIdCounter = 0;

  return {
    whitePiecesToPlace: createStandardArmyPieces('white'),
    blackPiecesToPlace: createStandardArmyPieces('black'),
    currentPlacer: 'white',
    selectedPieceId: null,
    mode: 'alternating',
    whiteReady: false,
    blackReady: false,
  };
}

/**
 * Get pieces remaining to be placed for a player
 */
export function getPiecesToPlace(state: PlacementState, color: PlayerColor): PieceInstance[] {
  return color === 'white' ? state.whitePiecesToPlace : state.blackPiecesToPlace;
}

/**
 * Check if all pieces have been placed
 */
export function isPlacementComplete(state: PlacementState): boolean {
  return state.whitePiecesToPlace.length === 0 && state.blackPiecesToPlace.length === 0;
}

/**
 * Get the next placer after a piece is placed
 */
export function getNextPlacer(state: PlacementState, currentPlacer: PlayerColor): PlayerColor {
  const otherColor = currentPlacer === 'white' ? 'black' : 'white';
  const otherPieces = getPiecesToPlace(state, otherColor);

  // If other player still has pieces, they go next
  if (otherPieces.length > 0) {
    return otherColor;
  }

  // Otherwise current player continues (if they have pieces left)
  return currentPlacer;
}

/**
 * Create placement state from completed drafts
 */
export function createPlacementStateFromDrafts(
  whiteDraft: PlayerDraft,
  blackDraft: PlayerDraft,
  mode: 'alternating' | 'blind' = 'alternating'
): PlacementState {
  return {
    whitePiecesToPlace: createPiecesFromDraft(whiteDraft, 'white'),
    blackPiecesToPlace: createPiecesFromDraft(blackDraft, 'black'),
    currentPlacer: 'white',
    selectedPieceId: null,
    mode,
    whiteReady: false,
    blackReady: false,
  };
}

// =============================================================================
// Herald Placement Special Rules
// =============================================================================

/**
 * Check if a piece is a Herald (for special placement rules)
 */
export function isHerald(piece: PieceInstance): boolean {
  return piece.typeId === 'herald';
}

/**
 * Get the actual position where a Herald should be placed.
 * Heralds go on the pawn rank, not the back rank.
 */
export function getHeraldActualPosition(
  clickedPosition: Position,
  color: PlayerColor,
  dimensions: { ranks: number }
): Position {
  const pawnRank: Rank = color === 'white' ? 2 : ((dimensions.ranks - 1) as Rank);
  return {
    file: clickedPosition.file,
    rank: pawnRank,
  };
}

/**
 * Get the back rank position for a pawn that swaps with a Herald.
 */
export function getPawnSwapPosition(
  file: File,
  color: PlayerColor,
  dimensions: { ranks: number }
): Position {
  const backRank: Rank = color === 'white' ? 1 : (dimensions.ranks as Rank);
  return {
    file,
    rank: backRank,
  };
}

/**
 * Find a pawn in the pieces-to-place list that would be swapped with a Herald.
 * Returns the pawn if found, null otherwise.
 */
export function findPawnForHeraldSwap(
  piecesToPlace: PieceInstance[],
  _heraldFile: File
): PieceInstance | null {
  // Find any pawn - the specific file doesn't matter until placement
  // but we return the first pawn to indicate one exists for swapping
  const pawns = piecesToPlace.filter((p) => {
    const pieceType = PIECE_BY_ID[p.typeId];
    return pieceType && pieceType.tier === 'pawn';
  });
  return pawns.length > 0 ? pawns[0] : null;
}

/**
 * Check if a pawn should be placed on the back rank due to a Herald in that file.
 */
export function shouldPawnSwapToBackRank(
  board: BoardState,
  pawnFile: File,
  color: PlayerColor,
  dimensions: { ranks: number }
): boolean {
  const pawnRank: Rank = color === 'white' ? 2 : ((dimensions.ranks - 1) as Rank);
  const pawnRankPos = positionToString({ file: pawnFile, rank: pawnRank });

  // Check if there's a Herald on the pawn rank in this file
  const pieceId = board.positionMap.get(pawnRankPos);
  if (!pieceId) return false;

  const piece = board.pieces.find((p) => p.id === pieceId);
  return piece?.typeId === 'herald';
}

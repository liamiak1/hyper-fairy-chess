/**
 * Pawn promotion handling
 */

import type {
  Position,
  BoardDimensions,
  PieceInstance,
  PieceType,
  GameState,
} from '../types';
import { PIECE_BY_ID, ALL_PIECES } from '../pieces/pieceDefinitions';
import { getPromotionRank } from '../board/boardUtils';

// =============================================================================
// Promotion Detection
// =============================================================================

/**
 * Check if a move is a promotion move
 */
export function isPromotionMove(
  piece: PieceInstance,
  pieceType: PieceType,
  to: Position,
  dimensions: BoardDimensions
): boolean {
  // Only pawn-type pieces can promote
  if (!isPawnType(pieceType)) return false;

  // Check if reaching promotion rank
  const promotionRank = getPromotionRank(piece.owner, dimensions);
  return to.rank === promotionRank;
}

/**
 * Check if a piece type is a pawn (can promote)
 */
export function isPawnType(pieceType: PieceType): boolean {
  // Pieces with pawn-forward movement are pawn types
  return (
    pieceType.movement.special.includes('pawn-forward') ||
    pieceType.movement.special.includes('shogi-pawn') ||
    pieceType.movement.special.includes('berolina') ||
    pieceType.movement.special.includes('peasant-diagonal')
  );
}

// =============================================================================
// Promotion Options
// =============================================================================

/**
 * Get available promotion options for standard chess
 */
export function getStandardPromotionOptions(): PieceType[] {
  return [
    PIECE_BY_ID['queen'],
    PIECE_BY_ID['rook'],
    PIECE_BY_ID['bishop'],
    PIECE_BY_ID['knight'],
  ].filter((p): p is PieceType => p !== undefined);
}

/**
 * Get available promotion options for Hyper Fairy Chess
 * Promote to any capturing piece/royalty in the game (excludes Kings, non-capturing pieces, and pawns)
 */
export function getPromotionOptions(gameState: GameState): PieceType[] {
  // Get all piece types currently in the game
  const pieceTypesInGame = new Set<string>();

  for (const piece of gameState.board.pieces) {
    pieceTypesInGame.add(piece.typeId);
  }

  // Filter to capturing pieces only
  return ALL_PIECES.filter((pt) => {
    // Must be in the current game
    if (!pieceTypesInGame.has(pt.id)) return false;

    // Exclude pawn-tier pieces (can't promote to another pawn)
    if (pt.tier === 'pawn') return false;

    // Exclude kings (royal mandatory pieces)
    if (pt.isRoyal && pt.isMandatory) return false;

    // Exclude king-replacing pieces (Regent, Phantom King)
    if (pt.replacesKing) return false;

    // Exclude non-capturing pieces (Immobilizer, Herald, Inquisitor, Jester)
    if (pt.captureType === 'none') return false;

    return true;
  });
}

/**
 * Get promotion options for a specific piece type
 * Special case: Fool can only promote to Jester
 */
export function getPromotionOptionsForPiece(
  pieceType: PieceType,
  gameState: GameState
): PieceType[] {
  // Fool special rule: can only promote to Jester
  if (pieceType.id === 'fool') {
    const jester = PIECE_BY_ID['jester'];
    return jester ? [jester] : [];
  }

  // Use game-aware promotion options (fairy pieces in current game)
  const options = getPromotionOptions(gameState);

  // If no fairy pieces available, fall back to standard options
  if (options.length === 0) {
    return getStandardPromotionOptions();
  }

  return options;
}

// =============================================================================
// Promotion Validation
// =============================================================================

/**
 * Check if a promotion piece type is valid
 */
export function isValidPromotionChoice(
  pieceType: PieceType,
  promotionTypeId: string,
  currentGameState: GameState
): boolean {
  const options = getPromotionOptionsForPiece(pieceType, currentGameState);
  return options.some((opt) => opt.id === promotionTypeId);
}

/**
 * Get the default promotion piece (Queen for standard chess)
 */
export function getDefaultPromotionPiece(): PieceType {
  return PIECE_BY_ID['queen']!;
}

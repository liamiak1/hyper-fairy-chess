/**
 * Game end detection - checkmate, stalemate, and other end conditions
 */

import type {
  GameState,
  GameResult,
  PlayerColor,
  BoardState,
} from '../types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import { getAllPieces, getOpponentColor } from '../board/boardUtils';
import { isInCheck, hasAnyLegalMoves } from './checkDetection';

// =============================================================================
// Game Result Detection
// =============================================================================

/**
 * Check if a king has been captured (failsafe - should not happen in normal play)
 */
function isKingCaptured(board: BoardState, color: PlayerColor): boolean {
  const pieces = getAllPieces(board, color);
  // Check if any royal piece exists
  for (const piece of pieces) {
    const pieceType = PIECE_BY_ID[piece.typeId];
    if (pieceType?.isRoyal) {
      return false; // King exists, not captured
    }
  }
  return true; // No royal piece found - king was captured
}

/**
 * Check if the game has ended and return the result
 */
export function getGameResult(gameState: GameState): GameResult | null {
  // If result is already set (resignation, timeout, etc.), return it
  if (gameState.result) return gameState.result;

  // Check for 50-move rule (100 half-moves without pawn move or capture)
  if (gameState.halfmoveClock >= 100) {
    return {
      type: 'draw-fifty-move',
      winner: null,
      whiteVP: calculateVictoryPoints(gameState.board, 'white'),
      blackVP: calculateVictoryPoints(gameState.board, 'black'),
    };
  }

  // Check for threefold repetition
  if (isThreefoldRepetition(gameState)) {
    return {
      type: 'draw-repetition',
      winner: null,
      whiteVP: calculateVictoryPoints(gameState.board, 'white'),
      blackVP: calculateVictoryPoints(gameState.board, 'black'),
    };
  }

  // FAILSAFE: Check if a king was captured (should not happen in normal play)
  // This handles edge cases where check detection might have bugs
  if (isKingCaptured(gameState.board, 'white')) {
    return {
      type: 'checkmate',
      winner: 'black',
      whiteVP: calculateVictoryPoints(gameState.board, 'white'),
      blackVP: calculateVictoryPoints(gameState.board, 'black'),
    };
  }
  if (isKingCaptured(gameState.board, 'black')) {
    return {
      type: 'checkmate',
      winner: 'white',
      whiteVP: calculateVictoryPoints(gameState.board, 'white'),
      blackVP: calculateVictoryPoints(gameState.board, 'black'),
    };
  }

  const currentPlayer = gameState.currentTurn;
  const hasLegalMoves = hasAnyLegalMoves(
    gameState.board,
    currentPlayer,
    gameState.enPassantTarget
  );

  if (!hasLegalMoves) {
    // No legal moves - either checkmate or stalemate
    if (isInCheck(gameState.board, currentPlayer)) {
      // Checkmate - opponent wins
      return {
        type: 'checkmate',
        winner: getOpponentColor(currentPlayer),
        whiteVP: calculateVictoryPoints(gameState.board, 'white'),
        blackVP: calculateVictoryPoints(gameState.board, 'black'),
      };
    } else {
      // Stalemate - determine winner by Victory Points
      const whiteVP = calculateVictoryPoints(gameState.board, 'white');
      const blackVP = calculateVictoryPoints(gameState.board, 'black');

      if (whiteVP > blackVP) {
        return {
          type: 'stalemate',
          winner: 'white',
          whiteVP,
          blackVP,
        };
      } else if (blackVP > whiteVP) {
        return {
          type: 'stalemate',
          winner: 'black',
          whiteVP,
          blackVP,
        };
      } else {
        // Equal VP - draw
        return {
          type: 'draw-vp-tie',
          winner: null,
          whiteVP,
          blackVP,
        };
      }
    }
  }

  // Game continues
  return null;
}

// =============================================================================
// Specific Condition Checks
// =============================================================================

/**
 * Check if the current position is checkmate
 */
export function isCheckmate(gameState: GameState): boolean {
  const currentPlayer = gameState.currentTurn;

  if (!isInCheck(gameState.board, currentPlayer)) {
    return false;
  }

  return !hasAnyLegalMoves(gameState.board, currentPlayer, gameState.enPassantTarget);
}

/**
 * Check if the current position is stalemate
 */
export function isStalemate(gameState: GameState): boolean {
  const currentPlayer = gameState.currentTurn;

  if (isInCheck(gameState.board, currentPlayer)) {
    return false;
  }

  return !hasAnyLegalMoves(gameState.board, currentPlayer, gameState.enPassantTarget);
}

/**
 * Check if the game is a draw
 */
export function isDraw(gameState: GameState): boolean {
  const result = getGameResult(gameState);
  return result !== null && result.winner === null;
}

// =============================================================================
// Draw Rule Detection
// =============================================================================

/**
 * Check for threefold repetition (same position occurred 3+ times)
 */
export function isThreefoldRepetition(gameState: GameState): boolean {
  if (gameState.positionHistory.length < 3) return false;

  // Get the current position hash (last entry in history)
  const currentHash = gameState.positionHistory[gameState.positionHistory.length - 1];
  if (!currentHash) return false;

  // Count occurrences of the current position
  let count = 0;
  for (const hash of gameState.positionHistory) {
    if (hash === currentHash) {
      count++;
      if (count >= 3) return true;
    }
  }

  return false;
}

/**
 * Check if 50-move rule draw is approaching (within 1 move)
 * Returns true when halfmoveClock >= 98 (1 full move = 2 half-moves away)
 */
export function isNearFiftyMoveRule(gameState: GameState): boolean {
  return gameState.halfmoveClock >= 98;
}

/**
 * Check if threefold repetition is approaching (position seen 2 times)
 */
export function isNearThreefoldRepetition(gameState: GameState): boolean {
  if (gameState.positionHistory.length < 2) return false;

  // Get the current position hash
  const currentHash = gameState.positionHistory[gameState.positionHistory.length - 1];
  if (!currentHash) return false;

  // Count occurrences - return true if we've seen this position exactly 2 times
  let count = 0;
  for (const hash of gameState.positionHistory) {
    if (hash === currentHash) {
      count++;
    }
  }

  return count === 2;
}

// =============================================================================
// Victory Points Calculation
// =============================================================================

/**
 * Calculate total Victory Points for a player's remaining pieces
 */
export function calculateVictoryPoints(board: BoardState, color: PlayerColor): number {
  const pieces = getAllPieces(board, color);
  let totalVP = 0;

  for (const piece of pieces) {
    const pieceType = PIECE_BY_ID[piece.typeId];
    if (pieceType) {
      totalVP += pieceType.victoryPoints;
    }
  }

  return totalVP;
}

/**
 * Calculate total piece value (cost) for a player's remaining pieces
 */
export function calculatePieceValue(board: BoardState, color: PlayerColor): number {
  const pieces = getAllPieces(board, color);
  let totalValue = 0;

  for (const piece of pieces) {
    const pieceType = PIECE_BY_ID[piece.typeId];
    if (pieceType) {
      totalValue += pieceType.cost;
    }
  }

  return totalValue;
}

// =============================================================================
// Game Result Utilities
// =============================================================================

/**
 * Create a resignation result
 */
export function createResignationResult(resigningPlayer: PlayerColor): GameResult {
  return {
    type: 'resignation',
    winner: getOpponentColor(resigningPlayer),
    whiteVP: 0,
    blackVP: 0,
  };
}

/**
 * Create a timeout result
 */
export function createTimeoutResult(timedOutPlayer: PlayerColor): GameResult {
  return {
    type: 'timeout',
    winner: getOpponentColor(timedOutPlayer),
    whiteVP: 0,
    blackVP: 0,
  };
}

/**
 * Create a draw by agreement result
 */
export function createDrawAgreementResult(board: BoardState): GameResult {
  return {
    type: 'draw-agreement',
    winner: null,
    whiteVP: calculateVictoryPoints(board, 'white'),
    blackVP: calculateVictoryPoints(board, 'black'),
  };
}

/**
 * Create a 50-move rule draw result
 */
export function createFiftyMoveDrawResult(board: BoardState): GameResult {
  return {
    type: 'draw-fifty-move',
    winner: null,
    whiteVP: calculateVictoryPoints(board, 'white'),
    blackVP: calculateVictoryPoints(board, 'black'),
  };
}

/**
 * Create a threefold repetition draw result
 */
export function createRepetitionDrawResult(board: BoardState): GameResult {
  return {
    type: 'draw-repetition',
    winner: null,
    whiteVP: calculateVictoryPoints(board, 'white'),
    blackVP: calculateVictoryPoints(board, 'black'),
  };
}

/**
 * Get a human-readable description of the game result
 */
export function getResultDescription(result: GameResult): string {
  switch (result.type) {
    case 'checkmate':
      return `Checkmate! ${capitalize(result.winner!)} wins.`;

    case 'stalemate':
      if (result.winner) {
        return `Stalemate! ${capitalize(result.winner)} wins by Victory Points (${result.whiteVP} - ${result.blackVP}).`;
      }
      return `Stalemate! Draw by equal Victory Points (${result.whiteVP} - ${result.blackVP}).`;

    case 'draw-vp-tie':
      return `Draw by equal Victory Points (${result.whiteVP} - ${result.blackVP}).`;

    case 'resignation':
      return `${capitalize(result.winner!)} wins by resignation.`;

    case 'timeout':
      return `${capitalize(result.winner!)} wins on time.`;

    case 'draw-agreement':
      return 'Draw by agreement.';

    case 'draw-fifty-move':
      return 'Draw by 50-move rule.';

    case 'draw-repetition':
      return 'Draw by threefold repetition.';

    default:
      return 'Game over.';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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
import {
  getAllPieces,
  getOpponentColor,
  getActivePlayers,
  eliminatePlayer,
} from '../board/boardUtils';
import { TURN_ORDER } from '../types';
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
 * Victory Points for every colour with pieces on the board.
 *
 * Includes eliminated players: their pieces stay on the board as obstacles and
 * are still worth VP to whoever captures them.
 */
export function collectVictoryPoints(
  board: BoardState
): Partial<Record<PlayerColor, number>> {
  const vp: Partial<Record<PlayerColor, number>> = {};
  const active = getActivePlayers(board);
  for (const color of TURN_ORDER) {
    const points = calculateVictoryPoints(board, color);
    // Report a colour if it is playing, has pieces left, or is white/black
    // (so 2-player results keep their shape). A player still in the game
    // reports 0 rather than being absent.
    const isInGame = active.includes(color) || color === 'white' || color === 'black';
    if (isInGame || points > 0 || getAllPieces(board, color).length > 0) {
      vp[color] = points;
    }
  }
  return vp;
}

/** Build the VP fields shared by every GameResult. */
function vpFields(
  board: BoardState,
  eliminated?: PlayerColor[]
): Pick<GameResult, 'whiteVP' | 'blackVP' | 'victoryPoints' | 'eliminated'> {
  const victoryPoints = collectVictoryPoints(board);
  return {
    whiteVP: victoryPoints.white ?? 0,
    blackVP: victoryPoints.black ?? 0,
    victoryPoints,
    ...(eliminated && eliminated.length > 0 ? { eliminated } : {}),
  };
}

/**
 * Of the given players, the one with the most VP. Null if it is a tie.
 */
function highestVictoryPoints(
  board: BoardState,
  players: PlayerColor[]
): PlayerColor | null {
  let best: PlayerColor | null = null;
  let bestVP = -1;
  let tied = false;

  for (const color of players) {
    const vp = calculateVictoryPoints(board, color);
    if (vp > bestVP) {
      bestVP = vp;
      best = color;
      tied = false;
    } else if (vp === bestVP) {
      tied = true;
    }
  }

  return tied ? null : best;
}

/**
 * Which players have been knocked out, in TURN_ORDER order.
 *
 * Derived by comparing the board's active players against every colour that
 * still has pieces, so it stays correct without a separate audit trail.
 */
function getEliminatedPlayers(board: BoardState): PlayerColor[] {
  if (!board.activePlayers) return [];
  const active = board.activePlayers;
  return TURN_ORDER.filter(
    color => !active.includes(color) && getAllPieces(board, color).length > 0
  );
}

/**
 * Check if the game has ended and return the result.
 *
 * Two-player games keep their original semantics exactly: checkmate ends the
 * game, and stalemate is resolved on Victory Points.
 *
 * In 3-/4-player games elimination is applied by `resolveTurnTransition` as the
 * turn passes, so by the time this runs the board's `activePlayers` already
 * reflects who is left. This function only reports the outcome: the game is
 * over once a single player remains.
 */
export function getGameResult(gameState: GameState): GameResult | null {
  // If result is already set (resignation, timeout, etc.), return it
  if (gameState.result) return gameState.result;

  const board = gameState.board;
  const players = getActivePlayers(board);
  const eliminated = getEliminatedPlayers(board);

  // Check for 50-move rule (100 half-moves without pawn move or capture)
  if (gameState.halfmoveClock >= 100) {
    return {
      type: 'draw-fifty-move',
      winner: null,
      ...vpFields(board, eliminated),
    };
  }

  // Check for threefold repetition
  if (isThreefoldRepetition(gameState)) {
    return {
      type: 'draw-repetition',
      winner: null,
      ...vpFields(board, eliminated),
    };
  }

  // Multiplayer: eliminations have already been applied, so the game is over
  // once a single player is left standing.
  if (players.length <= 1) {
    return {
      type: 'checkmate',
      winner: players[0] ?? null,
      ...vpFields(board, eliminated),
    };
  }

  // FAILSAFE: a king was captured outright (should not happen in normal play,
  // since the move that would capture it is never legal). Whoever lost their
  // royal piece is out; if that leaves one player, they win.
  for (const color of players) {
    if (isKingCaptured(board, color)) {
      const survivors = players.filter(p => p !== color);
      return {
        type: 'checkmate',
        winner: survivors.length === 1 ? survivors[0] : null,
        ...vpFields(board, [...eliminated, color]),
      };
    }
  }

  const currentPlayer = gameState.currentTurn;
  const hasLegalMoves = hasAnyLegalMoves(
    board,
    currentPlayer,
    gameState.enPassantTarget
  );

  if (!hasLegalMoves) {
    if (isInCheck(board, currentPlayer)) {
      // Checkmate. With more than two players, resolveTurnTransition would
      // have eliminated this player instead, so survivors.length === 1 there.
      const survivors = players.filter(p => p !== currentPlayer);
      return {
        type: 'checkmate',
        winner:
          survivors.length === 1
            ? survivors[0]
            : getOpponentColor(currentPlayer),
        ...vpFields(board, eliminated),
      };
    }

    // Stalemate, resolved on Victory Points among the remaining players.
    // (With more than two players a stalemated player is skipped rather than
    // ending the game, so this is only reached when everyone is stuck.)
    const winner = highestVictoryPoints(board, players);
    return {
      type: winner ? 'stalemate' : 'draw-vp-tie',
      winner,
      ...vpFields(board, eliminated),
    };
  }

  // Game continues
  return null;
}

/**
 * The next player after `from` in TURN_ORDER who is still in the game.
 * Falls back to `from` if nobody else is left.
 */
export function nextActivePlayer(
  players: PlayerColor[],
  from: PlayerColor
): PlayerColor {
  const startIdx = TURN_ORDER.indexOf(from);
  for (let i = 1; i <= TURN_ORDER.length; i++) {
    const candidate = TURN_ORDER[(startIdx + i) % TURN_ORDER.length];
    if (players.includes(candidate)) return candidate;
  }
  return from;
}

/**
 * Advance past players who cannot move, eliminating those who are checkmated.
 *
 * Only applies to 3-/4-player games. With two players, checkmate and stalemate
 * end the game outright, so the turn never needs to move past anyone and this
 * returns the state untouched.
 *
 * Starting from `gameState.currentTurn`, for each player in turn:
 *   - lost their royal piece, or checkmated -> eliminated, play moves on
 *   - stalemated (no moves, not in check)   -> skipped, they may rejoin later
 *   - otherwise                             -> it is their turn, stop
 *
 * A player is judged only when the turn actually reaches them, which matters
 * in a 3-player game: between the mating move and the mated player's turn,
 * the third player moves, and that move may free them. So being mated is not
 * final until you have to move and cannot.
 *
 * An eliminated player's pieces stay on the board as neutral obstacles: they
 * never move again and can be captured by any survivor for Victory Points.
 */
export function resolveTurnTransition(gameState: GameState): GameState {
  let board = gameState.board;
  if (getActivePlayers(board).length <= 2) return gameState;

  let turn = gameState.currentTurn;
  let consecutiveSkips = 0;

  for (;;) {
    const players = getActivePlayers(board);
    if (players.length <= 1) break;

    // Every remaining player is stalemated — nobody can move, so stop rather
    // than cycling forever. getGameResult resolves it on Victory Points.
    if (consecutiveSkips >= players.length) break;

    if (!players.includes(turn)) {
      turn = nextActivePlayer(players, turn);
      continue;
    }

    const lostKing = isKingCaptured(board, turn);
    const canMove =
      !lostKing && hasAnyLegalMoves(board, turn, gameState.enPassantTarget);

    if (canMove) break;

    if (lostKing || isInCheck(board, turn)) {
      // Checkmated (or royal captured): out of the game, pieces left behind.
      board = eliminatePlayer(board, turn);
      consecutiveSkips = 0;
    } else {
      // Stalemated: skipped for now. Another player's move may free them.
      consecutiveSkips++;
    }

    turn = nextActivePlayer(getActivePlayers(board), turn);
  }

  if (board === gameState.board && turn === gameState.currentTurn) {
    return gameState;
  }
  return { ...gameState, board, currentTurn: turn };
}

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
  const winner = result.winner ? capitalize(result.winner) : null;
  const vp = formatVictoryPoints(result);
  const out = formatEliminated(result);

  switch (result.type) {
    case 'checkmate':
      return winner
        ? `Checkmate! ${winner} wins.${out}`
        : `Checkmate!${out}`;

    case 'stalemate':
      if (winner) {
        return `Stalemate! ${winner} wins by Victory Points (${vp}).${out}`;
      }
      return `Stalemate! Draw by equal Victory Points (${vp}).${out}`;

    case 'draw-vp-tie':
      return `Draw by equal Victory Points (${vp}).${out}`;

    case 'resignation':
      return winner ? `${winner} wins by resignation.` : 'Game over by resignation.';

    case 'timeout':
      return winner ? `${winner} wins on time.` : 'Game over on time.';

    case 'draw-agreement':
      return 'Draw by agreement.';

    case 'draw-fifty-move':
      return `Draw by 50-move rule.${out}`;

    case 'draw-repetition':
      return `Draw by threefold repetition.${out}`;

    default:
      return 'Game over.';
  }
}

/**
 * VP summary. Two-player games read "12 - 9"; 3-/4-player games name each
 * colour, since a bare pair of numbers would be ambiguous.
 */
function formatVictoryPoints(result: GameResult): string {
  const vp = result.victoryPoints;
  if (!vp) return `${result.whiteVP} - ${result.blackVP}`;

  const entries = TURN_ORDER.filter(c => vp[c] !== undefined);
  if (entries.length <= 2) return `${result.whiteVP} - ${result.blackVP}`;

  return entries.map(c => `${capitalize(c)} ${vp[c]}`).join(', ');
}

/** Trailing note naming the players knocked out along the way. */
function formatEliminated(result: GameResult): string {
  const eliminated = result.eliminated;
  if (!eliminated || eliminated.length === 0) return '';
  const names = eliminated.map(capitalize).join(', ');
  return eliminated.length === 1
    ? ` ${names} was eliminated.`
    : ` ${names} were eliminated.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Minimax with alpha-beta pruning for AI move selection
 */

import type { GameState, Position, PlayerColor } from '@hyper-fairy-chess/shared';
import {
  PIECE_BY_ID,
  getPieceAt,
  getAllLegalMoves,
  getCastlingDestinations,
  prepareMoveFromPositions,
  executeMove,
  getGameResult,
  isInCheck,
} from '@hyper-fairy-chess/shared';

export interface AIMove {
  pieceId: string;
  from: Position;
  to: Position;
  promotionPieceId?: string;
}

const DEPTH = 3;

// ============================================================
// Evaluation
// ============================================================

function evaluate(gameState: GameState, aiColor: PlayerColor): number {
  const enemyColor = aiColor === 'white' ? 'black' : 'white';
  const board = gameState.board;

  const files = board.dimensions.files;
  const ranks = board.dimensions.ranks;
  const centerFile = (files - 1) / 2;
  const centerRank = (ranks - 1) / 2;

  let score = 0;

  for (const piece of board.pieces) {
    if (!piece.position) continue;
    const pieceType = PIECE_BY_ID[piece.typeId];
    if (!pieceType) continue;

    const value = pieceType.cost;
    const isAI = piece.owner === aiColor;
    const sign = isAI ? 1 : -1;

    score += sign * value;

    // Small center bonus
    const distFile = Math.abs(piece.position.file.charCodeAt(0) - 'a'.charCodeAt(0) - centerFile);
    const distRank = Math.abs(piece.position.rank - 1 - centerRank);
    const centerBonus = Math.max(0, 3 - (distFile + distRank) * 0.5);
    score += sign * centerBonus;
  }

  // Check bonus/penalty
  if (isInCheck(board, enemyColor)) score += 50;
  if (isInCheck(board, aiColor)) score -= 50;

  return score;
}

// ============================================================
// Move generation helpers
// ============================================================

interface RawMove {
  pieceId: string;
  from: Position;
  to: Position;
}

function getAllMoves(gameState: GameState, color: PlayerColor): RawMove[] {
  const board = gameState.board;
  const moves: RawMove[] = [];
  const legalMovesMap = getAllLegalMoves(board, color, gameState.enPassantTarget);

  for (const [pieceId, positions] of legalMovesMap) {
    const piece = board.pieces.find((p) => p.id === pieceId);
    if (!piece?.position) continue;

    // Add castling moves for royal pieces
    const pieceType = PIECE_BY_ID[piece.typeId];
    const allPositions = [...positions];
    if (pieceType?.isRoyal) {
      allPositions.push(...getCastlingDestinations(board, piece));
    }

    for (const to of allPositions) {
      moves.push({ pieceId, from: piece.position, to });
    }
  }

  // Order: captures first (sorted by victim cost - attacker cost), then non-captures
  const captures: (RawMove & { score: number })[] = [];
  const quiet: RawMove[] = [];

  for (const m of moves) {
    const victim = getPieceAt(board, m.to);
    if (victim) {
      const moverType = PIECE_BY_ID[board.pieces.find((p) => p.id === m.pieceId)?.typeId ?? ''];
      const victimType = PIECE_BY_ID[victim.typeId];
      const score = (victimType?.cost ?? 0) - (moverType?.cost ?? 0);
      captures.push({ ...m, score });
    } else {
      quiet.push(m);
    }
  }

  captures.sort((a, b) => b.score - a.score);
  return [...captures, ...quiet];
}

function getBestPromotion(_gameState?: GameState): string | undefined {
  // Pick highest-cost non-royal non-promotionOnly piece from the board's piece pool
  let best: { id: string; cost: number } | null = null;
  for (const p of Object.values(PIECE_BY_ID)) {
    if (p.isRoyal || p.promotionOnly || p.isMandatory) continue;
    if (!best || p.cost > best.cost) {
      best = { id: p.id, cost: p.cost };
    }
  }
  return best?.id;
}

// ============================================================
// Minimax
// ============================================================

function minimax(
  gameState: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiColor: PlayerColor
): number {
  const result = getGameResult(gameState);
  if (result) {
    if (result.type === 'checkmate') {
      // The side that just moved won
      return maximizing ? -10000 - depth : 10000 + depth;
    }
    return 0; // stalemate/draw
  }

  if (depth === 0) return evaluate(gameState, aiColor);

  const currentColor = gameState.currentTurn;
  const moves = getAllMoves(gameState, currentColor);

  if (moves.length === 0) return evaluate(gameState, aiColor);

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      const piece = gameState.board.pieces.find((p) => p.id === m.pieceId);
      if (!piece) continue;
      const move = prepareMoveFromPositions(gameState, piece, m.from, m.to, getBestPromotion());
      if (!move) continue;
      const next = executeMove(gameState, move);
      const val = minimax(next, depth - 1, alpha, beta, false, aiColor);
      if (val > best) best = val;
      if (val > alpha) alpha = val;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const piece = gameState.board.pieces.find((p) => p.id === m.pieceId);
      if (!piece) continue;
      const move = prepareMoveFromPositions(gameState, piece, m.from, m.to, getBestPromotion());
      if (!move) continue;
      const next = executeMove(gameState, move);
      const val = minimax(next, depth - 1, alpha, beta, true, aiColor);
      if (val < best) best = val;
      if (val < beta) beta = val;
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ============================================================
// Public API
// ============================================================

export function getBestMove(
  gameState: GameState,
  aiColor: PlayerColor,
  depth: number = DEPTH
): AIMove | null {
  const moves = getAllMoves(gameState, aiColor);
  if (moves.length === 0) return null;

  let bestMove: RawMove | null = null;
  let bestVal = -Infinity;

  for (const m of moves) {
    const piece = gameState.board.pieces.find((p) => p.id === m.pieceId);
    if (!piece) continue;
    const promotionId = getBestPromotion();
    const move = prepareMoveFromPositions(gameState, piece, m.from, m.to, promotionId);
    if (!move) continue;
    const next = executeMove(gameState, move);
    const val = minimax(next, depth - 1, -Infinity, Infinity, false, aiColor);
    if (val > bestVal) {
      bestVal = val;
      bestMove = m;
    }
  }

  if (!bestMove) return null;

  return {
    pieceId: bestMove.pieceId,
    from: bestMove.from,
    to: bestMove.to,
    promotionPieceId: getBestPromotion(gameState),
  };
}

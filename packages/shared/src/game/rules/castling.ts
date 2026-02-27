/**
 * Castling logic
 */

import type { Position, BoardState, PieceInstance } from '../types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import {
  getAllPieces,
  fileToIndex,
  indexToFile,
  getHomeRank,
  getOpponentColor,
  isSquareEmpty,
} from '../board/boardUtils';
import { isSquareAttacked, isInCheck } from './checkDetection';

// =============================================================================
// Types
// =============================================================================

export interface CastlingMove {
  kingTo: Position;
  rookId: string;
  rookFrom: Position;
  rookTo: Position;
  isKingside: boolean;
}

// =============================================================================
// Castling Detection
// =============================================================================

/**
 * Get all available castling moves for the king
 */
export function getCastlingMoves(
  board: BoardState,
  king: PieceInstance
): CastlingMove[] {
  if (!king.position) return [];
  if (king.hasMoved) return [];

  const pieceType = PIECE_BY_ID[king.typeId];
  if (!pieceType) return [];

  // King must be a royal piece that can castle
  if (!pieceType.isRoyal) return [];

  // Can't castle while in check
  if (isInCheck(board, king.owner)) return [];

  const castlingMoves: CastlingMove[] = [];
  const homeRank = getHomeRank(king.owner);

  // Find all pieces that can castle (rooks, dragons, chamberlains)
  const friendlyPieces = getAllPieces(board, king.owner);
  const castleablePieces = friendlyPieces.filter((p) => {
    const pType = PIECE_BY_ID[p.typeId];
    return pType?.canCastle && !pType.isRoyal && !p.hasMoved && p.position?.rank === homeRank;
  });

  for (const rook of castleablePieces) {
    if (!rook.position) continue;

    const rookFileIndex = fileToIndex(rook.position.file);
    const kingFileIndex = fileToIndex(king.position.file);

    // Determine if kingside or queenside
    const isKingside = rookFileIndex > kingFileIndex;

    // Check if castling is valid
    if (canCastle(board, king, rook, isKingside)) {
      // Calculate king and rook destination
      const kingDx = isKingside ? 2 : -2;
      const kingToFile = indexToFile(kingFileIndex + kingDx);

      if (kingToFile) {
        const rookToFileIndex = kingFileIndex + (isKingside ? 1 : -1);
        const rookToFile = indexToFile(rookToFileIndex);

        if (rookToFile) {
          castlingMoves.push({
            kingTo: { file: kingToFile, rank: homeRank },
            rookId: rook.id,
            rookFrom: rook.position,
            rookTo: { file: rookToFile, rank: homeRank },
            isKingside,
          });
        }
      }
    }
  }

  return castlingMoves;
}

/**
 * Check if castling is valid between king and rook
 */
export function canCastle(
  board: BoardState,
  king: PieceInstance,
  rook: PieceInstance,
  isKingside: boolean
): boolean {
  if (!king.position || !rook.position) return false;

  // Both pieces must not have moved
  if (king.hasMoved || rook.hasMoved) return false;

  // Must be on same rank
  if (king.position.rank !== rook.position.rank) return false;

  // Cannot castle if starting adjacent (per PLANNING.md rules)
  const kingFileIndex = fileToIndex(king.position.file);
  const rookFileIndex = fileToIndex(rook.position.file);
  if (Math.abs(kingFileIndex - rookFileIndex) === 1) return false;

  // Cannot castle if in check
  if (isInCheck(board, king.owner)) return false;

  // Check path between king and rook is clear
  const minFile = Math.min(kingFileIndex, rookFileIndex);
  const maxFile = Math.max(kingFileIndex, rookFileIndex);
  const rank = king.position.rank;

  for (let f = minFile + 1; f < maxFile; f++) {
    const file = indexToFile(f);
    if (file) {
      const pos: Position = { file, rank };
      if (!isSquareEmpty(board, pos)) {
        return false;
      }
    }
  }

  // King cannot pass through or land on attacked squares
  const enemyColor = getOpponentColor(king.owner);

  // Check each square the king passes through (including destination)
  const direction = isKingside ? 1 : -1;
  for (let i = 1; i <= 2; i++) {
    const checkFileIndex = kingFileIndex + (direction * i);
    const checkFile = indexToFile(checkFileIndex);
    if (checkFile) {
      const checkPos: Position = { file: checkFile, rank };
      if (isSquareAttacked(board, checkPos, enemyColor)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if a move is a castling move
 */
export function isCastlingMove(
  king: PieceInstance,
  to: Position,
  board: BoardState
): CastlingMove | null {
  if (!king.position) return null;

  const pieceType = PIECE_BY_ID[king.typeId];
  if (!pieceType?.isRoyal) return null;

  // King must move exactly 2 squares horizontally
  const dx = fileToIndex(to.file) - fileToIndex(king.position.file);
  if (Math.abs(dx) !== 2) return null;
  if (to.rank !== king.position.rank) return null;

  // Find matching castling move
  const castlingMoves = getCastlingMoves(board, king);
  return castlingMoves.find(
    (cm) => cm.kingTo.file === to.file && cm.kingTo.rank === to.rank
  ) || null;
}

/**
 * Get all castling destination squares for a king (to add to valid moves)
 */
export function getCastlingDestinations(
  board: BoardState,
  king: PieceInstance
): Position[] {
  const castlingMoves = getCastlingMoves(board, king);
  return castlingMoves.map((cm) => cm.kingTo);
}

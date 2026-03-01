/**
 * Check detection and legal move filtering
 */

import type { Position, BoardState, PieceInstance, PlayerColor, File, Rank } from '../types';
import { positionToString } from '../types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import {
  getKing,
  getAllPieces,
  cloneBoardState,
  createPositionMap,
  getOpponentColor,
  getPieceAt,
  areAdjacent,
  fileToIndex,
  offsetPosition,
  isSquareEmpty,
} from '../board/boardUtils';
import { getAttackedSquares, generatePseudoLegalMoves } from '../board/moveGeneration';
import { updateFrozenStates } from './freeze';

// =============================================================================
// Special Capture Threat Detection
// =============================================================================

/**
 * Check if a Coordinator can capture the target position after any of its moves
 * Coordinator captures at (friendly king's file, coord's rank) and (coord's file, friendly king's rank)
 */
function canCoordinatorThreaten(
  board: BoardState,
  coordinator: PieceInstance,
  targetPos: Position
): boolean {
  if (!coordinator.position || coordinator.isFrozen) return false;

  const friendlyKing = getKing(board, coordinator.owner);
  if (!friendlyKing?.position) return false;

  // Get all positions the coordinator can move to
  const moves = generatePseudoLegalMoves(board, coordinator, null);

  for (const move of moves) {
    // Check position 1: King's file, Coordinator's new rank
    if (friendlyKing.position.file === targetPos.file && move.rank === targetPos.rank) {
      return true;
    }
    // Check position 2: Coordinator's new file, King's rank
    if (move.file === targetPos.file && friendlyKing.position.rank === targetPos.rank) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a Boxer can capture the target position after any of its moves
 * Boxer captures enemies that are "boxed in" - orthogonally adjacent with friendly piece on opposite side
 */
function canBoxerThreaten(
  board: BoardState,
  boxer: PieceInstance,
  targetPos: Position
): boolean {
  if (!boxer.position || boxer.isFrozen) return false;

  const files: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const moves = generatePseudoLegalMoves(board, boxer, null);

  for (const boxerNewPos of moves) {
    const boxerFileIndex = files.indexOf(boxerNewPos.file);
    const targetFileIndex = files.indexOf(targetPos.file);

    // Check if target would be orthogonally adjacent to boxer's new position
    const dx = targetFileIndex - boxerFileIndex;
    const dy = targetPos.rank - boxerNewPos.rank;

    // Must be orthogonally adjacent (not diagonal)
    if (!((Math.abs(dx) === 1 && dy === 0) || (dx === 0 && Math.abs(dy) === 1))) {
      continue;
    }

    // Check if there's a friendly piece on the opposite side of the target
    const oppositeFileIndex = targetFileIndex + dx;
    const oppositeRank = targetPos.rank + dy;

    if (oppositeFileIndex < 0 || oppositeFileIndex >= files.length) continue;
    if (oppositeRank < 1 || oppositeRank > board.dimensions.ranks) continue;

    const oppositePos: Position = {
      file: files[oppositeFileIndex],
      rank: oppositeRank as Rank,
    };

    // Simulate the board after boxer moves
    const pieceAtOpposite = getPieceAt(board, oppositePos);
    // The boxer itself could be at the opposite position before moving
    if (pieceAtOpposite && pieceAtOpposite.owner === boxer.owner && pieceAtOpposite.id !== boxer.id) {
      return true;
    }
    // Or the boxer moves to complete the box from the other side
    if (boxer.position.file === oppositePos.file && boxer.position.rank === oppositePos.rank) {
      // Boxer is currently at opposite - but it's moving away, so this doesn't count
      continue;
    }
  }

  return false;
}

/**
 * Check if a Withdrawer can capture the target position
 * Withdrawer captures by moving away from an adjacent enemy
 */
function canWithdrawerThreaten(
  board: BoardState,
  withdrawer: PieceInstance,
  targetPos: Position
): boolean {
  if (!withdrawer.position || withdrawer.isFrozen) return false;

  // Withdrawer must be adjacent to the target to threaten it
  if (!areAdjacent(withdrawer.position, targetPos)) return false;

  // Calculate direction from target to withdrawer
  const dx = fileToIndex(withdrawer.position.file) - fileToIndex(targetPos.file);
  const dy = withdrawer.position.rank - targetPos.rank;

  // Withdrawer threatens if it can move in the same direction (away from target)
  // Check if there's a valid square in that direction
  const moves = generatePseudoLegalMoves(board, withdrawer, null);

  for (const move of moves) {
    const moveDx = fileToIndex(move.file) - fileToIndex(withdrawer.position.file);
    const moveDy = move.rank - withdrawer.position.rank;

    // Move must be in the same direction as dx, dy (moving away from target)
    if (Math.sign(moveDx) === Math.sign(dx) && Math.sign(moveDy) === Math.sign(dy)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a Thief can capture the target position
 * Thief jumps 2 squares and captures the piece on the square past where it lands
 */
function canThiefThreaten(
  board: BoardState,
  thief: PieceInstance,
  targetPos: Position
): boolean {
  if (!thief.position || thief.isFrozen) return false;

  const moves = generatePseudoLegalMoves(board, thief, null);

  for (const move of moves) {
    // Calculate direction of movement
    const dx = fileToIndex(move.file) - fileToIndex(thief.position.file);
    const dy = move.rank - thief.position.rank;

    // Normalize to get step direction
    const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
    const stepY = dy === 0 ? 0 : dy / Math.abs(dy);

    // The capture position is one more step past the landing
    const capturePos = offsetPosition(move, stepX, stepY, board.dimensions);
    if (!capturePos) continue;

    if (capturePos.file === targetPos.file && capturePos.rank === targetPos.rank) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a Long Leaper can capture the target position
 * Long Leaper captures by jumping over pieces (like checkers)
 */
function canLongLeaperThreaten(
  board: BoardState,
  longLeaper: PieceInstance,
  targetPos: Position
): boolean {
  if (!longLeaper.position || longLeaper.isFrozen) return false;

  // Check if Long Leaper can jump over the target
  // The target must be in a straight line from the Long Leaper
  const dx = fileToIndex(targetPos.file) - fileToIndex(longLeaper.position.file);
  const dy = targetPos.rank - longLeaper.position.rank;

  // Must be in a straight line (orthogonal or diagonal)
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) {
    return false;
  }

  // Must have at least 1 square distance (can't jump adjacent)
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
    return false;
  }

  const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
  const stepY = dy === 0 ? 0 : dy / Math.abs(dy);

  // Check that path to target is clear
  let currentPos = longLeaper.position;
  while (true) {
    currentPos = offsetPosition(currentPos, stepX, stepY, board.dimensions)!;
    if (!currentPos) return false;

    if (currentPos.file === targetPos.file && currentPos.rank === targetPos.rank) {
      // Reached the target - now check if we can land past it
      const landingPos = offsetPosition(currentPos, stepX, stepY, board.dimensions);
      if (landingPos && isSquareEmpty(board, landingPos)) {
        return true;
      }
      return false;
    }

    // Path must be clear before reaching target
    if (!isSquareEmpty(board, currentPos)) {
      return false;
    }
  }
}

/**
 * Check if a Chameleon can capture the target position
 * Chameleon captures using the target piece's own capture method
 */
function canChameleonThreaten(
  board: BoardState,
  chameleon: PieceInstance,
  targetPos: Position
): boolean {
  if (!chameleon.position || chameleon.isFrozen) return false;

  // Get the piece at target position
  const targetPiece = getPieceAt(board, targetPos);
  if (!targetPiece) return false;

  const targetType = PIECE_BY_ID[targetPiece.typeId];
  if (!targetType || !targetType.canBeCaptured) return false;

  // Check if chameleon can reach the target using the target's capture method
  // For standard displacement captures, check if chameleon can reach using target's movement

  // Check target's movement patterns
  // Slides
  for (const slideDir of targetType.movement.slides) {
    if (canReachBySlide(board, chameleon.position, targetPos, slideDir as 'orthogonal' | 'diagonal' | 'all', chameleon.owner)) {
      return true;
    }
  }

  // Leaps
  for (const leap of targetType.movement.leaps) {
    if (canReachByLeap(chameleon.position, targetPos, leap, board.dimensions)) {
      return true;
    }
  }

  // Special movements (king-one-square, pawn captures, etc.)
  for (const special of targetType.movement.special) {
    if (canChameleonReachWithSpecial(board, chameleon, targetPos, special)) {
      return true;
    }
  }

  // Check if chameleon can capture via long-leaper-style jump (if any long leaper in path)
  if (canChameleonCaptureLongLeaperStyle(board, chameleon, targetPos)) {
    return true;
  }

  return false;
}

/**
 * Check if chameleon can reach target using a special movement pattern
 */
function canChameleonReachWithSpecial(
  board: BoardState,
  chameleon: PieceInstance,
  targetPos: Position,
  special: string
): boolean {
  if (!chameleon.position) return false;

  const dx = fileToIndex(targetPos.file) - fileToIndex(chameleon.position.file);
  const dy = targetPos.rank - chameleon.position.rank;

  switch (special) {
    case 'king-one-square':
      // Can capture if adjacent
      return Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0);

    case 'pawn-capture-diagonal': {
      // Chameleon captures like the target pawn would capture
      // A pawn captures diagonally forward, so chameleon must approach from those squares
      const targetPiece = getPieceAt(board, targetPos);
      if (!targetPiece) return false;
      const pawnDir = targetPiece.owner === 'white' ? 1 : -1;
      // Chameleon must be on a square the pawn could capture (diagonal forward from pawn's perspective)
      return Math.abs(dx) === 1 && dy === pawnDir;
    }

    case 'herald-orthogonal': {
      // Exactly 2 squares orthogonally with clear path
      if (!((Math.abs(dx) === 2 && dy === 0) || (dx === 0 && Math.abs(dy) === 2))) {
        return false;
      }
      // Check intermediate square is empty
      const midX = dx === 0 ? 0 : dx / 2;
      const midY = dy === 0 ? 0 : dy / 2;
      const midPos = offsetPosition(chameleon.position, midX, midY, board.dimensions);
      return midPos !== null && isSquareEmpty(board, midPos);
    }

    default:
      return false;
  }
}

/**
 * Check if chameleon can capture target via long-leaper-style jump
 * (jumping over any enemy piece where at least one is a long leaper)
 */
function canChameleonCaptureLongLeaperStyle(
  board: BoardState,
  chameleon: PieceInstance,
  targetPos: Position
): boolean {
  if (!chameleon.position) return false;

  const dx = fileToIndex(targetPos.file) - fileToIndex(chameleon.position.file);
  const dy = targetPos.rank - chameleon.position.rank;

  // Must be in a straight line
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) {
    return false;
  }

  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (distance < 2) return false; // Need at least 2 squares for a jump

  const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
  const stepY = dy === 0 ? 0 : dy / Math.abs(dy);

  // Walk the path and check for long leapers
  let hasLongLeaper = false;
  let currentPos = chameleon.position;

  for (let i = 0; i < distance - 1; i++) {
    currentPos = offsetPosition(currentPos, stepX, stepY, board.dimensions)!;
    if (!currentPos) return false;

    const piece = getPieceAt(board, currentPos);
    if (piece) {
      if (piece.owner === chameleon.owner) return false; // Blocked by friendly
      const pieceType = PIECE_BY_ID[piece.typeId];
      if (pieceType?.captureType === 'long-leap') {
        hasLongLeaper = true;
      }
      // Any enemy piece can be jumped over if there's a long leaper in the path
    }
  }

  return hasLongLeaper;
}

/**
 * Check if position A can reach position B by sliding
 */
function canReachBySlide(
  board: BoardState,
  from: Position,
  to: Position,
  direction: 'orthogonal' | 'diagonal' | 'all',
  _friendlyColor: PlayerColor
): boolean {
  const dx = fileToIndex(to.file) - fileToIndex(from.file);
  const dy = to.rank - from.rank;

  // Check if direction matches
  const isDiagonal = dx !== 0 && dy !== 0 && Math.abs(dx) === Math.abs(dy);
  const isOrthogonal = (dx === 0) !== (dy === 0);

  if (direction === 'diagonal' && !isDiagonal) return false;
  if (direction === 'orthogonal' && !isOrthogonal) return false;
  if (direction === 'all' && !isDiagonal && !isOrthogonal) return false;

  // Check path is clear
  const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
  const stepY = dy === 0 ? 0 : dy / Math.abs(dy);
  const distance = Math.max(Math.abs(dx), Math.abs(dy));

  let currentPos = from;
  for (let i = 0; i < distance - 1; i++) {
    currentPos = offsetPosition(currentPos, stepX, stepY, board.dimensions)!;
    if (!currentPos) return false;
    if (!isSquareEmpty(board, currentPos)) return false;
  }

  return true;
}

/**
 * Check if position A can reach position B by leap
 */
function canReachByLeap(
  from: Position,
  to: Position,
  leap: { dx: number; dy: number; symmetric: boolean },
  _dimensions: { files: number; ranks: number }
): boolean {
  const dx = fileToIndex(to.file) - fileToIndex(from.file);
  const dy = to.rank - from.rank;

  // Check all symmetric variations of the leap
  const offsets: { dx: number; dy: number }[] = [];
  offsets.push({ dx: leap.dx, dy: leap.dy });
  if (leap.symmetric) {
    offsets.push({ dx: -leap.dx, dy: leap.dy });
    offsets.push({ dx: leap.dx, dy: -leap.dy });
    offsets.push({ dx: -leap.dx, dy: -leap.dy });
    offsets.push({ dx: leap.dy, dy: leap.dx });
    offsets.push({ dx: -leap.dy, dy: leap.dx });
    offsets.push({ dx: leap.dy, dy: -leap.dx });
    offsets.push({ dx: -leap.dy, dy: -leap.dx });
  }

  return offsets.some((o) => o.dx === dx && o.dy === dy);
}

/**
 * Check if a piece with special capture can threaten the target position
 */
function canSpecialCaptureThreaten(
  board: BoardState,
  piece: PieceInstance,
  targetPos: Position
): boolean {
  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return false;

  switch (pieceType.captureType) {
    case 'coordinator':
      return canCoordinatorThreaten(board, piece, targetPos);
    case 'boxer':
      return canBoxerThreaten(board, piece, targetPos);
    case 'withdrawal':
      return canWithdrawerThreaten(board, piece, targetPos);
    case 'thief':
      return canThiefThreaten(board, piece, targetPos);
    case 'long-leap':
      return canLongLeaperThreaten(board, piece, targetPos);
    case 'chameleon':
      return canChameleonThreaten(board, piece, targetPos);
    default:
      return false;
  }
}

// =============================================================================
// Check Detection
// =============================================================================

/**
 * Check if a square is attacked by any piece of the given color
 * Includes both standard attacks and special capture mechanics
 */
export function isSquareAttacked(
  board: BoardState,
  pos: Position,
  byColor: PlayerColor
): boolean {
  const enemyPieces = getAllPieces(board, byColor);
  const targetKey = positionToString(pos);

  for (const piece of enemyPieces) {
    // Check standard attacks (displacement captures)
    const attackedSquares = getAttackedSquares(board, piece);
    if (attackedSquares.some((sq) => positionToString(sq) === targetKey)) {
      return true;
    }

    // Check special capture mechanics (coordinator, boxer, withdrawer, thief, long-leaper)
    if (canSpecialCaptureThreaten(board, piece, pos)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the king of the given color is in check
 */
export function isInCheck(board: BoardState, color: PlayerColor): boolean {
  const king = getKing(board, color);
  if (!king || !king.position) return false;

  return isSquareAttacked(board, king.position, getOpponentColor(color));
}

/**
 * Get all pieces that are attacking the king
 * Includes both standard attackers and pieces with special capture mechanics
 */
export function getAttackers(
  board: BoardState,
  targetPos: Position,
  byColor: PlayerColor
): PieceInstance[] {
  const attackers: PieceInstance[] = [];
  const enemyPieces = getAllPieces(board, byColor);
  const targetKey = positionToString(targetPos);

  for (const piece of enemyPieces) {
    // Check standard attacks
    const attackedSquares = getAttackedSquares(board, piece);
    if (attackedSquares.some((sq) => positionToString(sq) === targetKey)) {
      attackers.push(piece);
      continue;
    }

    // Check special capture mechanics
    if (canSpecialCaptureThreaten(board, piece, targetPos)) {
      attackers.push(piece);
    }
  }

  return attackers;
}

// =============================================================================
// Move Simulation
// =============================================================================

/**
 * Simulate a move on the board and return the resulting board state
 * Used for checking if a move would leave the king in check
 */
export function simulateMove(
  board: BoardState,
  piece: PieceInstance,
  to: Position,
  capturePosition?: Position
): BoardState {
  // Clone the board
  const newBoard = cloneBoardState(board);

  // Find the piece in the cloned board
  const pieceIndex = newBoard.pieces.findIndex((p) => p.id === piece.id);
  if (pieceIndex === -1) return newBoard;

  // Get the original position of the moving piece
  const fromPosition = piece.position;

  // Handle capture at the destination (or en passant capture position)
  const capturePos = capturePosition || to;
  const captureKey = positionToString(capturePos);
  const targetPieceId = newBoard.positionMap.get(captureKey);

  if (targetPieceId && targetPieceId !== piece.id) {
    const targetIndex = newBoard.pieces.findIndex((p) => p.id === targetPieceId);
    if (targetIndex !== -1) {
      const targetPiece = newBoard.pieces[targetIndex];
      const pieceType = PIECE_BY_ID[piece.typeId];

      // Check if this is a swap move (piece has swap-adjacent and target is friendly)
      const isSwapMove = pieceType?.movement.special.includes('swap-adjacent') &&
                         targetPiece.owner === piece.owner &&
                         fromPosition !== null;

      if (isSwapMove) {
        // Swap: move the target piece to the moving piece's original position
        newBoard.pieces[targetIndex] = {
          ...targetPiece,
          position: fromPosition,
        };
      } else {
        // Capture: remove the target piece from the board
        newBoard.pieces[targetIndex] = {
          ...targetPiece,
          position: null,
        };
      }
    }
  }

  // Move the piece
  newBoard.pieces[pieceIndex] = {
    ...newBoard.pieces[pieceIndex],
    position: to,
    hasMoved: true,
  };

  // Rebuild position map
  newBoard.positionMap = createPositionMap(newBoard.pieces);

  // Update frozen states after the move
  return updateFrozenStates(newBoard);
}

// =============================================================================
// Legal Move Filtering
// =============================================================================

/**
 * Check if a move would leave the player's king in check
 */
export function wouldBeInCheck(
  board: BoardState,
  piece: PieceInstance,
  to: Position,
  capturePosition?: Position
): boolean {
  const simulatedBoard = simulateMove(board, piece, to, capturePosition);
  return isInCheck(simulatedBoard, piece.owner);
}

/**
 * Filter pseudo-legal moves to only include legal moves
 * A move is legal if it doesn't leave the player's own king in check
 */
export function filterLegalMoves(
  board: BoardState,
  piece: PieceInstance,
  moves: Position[],
  enPassantTarget: Position | null
): Position[] {
  const pieceType = PIECE_BY_ID[piece.typeId];

  return moves.filter((move) => {
    // For en passant, the capture position is different from the move position
    let capturePosition: Position | undefined;

    if (
      enPassantTarget &&
      move.file === enPassantTarget.file &&
      move.rank === enPassantTarget.rank &&
      pieceType?.movement.special.includes('pawn-capture-diagonal')
    ) {
      // En passant: the captured pawn is on the same file but different rank
      const direction = piece.owner === 'white' ? 1 : -1;
      capturePosition = {
        file: enPassantTarget.file,
        rank: (enPassantTarget.rank - direction) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      };
    }

    return !wouldBeInCheck(board, piece, move, capturePosition);
  });
}

/**
 * Generate all legal moves for a piece
 * Combines move generation with legal move filtering
 */
export function generateLegalMoves(
  board: BoardState,
  piece: PieceInstance,
  enPassantTarget: Position | null
): Position[] {
  const pseudoLegalMoves = generatePseudoLegalMoves(board, piece, enPassantTarget);
  return filterLegalMoves(board, piece, pseudoLegalMoves, enPassantTarget);
}

// =============================================================================
// Check State Utilities
// =============================================================================

/**
 * Determine if a player has any legal moves
 */
export function hasAnyLegalMoves(
  board: BoardState,
  color: PlayerColor,
  enPassantTarget: Position | null
): boolean {
  const pieces = getAllPieces(board, color);

  for (const piece of pieces) {
    const legalMoves = generateLegalMoves(board, piece, enPassantTarget);
    if (legalMoves.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Get all legal moves for all pieces of a color
 * Returns a map of piece ID to legal moves
 */
export function getAllLegalMoves(
  board: BoardState,
  color: PlayerColor,
  enPassantTarget: Position | null
): Map<string, Position[]> {
  const allMoves = new Map<string, Position[]>();
  const pieces = getAllPieces(board, color);

  for (const piece of pieces) {
    const legalMoves = generateLegalMoves(board, piece, enPassantTarget);
    if (legalMoves.length > 0) {
      allMoves.set(piece.id, legalMoves);
    }
  }

  return allMoves;
}

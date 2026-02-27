/**
 * Move execution - applies moves to game state
 */

import type {
  Position,
  BoardState,
  GameState,
  PieceInstance,
  Move,
  PlayerColor,
  File,
  Rank,
} from '../types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import {
  cloneBoardState,
  createPositionMap,
  getPieceAt,
  getPieceById,
  getOpponentColor,
  fileToIndex,
  getKing,
  hasCapturableEnemyPiece,
} from '../board/boardUtils';
import { isCastlingMove } from './castling';
import { isInCheck } from './checkDetection';
import { isPromotionMove } from './promotion';
import { updateFrozenStates } from './freeze';

// =============================================================================
// Special Capture Calculations
// =============================================================================

/**
 * Calculate coordinator captures - pieces at (king's file, coord's rank) and (coord's file, king's rank)
 */
export function getCoordinatorCaptures(
  board: BoardState,
  coordinatorColor: PlayerColor,
  coordinatorNewPos: Position
): { pieceId: string; position: Position }[] {
  const captures: { pieceId: string; position: Position }[] = [];
  const king = getKing(board, coordinatorColor);

  if (!king || !king.position) return captures;

  // Position 1: King's file, Coordinator's rank
  const pos1: Position = { file: king.position.file, rank: coordinatorNewPos.rank };
  if (hasCapturableEnemyPiece(board, pos1, coordinatorColor)) {
    const piece = getPieceAt(board, pos1);
    if (piece) {
      captures.push({ pieceId: piece.id, position: pos1 });
    }
  }

  // Position 2: Coordinator's file, King's rank
  const pos2: Position = { file: coordinatorNewPos.file, rank: king.position.rank };
  if (hasCapturableEnemyPiece(board, pos2, coordinatorColor)) {
    const piece = getPieceAt(board, pos2);
    if (piece && piece.id !== captures[0]?.pieceId) { // Avoid duplicate if same square
      captures.push({ pieceId: piece.id, position: pos2 });
    }
  }

  return captures;
}

/**
 * Calculate boxer captures - enemies "boxed in" (orthogonally adjacent with friendly on opposite side)
 */
export function getBoxerCaptures(
  board: BoardState,
  boxerColor: PlayerColor,
  boxerNewPos: Position
): { pieceId: string; position: Position }[] {
  const captures: { pieceId: string; position: Position }[] = [];
  const files: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const boxerFileIndex = files.indexOf(boxerNewPos.file);

  // Check all 4 orthogonal directions
  const directions = [
    { dx: 1, dy: 0 },   // right
    { dx: -1, dy: 0 },  // left
    { dx: 0, dy: 1 },   // up
    { dx: 0, dy: -1 },  // down
  ];

  for (const dir of directions) {
    // Position of potential enemy (adjacent to boxer)
    const enemyFileIndex = boxerFileIndex + dir.dx;
    const enemyRank = boxerNewPos.rank + dir.dy;

    if (enemyFileIndex < 0 || enemyFileIndex >= files.length) continue;
    if (enemyRank < 1 || enemyRank > 10) continue;

    const enemyPos: Position = {
      file: files[enemyFileIndex],
      rank: enemyRank as Rank,
    };

    // Check if there's a capturable enemy at this position
    if (!hasCapturableEnemyPiece(board, enemyPos, boxerColor)) continue;

    // Position of potential friendly piece (on opposite side of enemy)
    const friendlyFileIndex = boxerFileIndex + dir.dx * 2;
    const friendlyRank = boxerNewPos.rank + dir.dy * 2;

    if (friendlyFileIndex < 0 || friendlyFileIndex >= files.length) continue;
    if (friendlyRank < 1 || friendlyRank > 10) continue;

    const friendlyPos: Position = {
      file: files[friendlyFileIndex],
      rank: friendlyRank as Rank,
    };

    // Check if there's a friendly piece completing the "box"
    const friendlyPiece = getPieceAt(board, friendlyPos);
    if (friendlyPiece && friendlyPiece.owner === boxerColor) {
      const enemyPiece = getPieceAt(board, enemyPos);
      if (enemyPiece) {
        captures.push({ pieceId: enemyPiece.id, position: enemyPos });
      }
    }
  }

  return captures;
}

/**
 * Calculate thief capture - piece on square past where thief lands
 */
export function getThiefCapture(
  board: BoardState,
  thiefColor: PlayerColor,
  from: Position,
  to: Position
): { pieceId: string; position: Position } | null {
  const files: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  // Calculate movement direction
  const fromFileIndex = files.indexOf(from.file);
  const toFileIndex = files.indexOf(to.file);
  const dx = toFileIndex - fromFileIndex;
  const dy = to.rank - from.rank;

  // The capture position is one more step in the same direction
  // Normalize direction to get unit step
  const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
  const stepY = dy === 0 ? 0 : dy / Math.abs(dy);

  const captureFileIndex = toFileIndex + stepX;
  const captureRank = to.rank + stepY;

  if (captureFileIndex < 0 || captureFileIndex >= files.length) return null;
  if (captureRank < 1 || captureRank > 10) return null;

  const capturePos: Position = {
    file: files[captureFileIndex],
    rank: captureRank as Rank,
  };

  if (hasCapturableEnemyPiece(board, capturePos, thiefColor)) {
    const piece = getPieceAt(board, capturePos);
    if (piece) {
      return { pieceId: piece.id, position: capturePos };
    }
  }

  return null;
}

/**
 * Calculate Long Leaper captures - pieces jumped over between from and to positions
 * Long Leaper jumps over exactly one enemy piece to land on empty square, can chain jumps
 */
export function getLongLeaperCaptures(
  board: BoardState,
  longLeaperColor: PlayerColor,
  from: Position,
  to: Position
): { pieceId: string; position: Position }[] {
  const captures: { pieceId: string; position: Position }[] = [];
  const files: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  // Calculate direction of movement
  const fromFileIndex = files.indexOf(from.file);
  const toFileIndex = files.indexOf(to.file);
  const dx = toFileIndex - fromFileIndex;
  const dy = to.rank - from.rank;

  // Must be in a straight line
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) {
    return captures;
  }

  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (distance === 0) return captures;

  const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
  const stepY = dy === 0 ? 0 : dy / Math.abs(dy);

  // Walk the path and find jumped pieces
  let currentFileIndex = fromFileIndex;
  let currentRank = from.rank;

  for (let i = 0; i < distance; i++) {
    currentFileIndex += stepX;
    currentRank += stepY;

    const pos: Position = {
      file: files[currentFileIndex],
      rank: currentRank as Rank,
    };

    // Check if there's a piece at this position
    if (hasCapturableEnemyPiece(board, pos, longLeaperColor)) {
      const piece = getPieceAt(board, pos);
      if (piece) {
        captures.push({ pieceId: piece.id, position: pos });
      }
    }
  }

  return captures;
}

/**
 * Calculate withdrawer capture - piece in opposite direction of movement
 */
export function getWithdrawerCapture(
  board: BoardState,
  withdrawerColor: PlayerColor,
  from: Position,
  to: Position
): { pieceId: string; position: Position } | null {
  // Calculate movement direction
  const dx = fileToIndex(to.file) - fileToIndex(from.file);
  const dy = to.rank - from.rank;

  // The capture position is in the opposite direction from 'from'
  // (i.e., the piece we're moving away from)
  const captureFile = fileToIndex(from.file) - Math.sign(dx);
  const captureRank = from.rank - Math.sign(dy);

  // Check if there's a valid file
  const files: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  if (captureFile < 0 || captureFile >= files.length) return null;
  if (captureRank < 1 || captureRank > 10) return null;

  const capturePos: Position = {
    file: files[captureFile],
    rank: captureRank as Rank,
  };

  if (hasCapturableEnemyPiece(board, capturePos, withdrawerColor)) {
    const piece = getPieceAt(board, capturePos);
    if (piece) {
      return { pieceId: piece.id, position: capturePos };
    }
  }

  return null;
}

/**
 * Calculate Chameleon captures - captures using the method of the captured piece type.
 * Handles boxer-style, withdrawer-style, long-leaper-style, and coordinator-style captures.
 */
export function getChameleonCaptures(
  board: BoardState,
  chameleon: PieceInstance,
  from: Position,
  to: Position
): { pieceId: string; position: Position }[] | undefined {
  // Check for coordinator-style capture (coordinator at intersection of chameleon's file/rank and king's rank/file)
  const coordinatorCaptures = getChameleonCoordinatorCapture(board, chameleon, to);
  if (coordinatorCaptures.length > 0) {
    return coordinatorCaptures;
  }

  // Check for boxer-style capture (adjacent enemy boxer with friendly piece on opposite side)
  const boxerCaptures = getChameleonBoxerCapture(board, chameleon, to);
  if (boxerCaptures.length > 0) {
    return boxerCaptures;
  }

  // Check for withdrawer-style capture (enemy withdrawer in opposite direction of movement)
  const withdrawerCapture = getChameleonWithdrawerCapture(board, chameleon, from, to);
  if (withdrawerCapture) {
    return [withdrawerCapture];
  }

  // Check for long-leaper-style capture (jumped over enemy long leaper)
  const longLeaperCaptures = getChameleonLongLeaperCapture(board, chameleon, from, to);
  if (longLeaperCaptures.length > 0) {
    return longLeaperCaptures;
  }

  // Standard displacement capture - handled by default move logic
  return undefined;
}

/**
 * Check if chameleon is making a coordinator-style capture.
 * Returns captured coordinators at the intersection of chameleon's file/rank and king's rank/file.
 */
function getChameleonCoordinatorCapture(
  board: BoardState,
  chameleon: PieceInstance,
  newPos: Position
): { pieceId: string; position: Position }[] {
  const captures: { pieceId: string; position: Position }[] = [];

  // Find the chameleon's king
  const king = getKing(board, chameleon.owner);
  if (!king || !king.position) return captures;

  // Check position 1: King's file, Chameleon's new rank
  const pos1: Position = { file: king.position.file, rank: newPos.rank };
  const piece1 = getPieceAt(board, pos1);
  if (piece1 && piece1.owner !== chameleon.owner) {
    const pieceType1 = PIECE_BY_ID[piece1.typeId];
    if (pieceType1?.captureType === 'coordinator' && pieceType1.canBeCaptured) {
      captures.push({ pieceId: piece1.id, position: pos1 });
    }
  }

  // Check position 2: Chameleon's new file, King's rank
  const pos2: Position = { file: newPos.file, rank: king.position.rank };
  const piece2 = getPieceAt(board, pos2);
  if (piece2 && piece2.owner !== chameleon.owner && piece2.id !== piece1?.id) {
    const pieceType2 = PIECE_BY_ID[piece2.typeId];
    if (pieceType2?.captureType === 'coordinator' && pieceType2.canBeCaptured) {
      captures.push({ pieceId: piece2.id, position: pos2 });
    }
  }

  return captures;
}

/**
 * Check if chameleon is making a boxer-style capture.
 * Returns captured boxers that are orthogonally adjacent with friendly piece on opposite side.
 */
function getChameleonBoxerCapture(
  board: BoardState,
  chameleon: PieceInstance,
  newPos: Position
): { pieceId: string; position: Position }[] {
  const captures: { pieceId: string; position: Position }[] = [];
  const files: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const newFileIndex = files.indexOf(newPos.file);

  const orthogonalDirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const dir of orthogonalDirs) {
    // Position of potential enemy boxer (adjacent to chameleon's new position)
    const enemyFileIndex = newFileIndex + dir.dx;
    const enemyRank = newPos.rank + dir.dy;

    if (enemyFileIndex < 0 || enemyFileIndex >= files.length) continue;
    if (enemyRank < 1 || enemyRank > 10) continue;

    const enemyPos: Position = {
      file: files[enemyFileIndex],
      rank: enemyRank as Rank,
    };

    // Check if there's an enemy boxer at this position
    const enemyPiece = getPieceAt(board, enemyPos);
    if (!enemyPiece || enemyPiece.owner === chameleon.owner) continue;

    const enemyType = PIECE_BY_ID[enemyPiece.typeId];
    if (!enemyType || enemyType.captureType !== 'boxer') continue;
    if (!enemyType.canBeCaptured) continue;

    // Check if there's a friendly piece on the opposite side of the boxer
    const friendlyFileIndex = newFileIndex + dir.dx * 2;
    const friendlyRank = newPos.rank + dir.dy * 2;

    if (friendlyFileIndex < 0 || friendlyFileIndex >= files.length) continue;
    if (friendlyRank < 1 || friendlyRank > 10) continue;

    const friendlyPos: Position = {
      file: files[friendlyFileIndex],
      rank: friendlyRank as Rank,
    };

    const friendlyPiece = getPieceAt(board, friendlyPos);
    if (friendlyPiece && friendlyPiece.owner === chameleon.owner) {
      captures.push({ pieceId: enemyPiece.id, position: enemyPos });
    }
  }

  return captures;
}

/**
 * Check if chameleon is making a withdrawer-style capture.
 * Returns the captured withdrawer if chameleon moved away from it.
 */
function getChameleonWithdrawerCapture(
  board: BoardState,
  chameleon: PieceInstance,
  from: Position,
  to: Position
): { pieceId: string; position: Position } | null {
  // Calculate movement direction
  const dx = fileToIndex(to.file) - fileToIndex(from.file);
  const dy = to.rank - from.rank;

  // The withdrawer would be in the opposite direction from 'from' position
  const captureFile = fileToIndex(from.file) - Math.sign(dx);
  const captureRank = from.rank - Math.sign(dy);

  const files: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  if (captureFile < 0 || captureFile >= files.length) return null;
  if (captureRank < 1 || captureRank > 10) return null;

  const capturePos: Position = {
    file: files[captureFile],
    rank: captureRank as Rank,
  };

  const piece = getPieceAt(board, capturePos);
  if (!piece || piece.owner === chameleon.owner) return null;

  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType || pieceType.captureType !== 'withdrawal') return null;
  if (!pieceType.canBeCaptured) return null;

  return { pieceId: piece.id, position: capturePos };
}

/**
 * Check if chameleon is making a long-leaper-style capture.
 * Returns all enemy pieces jumped over, but ONLY if at least one is a long leaper.
 * Once in "long leaper mode" (jumping over a long leaper), the chameleon captures
 * all enemy pieces in the path, not just long leapers.
 */
function getChameleonLongLeaperCapture(
  board: BoardState,
  chameleon: PieceInstance,
  from: Position,
  to: Position
): { pieceId: string; position: Position }[] {
  const files: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  // Calculate direction of movement
  const fromFileIndex = files.indexOf(from.file);
  const toFileIndex = files.indexOf(to.file);
  const dx = toFileIndex - fromFileIndex;
  const dy = to.rank - from.rank;

  // Must be in a straight line
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) {
    return [];
  }

  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (distance === 0) return [];

  const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
  const stepY = dy === 0 ? 0 : dy / Math.abs(dy);

  // Walk the path and collect all jumped enemy pieces
  const allJumpedPieces: { pieceId: string; position: Position }[] = [];
  let hasLongLeaper = false;

  let currentFileIndex = fromFileIndex;
  let currentRank = from.rank;

  for (let i = 0; i < distance; i++) {
    currentFileIndex += stepX;
    currentRank += stepY;

    const pos: Position = {
      file: files[currentFileIndex],
      rank: currentRank as Rank,
    };

    const piece = getPieceAt(board, pos);
    if (piece && piece.owner !== chameleon.owner) {
      const pieceType = PIECE_BY_ID[piece.typeId];
      if (pieceType?.canBeCaptured !== false) {
        allJumpedPieces.push({ pieceId: piece.id, position: pos });
        // Track if at least one is a long leaper
        if (pieceType?.captureType === 'long-leap') {
          hasLongLeaper = true;
        }
      }
    }
  }

  // Only return captures if at least one piece was a long leaper
  return hasLongLeaper ? allJumpedPieces : [];
}

// =============================================================================
// Move Creation
// =============================================================================

/**
 * Create a Move object from move parameters
 */
export function createMove(
  board: BoardState,
  piece: PieceInstance,
  from: Position,
  to: Position,
  options: {
    isCastling?: boolean;
    castlingRookId?: string;
    castlingRookFrom?: Position;
    castlingRookTo?: Position;
    isEnPassant?: boolean;
    capturePosition?: Position;
    isPromotion?: boolean;
    promotionPieceType?: string;
    additionalCaptures?: { pieceId: string; position: Position }[];
    isSwap?: boolean;
    swapPieceId?: string;
  } = {}
): Move {
  const capturedPiece = options.capturePosition
    ? getPieceAt(board, options.capturePosition)
    : getPieceAt(board, to);

  const pieceType = PIECE_BY_ID[piece.typeId];

  // Count total captures for notation
  const hasCapture = !!capturedPiece || !!(options.additionalCaptures && options.additionalCaptures.length > 0);

  return {
    pieceId: piece.id,
    from,
    to,
    capturedPieceId: capturedPiece?.id ?? null,
    capturePosition: capturedPiece ? (options.capturePosition ?? to) : null,
    additionalCaptures: options.additionalCaptures,
    isCastling: options.isCastling ?? false,
    castlingRookId: options.castlingRookId ?? null,
    castlingRookFrom: options.castlingRookFrom ?? null,
    castlingRookTo: options.castlingRookTo ?? null,
    isEnPassant: options.isEnPassant ?? false,
    isPromotion: options.isPromotion ?? false,
    promotionPieceType: options.promotionPieceType ?? null,
    isSwap: options.isSwap,
    swapPieceId: options.swapPieceId,
    notation: generateNotation(pieceType?.symbol ?? '?', from, to, hasCapture, options),
  };
}

/**
 * Generate algebraic notation for a move
 */
function generateNotation(
  symbol: string,
  from: Position,
  to: Position,
  isCapture: boolean,
  options: {
    isCastling?: boolean;
    isPromotion?: boolean;
    promotionPieceType?: string;
  }
): string {
  // Castling notation
  if (options.isCastling) {
    const dx = fileToIndex(to.file) - fileToIndex(from.file);
    return dx > 0 ? 'O-O' : 'O-O-O';
  }

  let notation = '';

  // Piece symbol (except pawns)
  if (symbol !== 'P') {
    notation += symbol;
  }

  // Capture symbol
  if (isCapture) {
    if (symbol === 'P') {
      notation += from.file;
    }
    notation += 'x';
  }

  // Destination
  notation += `${to.file}${to.rank}`;

  // Promotion
  if (options.isPromotion && options.promotionPieceType) {
    const promoType = PIECE_BY_ID[options.promotionPieceType];
    notation += `=${promoType?.symbol ?? '?'}`;
  }

  return notation;
}

// =============================================================================
// Move Execution
// =============================================================================

/**
 * Execute a move and return the new game state
 */
export function executeMove(gameState: GameState, move: Move): GameState {
  const newBoard = cloneBoardState(gameState.board);
  const piece = getPieceById(newBoard, move.pieceId);

  if (!piece) {
    throw new Error(`Piece not found: ${move.pieceId}`);
  }

  // Handle capture
  if (move.capturedPieceId) {
    const capturedIndex = newBoard.pieces.findIndex((p) => p.id === move.capturedPieceId);
    if (capturedIndex !== -1) {
      newBoard.pieces[capturedIndex] = {
        ...newBoard.pieces[capturedIndex],
        position: null,
      };
    }
  }

  // Handle additional captures (Coordinator, Boxer)
  if (move.additionalCaptures) {
    for (const capture of move.additionalCaptures) {
      const capturedIndex = newBoard.pieces.findIndex((p) => p.id === capture.pieceId);
      if (capturedIndex !== -1) {
        newBoard.pieces[capturedIndex] = {
          ...newBoard.pieces[capturedIndex],
          position: null,
        };
      }
    }
  }

  // Move the piece
  const pieceIndex = newBoard.pieces.findIndex((p) => p.id === move.pieceId);
  if (pieceIndex !== -1) {
    newBoard.pieces[pieceIndex] = {
      ...newBoard.pieces[pieceIndex],
      position: move.to,
      hasMoved: true,
    };
  }

  // Handle castling - move the rook
  if (move.isCastling && move.castlingRookId && move.castlingRookTo) {
    const rookIndex = newBoard.pieces.findIndex((p) => p.id === move.castlingRookId);
    if (rookIndex !== -1) {
      newBoard.pieces[rookIndex] = {
        ...newBoard.pieces[rookIndex],
        position: move.castlingRookTo,
        hasMoved: true,
      };
    }
  }

  // Handle swap - move the swapped piece to the original position
  if (move.isSwap && move.swapPieceId) {
    const swapIndex = newBoard.pieces.findIndex((p) => p.id === move.swapPieceId);
    if (swapIndex !== -1) {
      newBoard.pieces[swapIndex] = {
        ...newBoard.pieces[swapIndex],
        position: move.from,
        hasMoved: true,
      };
    }
  }

  // Handle promotion - replace pawn with promoted piece
  if (move.isPromotion && move.promotionPieceType) {
    const promoIndex = newBoard.pieces.findIndex((p) => p.id === move.pieceId);
    if (promoIndex !== -1) {
      newBoard.pieces[promoIndex] = {
        ...newBoard.pieces[promoIndex],
        typeId: move.promotionPieceType,
      };
    }
  }

  // Rebuild position map
  newBoard.positionMap = createPositionMap(newBoard.pieces);

  // Update frozen states for all pieces
  const boardWithFrozen = updateFrozenStates(newBoard);

  // Calculate new en passant target
  let enPassantTarget: Position | null = null;
  const pieceType = PIECE_BY_ID[piece.typeId];

  if (pieceType?.movement.special.includes('pawn-forward')) {
    const dy = move.to.rank - move.from.rank;
    if (Math.abs(dy) === 2) {
      // Pawn double-moved, set en passant target
      const epRank = (move.from.rank + (dy > 0 ? 1 : -1)) as Rank;
      enPassantTarget = { file: move.to.file, rank: epRank };
    }
  }

  // Switch turn
  const nextTurn = getOpponentColor(gameState.currentTurn);

  // Increment turn number (after black moves)
  const newTurnNumber = nextTurn === 'white' ? gameState.turnNumber + 1 : gameState.turnNumber;

  // Check if opponent is now in check
  const inCheck = isInCheck(boardWithFrozen, nextTurn) ? nextTurn : null;

  return {
    ...gameState,
    board: boardWithFrozen,
    currentTurn: nextTurn,
    turnNumber: newTurnNumber,
    enPassantTarget,
    inCheck,
    moveHistory: [...gameState.moveHistory, move],
  };
}

// =============================================================================
// Move Preparation
// =============================================================================

/**
 * Prepare a move from user input (from position to position)
 * Handles special move detection (castling, en passant, promotion)
 */
export function prepareMoveFromPositions(
  gameState: GameState,
  piece: PieceInstance,
  from: Position,
  to: Position,
  promotionPieceType?: string
): Move | null {
  if (!piece.position) return null;

  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return null;

  // Check for castling
  if (pieceType.isRoyal) {
    const castling = isCastlingMove(piece, to, gameState.board);
    if (castling) {
      return createMove(gameState.board, piece, from, to, {
        isCastling: true,
        castlingRookId: castling.rookId,
        castlingRookFrom: castling.rookFrom,
        castlingRookTo: castling.rookTo,
      });
    }
  }

  // Check for en passant
  let isEnPassant = false;
  let capturePosition: Position | undefined;

  if (
    gameState.enPassantTarget &&
    pieceType.movement.special.includes('pawn-capture-diagonal') &&
    to.file === gameState.enPassantTarget.file &&
    to.rank === gameState.enPassantTarget.rank
  ) {
    isEnPassant = true;
    const direction = piece.owner === 'white' ? 1 : -1;
    capturePosition = {
      file: to.file,
      rank: (to.rank - direction) as Rank,
    };
  }

  // Check for promotion
  const isPawnPromotion = isPromotionMove(piece, pieceType, to, gameState.board.dimensions);

  // Check for swap move (Phantom King, Chamberlain)
  let isSwap = false;
  let swapPieceId: string | undefined;

  if (pieceType.movement.special.includes('swap-adjacent')) {
    const targetPiece = getPieceAt(gameState.board, to);
    if (targetPiece && targetPiece.owner === piece.owner) {
      isSwap = true;
      swapPieceId = targetPiece.id;
    }
  }

  // Check for special captures (Coordinator, Withdrawer, etc.)
  let additionalCaptures: { pieceId: string; position: Position }[] | undefined;

  if (pieceType.captureType === 'coordinator') {
    const coordCaptures = getCoordinatorCaptures(gameState.board, piece.owner, to);
    if (coordCaptures.length > 0) {
      additionalCaptures = coordCaptures;
    }
  } else if (pieceType.captureType === 'withdrawal') {
    const withdrawCapture = getWithdrawerCapture(gameState.board, piece.owner, from, to);
    if (withdrawCapture) {
      additionalCaptures = [withdrawCapture];
    }
  } else if (pieceType.captureType === 'boxer') {
    const boxerCaptures = getBoxerCaptures(gameState.board, piece.owner, to);
    if (boxerCaptures.length > 0) {
      additionalCaptures = boxerCaptures;
    }
  } else if (pieceType.captureType === 'thief') {
    const thiefCapture = getThiefCapture(gameState.board, piece.owner, from, to);
    if (thiefCapture) {
      additionalCaptures = [thiefCapture];
    }
  } else if (pieceType.captureType === 'long-leap') {
    const longLeapCaptures = getLongLeaperCaptures(gameState.board, piece.owner, from, to);
    if (longLeapCaptures.length > 0) {
      additionalCaptures = longLeapCaptures;
    }
  } else if (pieceType.captureType === 'chameleon') {
    const chameleonCaptures = getChameleonCaptures(gameState.board, piece, from, to);
    if (chameleonCaptures && chameleonCaptures.length > 0) {
      additionalCaptures = chameleonCaptures;
    }
  }

  return createMove(gameState.board, piece, from, to, {
    isEnPassant,
    capturePosition,
    isPromotion: isPawnPromotion,
    promotionPieceType: isPawnPromotion ? promotionPieceType : undefined,
    additionalCaptures,
    isSwap,
    swapPieceId,
  });
}

// =============================================================================
// Initial Game State
// =============================================================================

/**
 * Create initial game state for standard chess
 */
export function createInitialGameState(
  pieces: PieceInstance[],
  boardSize: '8x8' | '10x8' | '10x10' = '8x8',
  pointBudget: number = 0
): GameState {
  const dimensions = {
    '8x8': { files: 8, ranks: 8 },
    '10x8': { files: 10, ranks: 8 },
    '10x10': { files: 10, ranks: 10 },
  }[boardSize];

  return {
    phase: 'play',
    boardSize,
    board: {
      dimensions,
      pieces,
      positionMap: createPositionMap(pieces),
    },
    players: {
      white: { color: 'white', budget: pointBudget, remainingBudget: 0, victoryPoints: 0 },
      black: { color: 'black', budget: pointBudget, remainingBudget: 0, victoryPoints: 0 },
    },
    currentTurn: 'white',
    turnNumber: 1,
    pointBudget,
    placementMode: 'alternating',
    draft: null,
    inCheck: null,
    moveHistory: [],
    enPassantTarget: null,
    result: null,
  };
}

/**
 * Create empty game state for placement phase
 */
export function createEmptyGameState(
  boardSize: '8x8' | '10x8' | '10x10' = '8x8',
  pointBudget: number = 0
): GameState {
  const dimensions = {
    '8x8': { files: 8, ranks: 8 },
    '10x8': { files: 10, ranks: 8 },
    '10x10': { files: 10, ranks: 10 },
  }[boardSize];

  return {
    phase: 'placement',
    boardSize,
    board: {
      dimensions,
      pieces: [],
      positionMap: new Map(),
    },
    players: {
      white: { color: 'white', budget: pointBudget, remainingBudget: 0, victoryPoints: 0 },
      black: { color: 'black', budget: pointBudget, remainingBudget: 0, victoryPoints: 0 },
    },
    currentTurn: 'white',
    turnNumber: 1,
    pointBudget,
    placementMode: 'alternating',
    draft: null,
    inCheck: null,
    moveHistory: [],
    enPassantTarget: null,
    result: null,
  };
}

/**
 * Create standard chess starting position pieces
 */
export function createStandardChessPieces(): PieceInstance[] {
  const pieces: PieceInstance[] = [];
  let idCounter = 1;

  const createPiece = (
    typeId: string,
    owner: PlayerColor,
    file: File,
    rank: Rank
  ): PieceInstance => ({
    id: `${owner[0]}${typeId[0]}${idCounter++}`,
    typeId,
    owner,
    position: { file, rank },
    hasMoved: false,
    isFrozen: false,
  });

  // Back rank pieces
  const backRankSetup: [File, string][] = [
    ['a', 'rook'],
    ['b', 'knight'],
    ['c', 'bishop'],
    ['d', 'queen'],
    ['e', 'king'],
    ['f', 'bishop'],
    ['g', 'knight'],
    ['h', 'rook'],
  ];

  // White back rank
  for (const [file, typeId] of backRankSetup) {
    pieces.push(createPiece(typeId, 'white', file, 1));
  }

  // White pawns
  for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as File[]) {
    pieces.push(createPiece('pawn', 'white', file, 2));
  }

  // Black back rank
  for (const [file, typeId] of backRankSetup) {
    pieces.push(createPiece(typeId, 'black', file, 8));
  }

  // Black pawns
  for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as File[]) {
    pieces.push(createPiece('pawn', 'black', file, 7));
  }

  return pieces;
}

/**
 * Tests for Checkers piece movement
 */

import { describe, it, expect } from 'vitest';
import type { BoardState, Position, PieceInstance, BoardDimensions } from '../types';
import { generatePseudoLegalMoves } from './moveGeneration';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import { isPawnType } from '../rules/promotion';

// Helper to create a minimal board state
function createBoard(pieces: PieceInstance[], dimensions: BoardDimensions = { files: 8, ranks: 8 }): BoardState {
  const positionMap = new Map<string, string>();
  for (const piece of pieces) {
    if (piece.position) {
      positionMap.set(`${piece.position.file}${piece.position.rank}`, piece.id);
    }
  }
  return { dimensions, pieces, positionMap };
}

// Helper to create a piece
function createPiece(
  id: string,
  typeId: string,
  owner: 'white' | 'black',
  position: Position | null
): PieceInstance {
  return {
    id,
    typeId,
    owner,
    position,
    hasMoved: false,
    isFrozen: false,
  };
}

// Helper to check if a position is in the moves list
function hasMove(moves: Position[], file: string, rank: number): boolean {
  return moves.some((m) => m.file === file && m.rank === rank);
}

describe('Checkers piece', () => {
  describe('Non-capturing movement', () => {
    it('white checker moves diagonally forward (1 square)', () => {
      const checker = createPiece('wc1', 'checker', 'white', { file: 'd', rank: 3 } as Position);
      const board = createBoard([checker]);

      const moves = generatePseudoLegalMoves(board, checker, null);

      // Should move to c4 and e4 (diagonally forward)
      expect(hasMove(moves, 'c', 4)).toBe(true);
      expect(hasMove(moves, 'e', 4)).toBe(true);
      // Should NOT move backward or sideways
      expect(hasMove(moves, 'c', 2)).toBe(false);
      expect(hasMove(moves, 'e', 2)).toBe(false);
      expect(hasMove(moves, 'c', 3)).toBe(false);
    });

    it('black checker moves diagonally forward (downward on board)', () => {
      const checker = createPiece('bc1', 'checker', 'black', { file: 'd', rank: 6 } as Position);
      const board = createBoard([checker]);

      const moves = generatePseudoLegalMoves(board, checker, null);

      // Black moves "forward" = downward (decreasing rank)
      expect(hasMove(moves, 'c', 5)).toBe(true);
      expect(hasMove(moves, 'e', 5)).toBe(true);
      // Should NOT move backward (upward)
      expect(hasMove(moves, 'c', 7)).toBe(false);
      expect(hasMove(moves, 'e', 7)).toBe(false);
    });

    it('checker at edge of board has limited moves', () => {
      const checker = createPiece('wc1', 'checker', 'white', { file: 'a', rank: 3 } as Position);
      const board = createBoard([checker]);

      const moves = generatePseudoLegalMoves(board, checker, null);

      // Can only move to b4 (forward-right), not beyond edge
      expect(hasMove(moves, 'b', 4)).toBe(true);
      // No move to left (off board)
      expect(moves.length).toBe(1);
    });

    it('checker cannot move to occupied square', () => {
      const checker = createPiece('wc1', 'checker', 'white', { file: 'd', rank: 3 } as Position);
      const blocker = createPiece('wp1', 'pawn', 'white', { file: 'c', rank: 4 } as Position);
      const board = createBoard([checker, blocker]);

      const moves = generatePseudoLegalMoves(board, checker, null);

      // c4 is blocked by friendly piece
      expect(hasMove(moves, 'c', 4)).toBe(false);
      // e4 is still available
      expect(hasMove(moves, 'e', 4)).toBe(true);
    });
  });

  describe('Jump captures', () => {
    it('white checker captures by jumping over enemy diagonally forward', () => {
      const checker = createPiece('wc1', 'checker', 'white', { file: 'd', rank: 3 } as Position);
      const enemy = createPiece('bp1', 'pawn', 'black', { file: 'c', rank: 4 } as Position);
      const board = createBoard([checker, enemy]);

      const moves = generatePseudoLegalMoves(board, checker, null);

      // Can jump to b5 (over enemy at c4)
      expect(hasMove(moves, 'b', 5)).toBe(true);
      // Can still move to e4 (regular move)
      expect(hasMove(moves, 'e', 4)).toBe(true);
      // Cannot move to c4 (occupied by enemy, not a valid non-capture move)
      expect(hasMove(moves, 'c', 4)).toBe(false);
    });

    it('checker cannot jump backward', () => {
      const checker = createPiece('wc1', 'checker', 'white', { file: 'd', rank: 5 } as Position);
      const enemy = createPiece('bp1', 'pawn', 'black', { file: 'c', rank: 4 } as Position);
      const board = createBoard([checker, enemy]);

      const moves = generatePseudoLegalMoves(board, checker, null);

      // Cannot jump backward over enemy (c4 is backward-left for white)
      expect(hasMove(moves, 'b', 3)).toBe(false);
    });

    it('checker cannot jump if landing square is occupied', () => {
      const checker = createPiece('wc1', 'checker', 'white', { file: 'd', rank: 3 } as Position);
      const enemy = createPiece('bp1', 'pawn', 'black', { file: 'c', rank: 4 } as Position);
      const blocker = createPiece('bp2', 'pawn', 'black', { file: 'b', rank: 5 } as Position);
      const board = createBoard([checker, enemy, blocker]);

      const moves = generatePseudoLegalMoves(board, checker, null);

      // Cannot jump to b5 (occupied)
      expect(hasMove(moves, 'b', 5)).toBe(false);
    });

    it('checker can chain multiple captures', () => {
      const checker = createPiece('wc1', 'checker', 'white', { file: 'a', rank: 1 } as Position);
      const enemy1 = createPiece('bp1', 'pawn', 'black', { file: 'b', rank: 2 } as Position);
      const enemy2 = createPiece('bp2', 'pawn', 'black', { file: 'd', rank: 4 } as Position);
      const board = createBoard([checker, enemy1, enemy2]);

      const moves = generatePseudoLegalMoves(board, checker, null);

      // Can jump to c3 (over enemy at b2)
      expect(hasMove(moves, 'c', 3)).toBe(true);
      // Can chain to e5 (over enemy at d4)
      expect(hasMove(moves, 'e', 5)).toBe(true);
    });
  });
});

describe('Checker King piece', () => {
  describe('Non-capturing movement', () => {
    it('checker king moves diagonally in any direction (via leaps)', () => {
      const king = createPiece('wck1', 'checker-king', 'white', { file: 'd', rank: 4 } as Position);
      const board = createBoard([king]);

      const moves = generatePseudoLegalMoves(board, king, null);

      // Can move to all 4 diagonal squares
      expect(hasMove(moves, 'c', 5)).toBe(true);
      expect(hasMove(moves, 'e', 5)).toBe(true);
      expect(hasMove(moves, 'c', 3)).toBe(true);
      expect(hasMove(moves, 'e', 3)).toBe(true);
    });
  });

  describe('Jump captures', () => {
    it('checker king can capture diagonally backward', () => {
      const king = createPiece('wck1', 'checker-king', 'white', { file: 'd', rank: 5 } as Position);
      const enemy = createPiece('bp1', 'pawn', 'black', { file: 'c', rank: 4 } as Position);
      const board = createBoard([king, enemy]);

      const moves = generatePseudoLegalMoves(board, king, null);

      // Can jump backward to b3 (over enemy at c4)
      expect(hasMove(moves, 'b', 3)).toBe(true);
    });

    it('checker king can capture diagonally forward', () => {
      const king = createPiece('wck1', 'checker-king', 'white', { file: 'd', rank: 3 } as Position);
      const enemy = createPiece('bp1', 'pawn', 'black', { file: 'c', rank: 4 } as Position);
      const board = createBoard([king, enemy]);

      const moves = generatePseudoLegalMoves(board, king, null);

      // Can jump forward to b5 (over enemy at c4)
      expect(hasMove(moves, 'b', 5)).toBe(true);
    });

    it('checker king can chain captures in any diagonal direction', () => {
      const king = createPiece('wck1', 'checker-king', 'white', { file: 'c', rank: 5 } as Position);
      const enemy1 = createPiece('bp1', 'pawn', 'black', { file: 'b', rank: 4 } as Position);
      const enemy2 = createPiece('bp2', 'pawn', 'black', { file: 'b', rank: 2 } as Position);
      const board = createBoard([king, enemy1, enemy2]);

      const moves = generatePseudoLegalMoves(board, king, null);

      // Can jump to a3 (over enemy at b4)
      expect(hasMove(moves, 'a', 3)).toBe(true);
      // Can chain to c1 (over enemy at b2)
      expect(hasMove(moves, 'c', 1)).toBe(true);
    });
  });
});

describe('Draft exclusion', () => {
  it('checker-king has promotionOnly flag', () => {
    const checkerKing = PIECE_BY_ID['checker-king'];
    expect(checkerKing).toBeDefined();
    expect(checkerKing?.promotionOnly).toBe(true);
  });

  it('checkers does not have promotionOnly flag', () => {
    const checkers = PIECE_BY_ID['checker'];
    expect(checkers).toBeDefined();
    expect(checkers?.promotionOnly).toBeFalsy();
  });
});

describe('Promotion', () => {
  it('checkers piece type is recognized as pawn type for promotion', () => {
    const checkers = PIECE_BY_ID['checker'];
    expect(checkers).toBeDefined();
    expect(isPawnType(checkers!)).toBe(true);
  });

  it('checker king is not a pawn type', () => {
    const checkerKing = PIECE_BY_ID['checker-king'];
    expect(checkerKing).toBeDefined();
    expect(isPawnType(checkerKing!)).toBe(false);
  });
});

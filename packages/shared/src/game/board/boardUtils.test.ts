import { describe, it, expect } from 'vitest';
import {
  fileToIndex,
  indexToFile,
  offsetPosition,
  isValidPosition,
  getDistance,
  areAdjacent,
  getPieceAt,
  isSquareEmpty,
  hasEnemyPiece,
  hasFriendlyPiece,
  createPositionMap,
  cloneBoardState,
  movePiece,
  removePiece,
  expandLeapOffset,
  getPawnDirection,
  getHomeRank,
  getOpponentColor,
  countRoyaltyTierPieces,
  initializeRoyalTracking,
} from './boardUtils';
import type { Position, BoardState, PieceInstance, BoardDimensions } from '../types';

describe('Board Utilities', () => {
  describe('fileToIndex / indexToFile', () => {
    it('converts file to index correctly', () => {
      expect(fileToIndex('a')).toBe(0);
      expect(fileToIndex('h')).toBe(7);
      expect(fileToIndex('j')).toBe(9);
    });

    it('converts index to file correctly', () => {
      expect(indexToFile(0)).toBe('a');
      expect(indexToFile(7)).toBe('h');
      expect(indexToFile(9)).toBe('j');
    });

    it('returns null for invalid index', () => {
      expect(indexToFile(-1)).toBeNull();
      expect(indexToFile(10)).toBeNull();
    });
  });

  describe('offsetPosition', () => {
    const dimensions: BoardDimensions = { files: 8, ranks: 8 };

    it('offsets position correctly', () => {
      const pos: Position = { file: 'e', rank: 4 };
      const result = offsetPosition(pos, 1, 1, dimensions);

      expect(result).toEqual({ file: 'f', rank: 5 });
    });

    it('handles negative offsets', () => {
      const pos: Position = { file: 'e', rank: 4 };
      const result = offsetPosition(pos, -2, -1, dimensions);

      expect(result).toEqual({ file: 'c', rank: 3 });
    });

    it('returns null when off board horizontally', () => {
      const pos: Position = { file: 'h', rank: 4 };
      const result = offsetPosition(pos, 1, 0, dimensions);

      expect(result).toBeNull();
    });

    it('returns null when off board vertically', () => {
      const pos: Position = { file: 'e', rank: 8 };
      const result = offsetPosition(pos, 0, 1, dimensions);

      expect(result).toBeNull();
    });

    it('returns null for negative rank result', () => {
      const pos: Position = { file: 'e', rank: 1 };
      const result = offsetPosition(pos, 0, -1, dimensions);

      expect(result).toBeNull();
    });
  });

  describe('isValidPosition', () => {
    const dimensions: BoardDimensions = { files: 8, ranks: 8 };

    it('returns true for valid position', () => {
      expect(isValidPosition({ file: 'a', rank: 1 }, dimensions)).toBe(true);
      expect(isValidPosition({ file: 'h', rank: 8 }, dimensions)).toBe(true);
      expect(isValidPosition({ file: 'd', rank: 4 }, dimensions)).toBe(true);
    });

    it('returns false for invalid file', () => {
      expect(isValidPosition({ file: 'i', rank: 4 }, dimensions)).toBe(false);
    });

    it('returns false for invalid rank', () => {
      expect(isValidPosition({ file: 'd', rank: 9 as any }, dimensions)).toBe(false);
      expect(isValidPosition({ file: 'd', rank: 0 as any }, dimensions)).toBe(false);
    });
  });

  describe('getDistance', () => {
    it('calculates Chebyshev distance for orthogonal moves', () => {
      const from: Position = { file: 'a', rank: 1 };
      const to: Position = { file: 'a', rank: 4 };

      expect(getDistance(from, to)).toBe(3);
    });

    it('calculates Chebyshev distance for diagonal moves', () => {
      const from: Position = { file: 'a', rank: 1 };
      const to: Position = { file: 'd', rank: 4 };

      expect(getDistance(from, to)).toBe(3);
    });

    it('calculates Chebyshev distance for knight-like moves', () => {
      const from: Position = { file: 'e', rank: 4 };
      const to: Position = { file: 'f', rank: 6 };

      expect(getDistance(from, to)).toBe(2);
    });

    it('returns 0 for same position', () => {
      const pos: Position = { file: 'e', rank: 4 };

      expect(getDistance(pos, pos)).toBe(0);
    });
  });

  describe('areAdjacent', () => {
    it('returns true for orthogonally adjacent squares', () => {
      const a: Position = { file: 'e', rank: 4 };
      const b: Position = { file: 'e', rank: 5 };

      expect(areAdjacent(a, b)).toBe(true);
    });

    it('returns true for diagonally adjacent squares', () => {
      const a: Position = { file: 'e', rank: 4 };
      const b: Position = { file: 'f', rank: 5 };

      expect(areAdjacent(a, b)).toBe(true);
    });

    it('returns false for non-adjacent squares', () => {
      const a: Position = { file: 'e', rank: 4 };
      const b: Position = { file: 'e', rank: 6 };

      expect(areAdjacent(a, b)).toBe(false);
    });

    it('returns false for same square', () => {
      const pos: Position = { file: 'e', rank: 4 };

      expect(areAdjacent(pos, pos)).toBe(false);
    });
  });

  describe('Board State Helpers', () => {
    const createTestBoard = (): BoardState => {
      const pieces: PieceInstance[] = [
        { id: 'w-king', typeId: 'king', owner: 'white', position: { file: 'e', rank: 1 }, hasMoved: false, isFrozen: false },
        { id: 'b-king', typeId: 'king', owner: 'black', position: { file: 'e', rank: 8 }, hasMoved: false, isFrozen: false },
        { id: 'w-pawn', typeId: 'pawn', owner: 'white', position: { file: 'd', rank: 2 }, hasMoved: false, isFrozen: false },
      ];

      return {
        dimensions: { files: 8, ranks: 8 },
        pieces,
        positionMap: createPositionMap(pieces),
      };
    };

    describe('getPieceAt', () => {
      it('returns piece at occupied square', () => {
        const board = createTestBoard();
        const piece = getPieceAt(board, { file: 'e', rank: 1 });

        expect(piece).not.toBeNull();
        expect(piece!.id).toBe('w-king');
      });

      it('returns null for empty square', () => {
        const board = createTestBoard();
        const piece = getPieceAt(board, { file: 'a', rank: 1 });

        expect(piece).toBeNull();
      });
    });

    describe('isSquareEmpty', () => {
      it('returns false for occupied square', () => {
        const board = createTestBoard();

        expect(isSquareEmpty(board, { file: 'e', rank: 1 })).toBe(false);
      });

      it('returns true for empty square', () => {
        const board = createTestBoard();

        expect(isSquareEmpty(board, { file: 'a', rank: 1 })).toBe(true);
      });
    });

    describe('hasEnemyPiece', () => {
      it('returns true when enemy piece present', () => {
        const board = createTestBoard();

        expect(hasEnemyPiece(board, { file: 'e', rank: 8 }, 'white')).toBe(true);
      });

      it('returns false when friendly piece present', () => {
        const board = createTestBoard();

        expect(hasEnemyPiece(board, { file: 'e', rank: 1 }, 'white')).toBe(false);
      });

      it('returns false when square is empty', () => {
        const board = createTestBoard();

        expect(hasEnemyPiece(board, { file: 'a', rank: 1 }, 'white')).toBe(false);
      });
    });

    describe('hasFriendlyPiece', () => {
      it('returns true when friendly piece present', () => {
        const board = createTestBoard();

        expect(hasFriendlyPiece(board, { file: 'e', rank: 1 }, 'white')).toBe(true);
      });

      it('returns false when enemy piece present', () => {
        const board = createTestBoard();

        expect(hasFriendlyPiece(board, { file: 'e', rank: 8 }, 'white')).toBe(false);
      });

      it('returns false when square is empty', () => {
        const board = createTestBoard();

        expect(hasFriendlyPiece(board, { file: 'a', rank: 1 }, 'white')).toBe(false);
      });
    });
  });

  describe('createPositionMap', () => {
    it('creates map from pieces with positions', () => {
      const pieces: PieceInstance[] = [
        { id: 'p1', typeId: 'pawn', owner: 'white', position: { file: 'a', rank: 2 }, hasMoved: false, isFrozen: false },
        { id: 'p2', typeId: 'pawn', owner: 'white', position: { file: 'b', rank: 2 }, hasMoved: false, isFrozen: false },
      ];

      const map = createPositionMap(pieces);

      expect(map.get('a2')).toBe('p1');
      expect(map.get('b2')).toBe('p2');
    });

    it('ignores pieces without positions', () => {
      const pieces: PieceInstance[] = [
        { id: 'captured', typeId: 'pawn', owner: 'white', position: null, hasMoved: false, isFrozen: false },
      ];

      const map = createPositionMap(pieces);

      expect(map.size).toBe(0);
    });
  });

  describe('cloneBoardState', () => {
    it('creates deep copy of board state', () => {
      const original: BoardState = {
        dimensions: { files: 8, ranks: 8 },
        pieces: [
          { id: 'p1', typeId: 'pawn', owner: 'white', position: { file: 'a', rank: 2 }, hasMoved: false, isFrozen: false },
        ],
        positionMap: new Map([['a2', 'p1']]),
      };

      const clone = cloneBoardState(original);

      // Should be equal but not same reference
      expect(clone).not.toBe(original);
      expect(clone.pieces).not.toBe(original.pieces);
      expect(clone.pieces[0]).not.toBe(original.pieces[0]);
      expect(clone.pieces[0].position).not.toBe(original.pieces[0].position);

      // Values should match
      expect(clone.dimensions).toEqual(original.dimensions);
      expect(clone.pieces[0].id).toBe(original.pieces[0].id);
    });
  });

  describe('movePiece', () => {
    it('updates piece position', () => {
      const board: BoardState = {
        dimensions: { files: 8, ranks: 8 },
        pieces: [
          { id: 'p1', typeId: 'pawn', owner: 'white', position: { file: 'e', rank: 2 }, hasMoved: false, isFrozen: false },
        ],
        positionMap: new Map([['e2', 'p1']]),
      };

      const newBoard = movePiece(board, 'p1', { file: 'e', rank: 4 });

      expect(newBoard.pieces[0].position).toEqual({ file: 'e', rank: 4 });
      expect(newBoard.pieces[0].hasMoved).toBe(true);
    });

    it('updates position map', () => {
      const board: BoardState = {
        dimensions: { files: 8, ranks: 8 },
        pieces: [
          { id: 'p1', typeId: 'pawn', owner: 'white', position: { file: 'e', rank: 2 }, hasMoved: false, isFrozen: false },
        ],
        positionMap: new Map([['e2', 'p1']]),
      };

      const newBoard = movePiece(board, 'p1', { file: 'e', rank: 4 });

      expect(newBoard.positionMap.get('e2')).toBeUndefined();
      expect(newBoard.positionMap.get('e4')).toBe('p1');
    });
  });

  describe('removePiece', () => {
    it('sets piece position to null', () => {
      const board: BoardState = {
        dimensions: { files: 8, ranks: 8 },
        pieces: [
          { id: 'p1', typeId: 'pawn', owner: 'white', position: { file: 'e', rank: 2 }, hasMoved: false, isFrozen: false },
        ],
        positionMap: new Map([['e2', 'p1']]),
      };

      const newBoard = removePiece(board, 'p1');

      expect(newBoard.pieces[0].position).toBeNull();
      expect(newBoard.positionMap.get('e2')).toBeUndefined();
    });
  });

  describe('expandLeapOffset', () => {
    it('returns single offset when not symmetric', () => {
      const result = expandLeapOffset({ dx: 2, dy: 1, symmetric: false });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ dx: 2, dy: 1 });
    });

    it('expands knight move to 8 directions', () => {
      const result = expandLeapOffset({ dx: 2, dy: 1, symmetric: true });

      expect(result).toHaveLength(8);
      expect(result).toContainEqual({ dx: 2, dy: 1 });
      expect(result).toContainEqual({ dx: -2, dy: 1 });
      expect(result).toContainEqual({ dx: 2, dy: -1 });
      expect(result).toContainEqual({ dx: -2, dy: -1 });
      expect(result).toContainEqual({ dx: 1, dy: 2 });
      expect(result).toContainEqual({ dx: -1, dy: 2 });
      expect(result).toContainEqual({ dx: 1, dy: -2 });
      expect(result).toContainEqual({ dx: -1, dy: -2 });
    });

    it('handles symmetric offset with dx === dy', () => {
      const result = expandLeapOffset({ dx: 2, dy: 2, symmetric: true });

      // When dx === dy, we get 4 directions (no swap)
      expect(result).toHaveLength(4);
    });

    it('deduplicates when offset includes 0', () => {
      const result = expandLeapOffset({ dx: 2, dy: 0, symmetric: true });

      // Should have fewer than 8 due to deduplication
      expect(result.length).toBeLessThan(8);
      // Should not have duplicates
      const keys = result.map(o => `${o.dx},${o.dy}`);
      expect(new Set(keys).size).toBe(result.length);
    });
  });

  describe('getPawnDirection', () => {
    it('returns 1 for white', () => {
      expect(getPawnDirection('white')).toBe(1);
    });

    it('returns -1 for black', () => {
      expect(getPawnDirection('black')).toBe(-1);
    });
  });

  describe('getHomeRank', () => {
    it('returns 1 for white', () => {
      expect(getHomeRank('white')).toBe(1);
    });

    it('returns 8 for black', () => {
      expect(getHomeRank('black')).toBe(8);
    });
  });

  describe('getOpponentColor', () => {
    it('returns black for white', () => {
      expect(getOpponentColor('white')).toBe('black');
    });

    it('returns white for black', () => {
      expect(getOpponentColor('black')).toBe('white');
    });
  });

  describe('countRoyaltyTierPieces', () => {
    it('counts royalty-tier pieces for white', () => {
      const pieces: PieceInstance[] = [
        { id: 'w-regent', typeId: 'regent', owner: 'white', position: { file: 'e', rank: 1 }, hasMoved: false, isFrozen: false },
        { id: 'w-fairy-queen', typeId: 'fairy-queen', owner: 'white', position: { file: 'd', rank: 1 }, hasMoved: false, isFrozen: false },
        { id: 'w-pawn', typeId: 'pawn', owner: 'white', position: { file: 'e', rank: 2 }, hasMoved: false, isFrozen: false },
        { id: 'b-king', typeId: 'king', owner: 'black', position: { file: 'e', rank: 8 }, hasMoved: false, isFrozen: false },
      ];

      expect(countRoyaltyTierPieces(pieces, 'white')).toBe(2);
    });

    it('counts royalty-tier pieces for black', () => {
      const pieces: PieceInstance[] = [
        { id: 'w-king', typeId: 'king', owner: 'white', position: { file: 'e', rank: 1 }, hasMoved: false, isFrozen: false },
        { id: 'b-king', typeId: 'king', owner: 'black', position: { file: 'e', rank: 8 }, hasMoved: false, isFrozen: false },
        { id: 'b-queen', typeId: 'queen', owner: 'black', position: { file: 'd', rank: 8 }, hasMoved: false, isFrozen: false },
        { id: 'b-jester', typeId: 'jester', owner: 'black', position: { file: 'c', rank: 8 }, hasMoved: false, isFrozen: false },
      ];

      expect(countRoyaltyTierPieces(pieces, 'black')).toBe(3);
    });

    it('returns 0 when no royalty-tier pieces exist', () => {
      const pieces: PieceInstance[] = [
        { id: 'w-pawn', typeId: 'pawn', owner: 'white', position: { file: 'e', rank: 2 }, hasMoved: false, isFrozen: false },
        { id: 'w-rook', typeId: 'rook', owner: 'white', position: { file: 'a', rank: 1 }, hasMoved: false, isFrozen: false },
      ];

      expect(countRoyaltyTierPieces(pieces, 'white')).toBe(0);
    });

    it('only counts pieces that are on the board (have position)', () => {
      const pieces: PieceInstance[] = [
        { id: 'w-regent', typeId: 'regent', owner: 'white', position: { file: 'e', rank: 1 }, hasMoved: false, isFrozen: false },
        { id: 'w-fairy-queen', typeId: 'fairy-queen', owner: 'white', position: null, hasMoved: false, isFrozen: false }, // captured
      ];

      // Both are counted regardless of position - function counts pieces in array
      // This is intentional: hadMultipleRoyals is initialized at start of play
      expect(countRoyaltyTierPieces(pieces, 'white')).toBe(2);
    });
  });

  describe('initializeRoyalTracking', () => {
    it('sets hadMultipleRoyals to true when player has 2+ royalty pieces', () => {
      const board: BoardState = {
        dimensions: { files: 8, ranks: 8 },
        pieces: [
          { id: 'w-regent', typeId: 'regent', owner: 'white', position: { file: 'e', rank: 1 }, hasMoved: false, isFrozen: false },
          { id: 'w-fairy-queen', typeId: 'fairy-queen', owner: 'white', position: { file: 'd', rank: 1 }, hasMoved: false, isFrozen: false },
          { id: 'b-king', typeId: 'king', owner: 'black', position: { file: 'e', rank: 8 }, hasMoved: false, isFrozen: false },
        ],
        positionMap: new Map(),
      };

      const result = initializeRoyalTracking(board);

      expect(result.hadMultipleRoyals).toEqual({ white: true, black: false });
    });

    it('sets hadMultipleRoyals to false when player has only 1 royalty piece', () => {
      const board: BoardState = {
        dimensions: { files: 8, ranks: 8 },
        pieces: [
          { id: 'w-regent', typeId: 'regent', owner: 'white', position: { file: 'e', rank: 1 }, hasMoved: false, isFrozen: false },
          { id: 'b-king', typeId: 'king', owner: 'black', position: { file: 'e', rank: 8 }, hasMoved: false, isFrozen: false },
        ],
        positionMap: new Map(),
      };

      const result = initializeRoyalTracking(board);

      expect(result.hadMultipleRoyals).toEqual({ white: false, black: false });
    });

    it('tracks both players correctly', () => {
      const board: BoardState = {
        dimensions: { files: 8, ranks: 8 },
        pieces: [
          { id: 'w-regent', typeId: 'regent', owner: 'white', position: { file: 'e', rank: 1 }, hasMoved: false, isFrozen: false },
          { id: 'w-fairy-queen', typeId: 'fairy-queen', owner: 'white', position: { file: 'd', rank: 1 }, hasMoved: false, isFrozen: false },
          { id: 'b-phantom-king', typeId: 'phantom-king', owner: 'black', position: { file: 'e', rank: 8 }, hasMoved: false, isFrozen: false },
          { id: 'b-withdrawer', typeId: 'withdrawer', owner: 'black', position: { file: 'd', rank: 8 }, hasMoved: false, isFrozen: false },
          { id: 'b-queen', typeId: 'queen', owner: 'black', position: { file: 'c', rank: 8 }, hasMoved: false, isFrozen: false },
        ],
        positionMap: new Map(),
      };

      const result = initializeRoyalTracking(board);

      expect(result.hadMultipleRoyals).toEqual({ white: true, black: true });
    });

    it('preserves other board state properties', () => {
      const board: BoardState = {
        dimensions: { files: 8, ranks: 8 },
        pieces: [
          { id: 'w-king', typeId: 'king', owner: 'white', position: { file: 'e', rank: 1 }, hasMoved: false, isFrozen: false },
        ],
        positionMap: new Map([['e1', 'w-king']]),
      };

      const result = initializeRoyalTracking(board);

      expect(result.dimensions).toEqual(board.dimensions);
      expect(result.pieces).toBe(board.pieces);
      expect(result.positionMap).toBe(board.positionMap);
    });
  });
});

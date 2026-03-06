import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEmptyDraft,
  canAddPiece,
  addPieceToDraft,
  removePieceFromDraft,
  validateDraft,
  getAvailablePieces,
  getSlotLimits,
  getDraftPieceCount,
  getPieceCountInDraft,
  hasKingReplacer,
  createPiecesFromDraft,
  resetDraftPieceIdCounter,
  MAX_PIECE_COUNTS,
} from './draft';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import type { PieceType, BoardSize } from '../types';

describe('Draft Logic', () => {
  beforeEach(() => {
    resetDraftPieceIdCounter();
  });

  describe('createEmptyDraft', () => {
    it('creates draft with no selections', () => {
      const draft = createEmptyDraft();
      expect(draft.selections).toHaveLength(0);
      expect(draft.budgetSpent).toBe(0);
    });

    it('reserves one royalty slot for King', () => {
      const draft = createEmptyDraft();
      expect(draft.slotsUsed.royalty).toBe(1);
      expect(draft.slotsUsed.pawn).toBe(0);
      expect(draft.slotsUsed.piece).toBe(0);
    });
  });

  describe('getAvailablePieces', () => {
    it('excludes mandatory pieces like King', () => {
      const available = getAvailablePieces();
      const hasKing = available.some(p => p.id === 'king');
      expect(hasKing).toBe(false);
    });

    it('includes non-mandatory pieces', () => {
      const available = getAvailablePieces();
      expect(available.length).toBeGreaterThan(0);

      // Should include common pieces
      const hasPawn = available.some(p => p.id === 'pawn');
      const hasQueen = available.some(p => p.id === 'queen');
      expect(hasPawn).toBe(true);
      expect(hasQueen).toBe(true);
    });
  });

  describe('getSlotLimits', () => {
    it('returns correct limits for 8x8 board', () => {
      const limits = getSlotLimits('8x8');
      expect(limits.pawn).toBe(8);
      expect(limits.piece).toBe(6);
      expect(limits.royalty).toBe(2);
    });

    it('returns correct limits for 10x10 board', () => {
      const limits = getSlotLimits('10x10');
      expect(limits.pawn).toBe(10);
      expect(limits.piece).toBe(8);
      expect(limits.royalty).toBe(2);
    });
  });

  describe('canAddPiece', () => {
    const pawn = PIECE_BY_ID['pawn']!;
    const queen = PIECE_BY_ID['queen']!;
    const king = PIECE_BY_ID['king']!;

    it('allows adding piece within budget', () => {
      const draft = createEmptyDraft();
      expect(canAddPiece(draft, pawn, 400, '8x8')).toBe(true);
    });

    it('rejects piece exceeding budget', () => {
      const draft = createEmptyDraft();
      expect(canAddPiece(draft, queen, 5, '8x8')).toBe(false);
    });

    it('rejects mandatory pieces', () => {
      const draft = createEmptyDraft();
      expect(canAddPiece(draft, king, 400, '8x8')).toBe(false);
    });

    it('rejects when slot limit reached', () => {
      let draft = createEmptyDraft();
      // Fill all pawn slots (8 for 8x8)
      for (let i = 0; i < 8; i++) {
        draft = addPieceToDraft(draft, pawn);
      }
      expect(canAddPiece(draft, pawn, 900, '8x8')).toBe(false);
    });

    it('enforces per-piece-type limits (e.g., Herald max 2)', () => {
      const herald = PIECE_BY_ID['herald'];
      if (herald) {
        let draft = createEmptyDraft();
        const maxCount = MAX_PIECE_COUNTS['herald'] || 2;

        // Add up to max count
        for (let i = 0; i < maxCount; i++) {
          expect(canAddPiece(draft, herald, 900, '8x8')).toBe(true);
          draft = addPieceToDraft(draft, herald);
        }

        // Should reject additional
        expect(canAddPiece(draft, herald, 900, '8x8')).toBe(false);
      }
    });
  });

  describe('addPieceToDraft', () => {
    const pawn = PIECE_BY_ID['pawn']!;
    const rook = PIECE_BY_ID['rook']!;

    it('adds new piece to selections', () => {
      const draft = createEmptyDraft();
      const newDraft = addPieceToDraft(draft, pawn);

      expect(newDraft.selections).toHaveLength(1);
      expect(newDraft.selections[0].pieceTypeId).toBe('pawn');
      expect(newDraft.selections[0].count).toBe(1);
    });

    it('increments count for existing piece', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);
      draft = addPieceToDraft(draft, pawn);

      expect(draft.selections).toHaveLength(1);
      expect(draft.selections[0].count).toBe(2);
    });

    it('updates budget spent', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);

      expect(draft.budgetSpent).toBe(pawn.cost);
    });

    it('updates slot usage for pawn tier', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);

      expect(draft.slotsUsed.pawn).toBe(1);
    });

    it('updates slot usage for piece tier', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, rook);

      expect(draft.slotsUsed.piece).toBe(1);
    });
  });

  describe('removePieceFromDraft', () => {
    const pawn = PIECE_BY_ID['pawn']!;

    it('decrements count when count > 1', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);
      draft = addPieceToDraft(draft, pawn);
      draft = removePieceFromDraft(draft, 'pawn');

      expect(draft.selections).toHaveLength(1);
      expect(draft.selections[0].count).toBe(1);
    });

    it('removes selection entirely when count reaches 0', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);
      draft = removePieceFromDraft(draft, 'pawn');

      expect(draft.selections).toHaveLength(0);
    });

    it('returns same draft if piece not found', () => {
      const draft = createEmptyDraft();
      const result = removePieceFromDraft(draft, 'nonexistent');

      expect(result).toBe(draft);
    });

    it('updates budget spent', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);
      draft = removePieceFromDraft(draft, 'pawn');

      expect(draft.budgetSpent).toBe(0);
    });

    it('updates slot usage', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);
      draft = removePieceFromDraft(draft, 'pawn');

      expect(draft.slotsUsed.pawn).toBe(0);
    });
  });

  describe('validateDraft', () => {
    const pawn = PIECE_BY_ID['pawn']!;

    it('returns valid for empty draft', () => {
      const draft = createEmptyDraft();
      const result = validateDraft(draft, 400, '8x8');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid for draft within limits', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);

      const result = validateDraft(draft, 400, '8x8');
      expect(result.valid).toBe(true);
    });

    it('returns error for over-budget draft', () => {
      // Manually create an over-budget draft
      const draft = {
        selections: [{ pieceTypeId: 'pawn', count: 100 }],
        budgetSpent: 500,
        slotsUsed: { pawn: 100, piece: 0, royalty: 1 },
      };

      const result = validateDraft(draft, 400, '8x8');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('budget'))).toBe(true);
    });

    it('returns error for exceeding pawn slots', () => {
      const draft = {
        selections: [],
        budgetSpent: 0,
        slotsUsed: { pawn: 10, piece: 0, royalty: 1 },
      };

      const result = validateDraft(draft, 400, '8x8');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('pawn'))).toBe(true);
    });
  });

  describe('getDraftPieceCount', () => {
    const pawn = PIECE_BY_ID['pawn']!;
    const queen = PIECE_BY_ID['queen']!;

    it('includes King in count for draft without king replacer', () => {
      const draft = createEmptyDraft();
      expect(getDraftPieceCount(draft)).toBe(1); // Just the King
    });

    it('counts drafted pieces correctly', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);
      draft = addPieceToDraft(draft, pawn);
      draft = addPieceToDraft(draft, queen);

      expect(getDraftPieceCount(draft)).toBe(4); // King + 2 pawns + 1 queen
    });
  });

  describe('getPieceCountInDraft', () => {
    const pawn = PIECE_BY_ID['pawn']!;

    it('returns 0 for piece not in draft', () => {
      const draft = createEmptyDraft();
      expect(getPieceCountInDraft(draft, 'pawn')).toBe(0);
    });

    it('returns correct count for piece in draft', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);
      draft = addPieceToDraft(draft, pawn);
      draft = addPieceToDraft(draft, pawn);

      expect(getPieceCountInDraft(draft, 'pawn')).toBe(3);
    });
  });

  describe('hasKingReplacer', () => {
    it('returns false for empty draft', () => {
      const draft = createEmptyDraft();
      expect(hasKingReplacer(draft)).toBe(false);
    });

    it('returns false for draft without king replacers', () => {
      const pawn = PIECE_BY_ID['pawn']!;
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);

      expect(hasKingReplacer(draft)).toBe(false);
    });

    it('returns true when Phantom King is drafted', () => {
      const phantomKing = PIECE_BY_ID['phantom-king'];
      if (phantomKing) {
        let draft = createEmptyDraft();
        draft = addPieceToDraft(draft, phantomKing);

        expect(hasKingReplacer(draft)).toBe(true);
      }
    });
  });

  describe('createPiecesFromDraft', () => {
    const pawn = PIECE_BY_ID['pawn']!;

    it('includes King for draft without king replacer', () => {
      const draft = createEmptyDraft();
      const pieces = createPiecesFromDraft(draft, 'white');

      const kings = pieces.filter(p => p.typeId === 'king');
      expect(kings).toHaveLength(1);
      expect(kings[0].owner).toBe('white');
    });

    it('creates correct number of pieces', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);
      draft = addPieceToDraft(draft, pawn);

      const pieces = createPiecesFromDraft(draft, 'white');

      // 1 king + 2 pawns
      expect(pieces).toHaveLength(3);
    });

    it('sets correct initial properties on pieces', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);

      const pieces = createPiecesFromDraft(draft, 'black');
      const createdPawn = pieces.find(p => p.typeId === 'pawn');

      expect(createdPawn).toBeDefined();
      expect(createdPawn!.owner).toBe('black');
      expect(createdPawn!.position).toBeNull();
      expect(createdPawn!.hasMoved).toBe(false);
      expect(createdPawn!.isFrozen).toBe(false);
    });

    it('generates unique piece IDs', () => {
      let draft = createEmptyDraft();
      draft = addPieceToDraft(draft, pawn);
      draft = addPieceToDraft(draft, pawn);

      const pieces = createPiecesFromDraft(draft, 'white');
      const ids = pieces.map(p => p.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});

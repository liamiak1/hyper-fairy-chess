import { describe, it, expect } from 'vitest';
import {
  positionToString,
  stringToPosition,
  arePositionsEqual,
  BOARD_CONFIGS,
} from './types';
import type { Position } from './types';

describe('Type Utilities', () => {
  describe('positionToString', () => {
    it('converts position to string notation', () => {
      const pos: Position = { file: 'e', rank: 4 };
      expect(positionToString(pos)).toBe('e4');
    });

    it('handles edge positions', () => {
      expect(positionToString({ file: 'a', rank: 1 })).toBe('a1');
      expect(positionToString({ file: 'j', rank: 10 })).toBe('j10');
    });
  });

  describe('stringToPosition', () => {
    it('parses valid position string', () => {
      const result = stringToPosition('e4');

      expect(result).not.toBeNull();
      expect(result!.file).toBe('e');
      expect(result!.rank).toBe(4);
    });

    it('parses two-digit ranks', () => {
      const result = stringToPosition('a10');

      expect(result).not.toBeNull();
      expect(result!.file).toBe('a');
      expect(result!.rank).toBe(10);
    });

    it('returns null for invalid string', () => {
      expect(stringToPosition('invalid')).toBeNull();
      expect(stringToPosition('')).toBeNull();
      expect(stringToPosition('k1')).toBeNull(); // invalid file
    });

    it('returns null for out-of-range rank', () => {
      expect(stringToPosition('a0')).toBeNull();
      expect(stringToPosition('a11')).toBeNull();
    });
  });

  describe('arePositionsEqual', () => {
    it('returns true for identical positions', () => {
      const a: Position = { file: 'e', rank: 4 };
      const b: Position = { file: 'e', rank: 4 };

      expect(arePositionsEqual(a, b)).toBe(true);
    });

    it('returns false for different files', () => {
      const a: Position = { file: 'e', rank: 4 };
      const b: Position = { file: 'f', rank: 4 };

      expect(arePositionsEqual(a, b)).toBe(false);
    });

    it('returns false for different ranks', () => {
      const a: Position = { file: 'e', rank: 4 };
      const b: Position = { file: 'e', rank: 5 };

      expect(arePositionsEqual(a, b)).toBe(false);
    });
  });

  describe('BOARD_CONFIGS', () => {
    it('has correct dimensions for 8x8', () => {
      const config = BOARD_CONFIGS['8x8'];

      expect(config.files).toBe(8);
      expect(config.ranks).toBe(8);
    });

    it('has correct dimensions for 10x10', () => {
      const config = BOARD_CONFIGS['10x10'];

      expect(config.files).toBe(10);
      expect(config.ranks).toBe(10);
    });

    it('has correct dimensions for 10x8', () => {
      const config = BOARD_CONFIGS['10x8'];

      expect(config.files).toBe(10);
      expect(config.ranks).toBe(8);
    });

    it('has slot counts defined', () => {
      for (const config of Object.values(BOARD_CONFIGS)) {
        expect(config.pawnSlots).toBeGreaterThan(0);
        expect(config.pieceSlots).toBeGreaterThan(0);
        expect(config.royaltySlots).toBeGreaterThan(0);
      }
    });
  });
});

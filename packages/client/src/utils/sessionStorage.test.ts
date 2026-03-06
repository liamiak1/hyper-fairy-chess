/**
 * Session Storage Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getValidSession,
  saveSession,
  clearSession,
  getSavedPlayerName,
  savePlayerName,
  isSessionValid,
  getSessionAge,
  SESSION_EXPIRY,
  KEYS,
  type GameSession,
} from './sessionStorage';

describe('sessionStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset any mocked timers
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('saveSession', () => {
    it('saves room code, player ID, and timestamp to localStorage', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession('ABC123', 'player_123');

      expect(localStorage.getItem(KEYS.ROOM_CODE)).toBe('ABC123');
      expect(localStorage.getItem(KEYS.PLAYER_ID)).toBe('player_123');
      expect(localStorage.getItem(KEYS.SESSION_TIME)).toBe(now.toString());
    });

    it('overwrites existing session data', () => {
      saveSession('OLD123', 'old_player');
      saveSession('NEW456', 'new_player');

      expect(localStorage.getItem(KEYS.ROOM_CODE)).toBe('NEW456');
      expect(localStorage.getItem(KEYS.PLAYER_ID)).toBe('new_player');
    });
  });

  describe('clearSession', () => {
    it('removes all session data from localStorage', () => {
      saveSession('ABC123', 'player_123');
      clearSession();

      expect(localStorage.getItem(KEYS.ROOM_CODE)).toBeNull();
      expect(localStorage.getItem(KEYS.PLAYER_ID)).toBeNull();
      expect(localStorage.getItem(KEYS.SESSION_TIME)).toBeNull();
    });

    it('does not affect player name', () => {
      savePlayerName('TestPlayer');
      saveSession('ABC123', 'player_123');
      clearSession();

      expect(getSavedPlayerName()).toBe('TestPlayer');
    });
  });

  describe('getValidSession', () => {
    it('returns null if no session data exists', () => {
      expect(getValidSession()).toBeNull();
    });

    it('returns null if room code is missing', () => {
      localStorage.setItem(KEYS.PLAYER_ID, 'player_123');
      localStorage.setItem(KEYS.SESSION_TIME, Date.now().toString());

      expect(getValidSession()).toBeNull();
    });

    it('returns null if player ID is missing', () => {
      localStorage.setItem(KEYS.ROOM_CODE, 'ABC123');
      localStorage.setItem(KEYS.SESSION_TIME, Date.now().toString());

      expect(getValidSession()).toBeNull();
    });

    it('returns session data if valid and not expired', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession('ABC123', 'player_123');

      const session = getValidSession();
      expect(session).not.toBeNull();
      expect(session!.roomCode).toBe('ABC123');
      expect(session!.playerId).toBe('player_123');
      expect(session!.timestamp).toBe(now);
    });

    it('returns null and clears data if session is expired', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession('ABC123', 'player_123');

      // Fast forward past expiry
      vi.setSystemTime(now + SESSION_EXPIRY + 1000);

      const session = getValidSession();
      expect(session).toBeNull();

      // Should have cleared the stale data
      expect(localStorage.getItem(KEYS.ROOM_CODE)).toBeNull();
      expect(localStorage.getItem(KEYS.PLAYER_ID)).toBeNull();
      expect(localStorage.getItem(KEYS.SESSION_TIME)).toBeNull();
    });

    it('returns session if exactly at expiry boundary', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      saveSession('ABC123', 'player_123');

      // Fast forward to exactly the expiry time (should still be valid)
      vi.setSystemTime(now + SESSION_EXPIRY - 1);

      const session = getValidSession();
      expect(session).not.toBeNull();
    });

    it('handles missing timestamp gracefully (treats as expired)', () => {
      localStorage.setItem(KEYS.ROOM_CODE, 'ABC123');
      localStorage.setItem(KEYS.PLAYER_ID, 'player_123');
      // No timestamp set

      const session = getValidSession();
      expect(session).toBeNull();
    });
  });

  describe('getSavedPlayerName', () => {
    it('returns empty string if no name saved', () => {
      expect(getSavedPlayerName()).toBe('');
    });

    it('returns saved player name', () => {
      savePlayerName('ChessMaster');
      expect(getSavedPlayerName()).toBe('ChessMaster');
    });
  });

  describe('savePlayerName', () => {
    it('saves player name to localStorage', () => {
      savePlayerName('ChessMaster');
      expect(localStorage.getItem(KEYS.PLAYER_NAME)).toBe('ChessMaster');
    });

    it('overwrites existing player name', () => {
      savePlayerName('OldName');
      savePlayerName('NewName');
      expect(getSavedPlayerName()).toBe('NewName');
    });
  });

  describe('isSessionValid', () => {
    it('returns true for fresh session', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const session: GameSession = {
        roomCode: 'ABC123',
        playerId: 'player_123',
        timestamp: now,
      };

      expect(isSessionValid(session)).toBe(true);
    });

    it('returns true for session just under expiry', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const session: GameSession = {
        roomCode: 'ABC123',
        playerId: 'player_123',
        timestamp: now - SESSION_EXPIRY + 1000, // 1 second before expiry
      };

      expect(isSessionValid(session)).toBe(true);
    });

    it('returns false for expired session', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const session: GameSession = {
        roomCode: 'ABC123',
        playerId: 'player_123',
        timestamp: now - SESSION_EXPIRY - 1000, // 1 second past expiry
      };

      expect(isSessionValid(session)).toBe(false);
    });
  });

  describe('getSessionAge', () => {
    it('returns correct age in milliseconds', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const session: GameSession = {
        roomCode: 'ABC123',
        playerId: 'player_123',
        timestamp: now - 30000, // 30 seconds ago
      };

      expect(getSessionAge(session)).toBe(30000);
    });

    it('returns 0 for session created just now', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const session: GameSession = {
        roomCode: 'ABC123',
        playerId: 'player_123',
        timestamp: now,
      };

      expect(getSessionAge(session)).toBe(0);
    });
  });

  describe('SESSION_EXPIRY constant', () => {
    it('is 1 hour in milliseconds', () => {
      expect(SESSION_EXPIRY).toBe(60 * 60 * 1000);
    });
  });
});

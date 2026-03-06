/**
 * Session Storage Utilities
 * Manages game session data in localStorage for reconnection support
 */

const STORAGE_KEYS = {
  ROOM_CODE: 'hfc_roomCode',
  PLAYER_ID: 'hfc_playerId',
  SESSION_TIME: 'hfc_sessionTime',
  PLAYER_NAME: 'hfc_playerName',
} as const;

// Session expires after 1 hour
const SESSION_EXPIRY_MS = 60 * 60 * 1000;

export interface GameSession {
  roomCode: string;
  playerId: string;
  timestamp: number;
}

/**
 * Get a valid session if one exists and hasn't expired
 * Returns null if no session, or if session is older than 1 hour
 */
export function getValidSession(): GameSession | null {
  const roomCode = localStorage.getItem(STORAGE_KEYS.ROOM_CODE);
  const playerId = localStorage.getItem(STORAGE_KEYS.PLAYER_ID);
  const sessionTimeStr = localStorage.getItem(STORAGE_KEYS.SESSION_TIME);

  if (!roomCode || !playerId) {
    return null;
  }

  const sessionTime = sessionTimeStr ? parseInt(sessionTimeStr, 10) : 0;
  const sessionAge = Date.now() - sessionTime;

  if (sessionAge >= SESSION_EXPIRY_MS) {
    // Clear stale session
    clearSession();
    return null;
  }

  return {
    roomCode,
    playerId,
    timestamp: sessionTime,
  };
}

/**
 * Save session data to localStorage
 */
export function saveSession(roomCode: string, playerId: string): void {
  localStorage.setItem(STORAGE_KEYS.ROOM_CODE, roomCode);
  localStorage.setItem(STORAGE_KEYS.PLAYER_ID, playerId);
  localStorage.setItem(STORAGE_KEYS.SESSION_TIME, Date.now().toString());
}

/**
 * Clear all session data from localStorage
 */
export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.ROOM_CODE);
  localStorage.removeItem(STORAGE_KEYS.PLAYER_ID);
  localStorage.removeItem(STORAGE_KEYS.SESSION_TIME);
}

/**
 * Get the saved player name (persists across sessions)
 */
export function getSavedPlayerName(): string {
  return localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || '';
}

/**
 * Save the player name
 */
export function savePlayerName(name: string): void {
  localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
}

/**
 * Check if a session is valid (not expired)
 */
export function isSessionValid(session: GameSession): boolean {
  const sessionAge = Date.now() - session.timestamp;
  return sessionAge < SESSION_EXPIRY_MS;
}

/**
 * Get session age in milliseconds
 */
export function getSessionAge(session: GameSession): number {
  return Date.now() - session.timestamp;
}

// Export constants for testing
export const SESSION_EXPIRY = SESSION_EXPIRY_MS;
export const KEYS = STORAGE_KEYS;

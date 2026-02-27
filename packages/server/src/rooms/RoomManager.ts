/**
 * Room Manager - handles room lifecycle
 */

import { GameRoom } from './GameRoom';
import type { RoomSettings } from '@hyper-fairy-chess/shared';

// Characters that are easy to distinguish (no 0/O, 1/I/l)
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();

  /**
   * Generate a unique 6-character room code
   */
  private generateRoomCode(): string {
    let code: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
      }
      attempts++;
    } while (this.rooms.has(code) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique room code');
    }

    return code;
  }

  /**
   * Create a new game room
   */
  createRoom(settings: RoomSettings): GameRoom {
    const code = this.generateRoomCode();
    const room = new GameRoom(code, settings);
    this.rooms.set(code, room);

    console.log(`Room created: ${code} (budget: ${settings.budget}, board: ${settings.boardSize})`);

    return room;
  }

  /**
   * Get a room by code
   */
  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /**
   * Remove a room
   */
  removeRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      room.cleanup();
      this.rooms.delete(code);
      console.log(`Room removed: ${code}`);
    }
  }

  /**
   * Get server stats
   */
  getStats() {
    let totalPlayers = 0;
    let activeGames = 0;
    let waitingRooms = 0;

    for (const room of this.rooms.values()) {
      totalPlayers += room.getPlayerCount();
      if (room.isPlaying()) {
        activeGames++;
      }
      if (room.isWaiting()) {
        waitingRooms++;
      }
    }

    return {
      totalRooms: this.rooms.size,
      activeGames,
      waitingRooms,
      totalPlayers,
    };
  }

  /**
   * Cleanup stale rooms (no activity for 1 hour)
   */
  cleanupStaleRooms(): void {
    const now = Date.now();
    const staleTimeout = 60 * 60 * 1000; // 1 hour

    for (const [code, room] of this.rooms.entries()) {
      if (room.isEnded() && now - room.getLastActivity() > staleTimeout) {
        this.removeRoom(code);
      }
    }
  }
}

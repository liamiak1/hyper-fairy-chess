/**
 * Game Room - handles a single multiplayer game
 * Minimal implementation for compilation - TODO: full game logic integration
 */

import type { Server, Socket } from 'socket.io';
import type {
  RoomPhase,
  PlayerInfo,
  RoomSettings,
  ServerToClientMessage,
  DraftRevealMessage,
  PlacementStartMessage,
  PiecePlacedMessage,
  MoveMadeMessage,
  MoveRejectedMessage,
  GameOverMessage,
  SyncStateMessage,
  DraftPick,
} from '@hyper-fairy-chess/shared';
import type {
  GameState,
  PlayerColor,
  Position,
  PieceInstance,
} from '@hyper-fairy-chess/shared';
import {
  PlayerDraft,
  createEmptyDraft,
  validateDraft,
} from '@hyper-fairy-chess/shared';
import {
  PlacementState,
  createPlacementStateFromDrafts,
  isPlacementComplete,
} from '@hyper-fairy-chess/shared';
import {
  createBoardState,
  getPieceAt,
} from '@hyper-fairy-chess/shared';
import {
  generateLegalMoves,
  createMove,
  executeMove,
} from '@hyper-fairy-chess/shared';
import {
  getGameResult,
} from '@hyper-fairy-chess/shared';

interface RoomPlayer extends PlayerInfo {
  socketId: string;
  lastSeen: number;
}

const DISCONNECT_TIMEOUT = 60000; // 60 seconds
const REVEAL_DURATION = 3000; // 3 seconds to show reveal

export class GameRoom {
  readonly code: string;
  private phase: RoomPhase = 'waiting';
  private players: Map<string, RoomPlayer> = new Map();
  private settings: RoomSettings;
  private lastActivity: number;

  // Draft state
  private whiteDraft: PlayerDraft | null = null;
  private blackDraft: PlayerDraft | null = null;
  private draftDeadline: number | null = null;

  // Game state
  private placementState: PlacementState | null = null;
  private gameState: GameState | null = null;

  // Timers
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Socket.io server reference
  private io: Server | null = null;

  constructor(code: string, settings: RoomSettings) {
    this.code = code;
    this.settings = settings;
    this.lastActivity = Date.now();
  }

  // =========================================================================
  // Player Management
  // =========================================================================

  addPlayer(socket: Socket, name: string, _sessionToken?: string): {
    success: boolean;
    playerId?: string;
    color?: PlayerColor;
    error?: string;
  } {
    // Access the server through the socket's nsp (namespace)
    this.io = socket.nsp.server;
    this.lastActivity = Date.now();

    if (this.players.size >= 2) {
      return { success: false, error: 'Room is full' };
    }

    if (this.phase !== 'waiting') {
      return { success: false, error: 'Game already started' };
    }

    const color: PlayerColor = this.players.size === 0 ? 'white' : 'black';
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const player: RoomPlayer = {
      id: playerId,
      socketId: socket.id,
      name,
      color,
      connected: true,
      isAccountUser: false,
      lastSeen: Date.now(),
    };

    this.players.set(playerId, player);
    socket.join(this.code);

    if (this.players.size === 2) {
      this.startDraftCountdown();
    }

    return { success: true, playerId, color };
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    this.players.delete(playerId);
    this.lastActivity = Date.now();

    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }

    if (this.phase === 'playing' && player.color) {
      this.endGameByDisconnect(player.color);
    }
  }

  handleDisconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.connected = false;
    player.lastSeen = Date.now();
    this.lastActivity = Date.now();

    this.broadcast({
      type: 'PLAYER_DISCONNECTED',
      timestamp: Date.now(),
      playerId,
      timeoutSeconds: DISCONNECT_TIMEOUT / 1000,
    });

    if (this.phase === 'playing') {
      const timer = setTimeout(() => {
        this.handleDisconnectTimeout(playerId);
      }, DISCONNECT_TIMEOUT);
      this.disconnectTimers.set(playerId, timer);
    }
  }

  handleReconnect(playerId: string, socket: Socket): SyncStateMessage | null {
    const player = this.players.get(playerId);
    if (!player) return null;

    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }

    player.connected = true;
    player.socketId = socket.id;
    player.lastSeen = Date.now();
    this.lastActivity = Date.now();

    socket.join(this.code);

    this.broadcast({
      type: 'PLAYER_RECONNECTED',
      timestamp: Date.now(),
      playerId,
    });

    return this.buildSyncState(playerId);
  }

  private handleDisconnectTimeout(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.connected || !player.color) return;
    this.endGameByDisconnect(player.color);
  }

  private endGameByDisconnect(disconnectedColor: PlayerColor): void {
    if (!this.gameState) return;

    const winner = disconnectedColor === 'white' ? 'black' : 'white';
    this.gameState.result = {
      type: 'timeout',
      winner,
      whiteVP: 0,
      blackVP: 0,
    };
    this.phase = 'ended';

    this.broadcast({
      type: 'GAME_OVER',
      timestamp: Date.now(),
      result: this.gameState.result,
      finalState: this.gameState,
    } as GameOverMessage);
  }

  // =========================================================================
  // Draft Phase
  // =========================================================================

  private startDraftCountdown(): void {
    let countdown = 3;
    this.broadcast({
      type: 'DRAFT_COUNTDOWN',
      timestamp: Date.now(),
      timeRemaining: countdown,
    });

    this.countdownTimer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(this.countdownTimer!);
        this.countdownTimer = null;
        this.startDraft();
      } else {
        this.broadcast({
          type: 'DRAFT_COUNTDOWN',
          timestamp: Date.now(),
          timeRemaining: countdown,
        });
      }
    }, 1000);
  }

  private startDraft(): void {
    this.phase = 'drafting';
    this.whiteDraft = null;
    this.blackDraft = null;

    const timeLimit = this.settings.draftTimeLimit || 180;
    this.draftDeadline = Date.now() + timeLimit * 1000;

    this.broadcast({
      type: 'DRAFT_START',
      timestamp: Date.now(),
      budget: this.settings.budget,
      boardSize: this.settings.boardSize,
      timeLimit: timeLimit,
    });

    this.draftTimer = setTimeout(() => {
      this.handleDraftTimeout();
    }, timeLimit * 1000);
  }

  submitDraft(playerId: string, draftPicks: DraftPick[]): { success: boolean; error?: string } {
    if (this.phase !== 'drafting') {
      return { success: false, error: 'Not in draft phase' };
    }

    const player = this.players.get(playerId);
    if (!player || !player.color) {
      return { success: false, error: 'Player not found' };
    }

    const draft = this.convertDraftPicksToPlayerDraft(draftPicks);

    const validation = validateDraft(draft, this.settings.budget, this.settings.boardSize);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    if (player.color === 'white') {
      this.whiteDraft = draft;
    } else {
      this.blackDraft = draft;
    }

    this.broadcast({
      type: 'DRAFT_SUBMITTED',
      timestamp: Date.now(),
      playerId,
    });

    if (this.whiteDraft && this.blackDraft) {
      this.completeDraft();
    }

    return { success: true };
  }

  private convertDraftPicksToPlayerDraft(picks: DraftPick[]): PlayerDraft {
    const draft = createEmptyDraft();
    draft.selections = picks.map(p => ({ pieceTypeId: p.pieceTypeId, count: p.count }));
    return draft;
  }

  private convertPlayerDraftToDraftPicks(draft: PlayerDraft): DraftPick[] {
    return draft.selections.map(s => ({
      pieceTypeId: s.pieceTypeId,
      count: s.count,
    }));
  }

  private completeDraft(): void {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      this.draftTimer = null;
    }

    this.broadcast({
      type: 'DRAFT_REVEAL',
      timestamp: Date.now(),
      whiteDraft: this.convertPlayerDraftToDraftPicks(this.whiteDraft!),
      blackDraft: this.convertPlayerDraftToDraftPicks(this.blackDraft!),
    } as DraftRevealMessage);

    setTimeout(() => {
      this.startPlacement();
    }, REVEAL_DURATION);
  }

  private handleDraftTimeout(): void {
    const defaultDraft = this.createDefaultDraft();

    if (!this.whiteDraft) {
      this.whiteDraft = defaultDraft;
      this.broadcast({
        type: 'DRAFT_TIMEOUT',
        timestamp: Date.now(),
        defaultedPlayer: 'white',
      });
    }
    if (!this.blackDraft) {
      this.blackDraft = defaultDraft;
      this.broadcast({
        type: 'DRAFT_TIMEOUT',
        timestamp: Date.now(),
        defaultedPlayer: 'black',
      });
    }

    this.completeDraft();
  }

  private createDefaultDraft(): PlayerDraft {
    const draft = createEmptyDraft();
    draft.selections = [
      { pieceTypeId: 'queen', count: 1 },
      { pieceTypeId: 'rook', count: 2 },
      { pieceTypeId: 'bishop', count: 2 },
      { pieceTypeId: 'knight', count: 2 },
      { pieceTypeId: 'pawn', count: 8 },
    ];
    draft.budgetSpent = 39;
    draft.slotsUsed = { pawn: 8, piece: 6, royalty: 1 };
    return draft;
  }

  // =========================================================================
  // Placement Phase
  // =========================================================================

  private startPlacement(): void {
    this.phase = 'placement';

    this.placementState = createPlacementStateFromDrafts(
      this.whiteDraft!,
      this.blackDraft!
    );

    this.gameState = this.createEmptyGameState();

    this.broadcast({
      type: 'PLACEMENT_START',
      timestamp: Date.now(),
      placementState: this.placementState,
    } as PlacementStartMessage);
  }

  private createEmptyGameState(): GameState {
    const budget = this.settings.budget;
    const boardSizeNum = typeof this.settings.boardSize === 'number'
      ? this.settings.boardSize
      : parseInt(String(this.settings.boardSize), 10);
    const dimensions = { files: boardSizeNum, ranks: boardSizeNum };

    return {
      phase: 'placement',
      boardSize: this.settings.boardSize,
      board: createBoardState(dimensions, []),
      players: {
        white: { color: 'white', budget, remainingBudget: budget, victoryPoints: 0 },
        black: { color: 'black', budget, remainingBudget: budget, victoryPoints: 0 },
      },
      currentTurn: 'white',
      turnNumber: 1,
      pointBudget: budget,
      placementMode: 'alternating',
      draft: null,
      inCheck: null,
      moveHistory: [],
      enPassantTarget: null,
      result: null,
    };
  }

  placePiece(playerId: string, pieceId: string, position: Position): {
    success: boolean;
    error?: string;
  } {
    if (this.phase !== 'placement' || !this.placementState || !this.gameState) {
      return { success: false, error: 'Not in placement phase' };
    }

    const player = this.players.get(playerId);
    if (!player || !player.color) {
      return { success: false, error: 'Player not found' };
    }

    if (this.placementState.currentPlacer !== player.color) {
      return { success: false, error: 'Not your turn to place' };
    }

    const piecesToPlace = player.color === 'white'
      ? this.placementState.whitePiecesToPlace
      : this.placementState.blackPiecesToPlace;

    const pieceIndex = piecesToPlace.findIndex(p => p.id === pieceId);
    if (pieceIndex === -1) {
      return { success: false, error: 'Piece not found' };
    }

    const piece = piecesToPlace[pieceIndex];

    const boardSize = typeof this.settings.boardSize === 'number'
      ? this.settings.boardSize
      : parseInt(String(this.settings.boardSize), 10);
    const validRanks = player.color === 'white' ? [1, 2] : [boardSize - 1, boardSize];
    if (!validRanks.includes(position.rank)) {
      return { success: false, error: 'Invalid placement position' };
    }

    const occupied = this.gameState.board.pieces.some(
      p => p.position && p.position.file === position.file && p.position.rank === position.rank
    );
    if (occupied) {
      return { success: false, error: 'Position is occupied' };
    }

    const placedPiece: PieceInstance = {
      ...piece,
      position,
    };

    this.gameState.board.pieces.push(placedPiece);
    // Update positionMap to track occupied squares
    const posKey = `${position.file}${position.rank}`;
    this.gameState.board.positionMap.set(posKey, placedPiece.id);
    piecesToPlace.splice(pieceIndex, 1);

    this.placementState.currentPlacer =
      this.placementState.currentPlacer === 'white' ? 'black' : 'white';

    this.lastActivity = Date.now();

    this.broadcast({
      type: 'PIECE_PLACED',
      timestamp: Date.now(),
      pieceId,
      position,
      nextPlacer: this.placementState.currentPlacer,
      placementState: this.placementState,
      gameState: this.gameState,
    } as PiecePlacedMessage);

    if (isPlacementComplete(this.placementState)) {
      this.startPlay();
    }

    return { success: true };
  }

  // =========================================================================
  // Play Phase
  // =========================================================================

  private startPlay(): void {
    this.phase = 'playing';

    if (this.gameState) {
      this.gameState.phase = 'play';
    }

    this.broadcast({
      type: 'GAME_START',
      timestamp: Date.now(),
      gameState: this.gameState!,
    });
  }

  makeMove(
    playerId: string,
    from: Position,
    to: Position,
    promotionPieceType?: string
  ): void {
    if (this.phase !== 'playing' || !this.gameState) {
      this.sendMoveRejected(playerId, 'INVALID_MOVE', 'Game not in play phase');
      return;
    }

    const player = this.players.get(playerId);
    if (!player || !player.color) {
      this.sendMoveRejected(playerId, 'INVALID_MOVE', 'Player not found');
      return;
    }

    if (this.gameState.currentTurn !== player.color) {
      this.sendMoveRejected(playerId, 'NOT_YOUR_TURN', 'Not your turn');
      return;
    }

    if (this.gameState.result) {
      this.sendMoveRejected(playerId, 'GAME_OVER', 'Game is over');
      return;
    }

    const piece = getPieceAt(this.gameState.board, from);
    if (!piece || piece.owner !== player.color) {
      this.sendMoveRejected(playerId, 'INVALID_MOVE', 'No piece at that position');
      return;
    }

    const legalMoves = generateLegalMoves(
      this.gameState.board,
      piece,
      this.gameState.enPassantTarget
    );

    const isLegal = legalMoves.some(
      m => m.file === to.file && m.rank === to.rank
    );
    if (!isLegal) {
      this.sendMoveRejected(playerId, 'INVALID_MOVE', 'Illegal move');
      return;
    }

    // Create and execute the move
    const move = createMove(this.gameState.board, piece, from, to, {
      isPromotion: !!promotionPieceType,
      promotionPieceType,
    });

    const newGameState = executeMove(this.gameState, move);

    this.gameState = newGameState;
    this.lastActivity = Date.now();

    this.broadcast({
      type: 'MOVE_MADE',
      timestamp: Date.now(),
      move: move,
      gameState: this.gameState,
    } as MoveMadeMessage);

    const result = getGameResult(this.gameState);
    if (result) {
      this.gameState.result = result;
      this.phase = 'ended';

      this.broadcast({
        type: 'GAME_OVER',
        timestamp: Date.now(),
        result,
        finalState: this.gameState,
      } as GameOverMessage);
    }
  }

  private sendMoveRejected(
    playerId: string,
    reason: 'INVALID_MOVE' | 'NOT_YOUR_TURN' | 'GAME_OVER',
    message: string
  ): void {
    const player = this.players.get(playerId);
    if (!player || !this.io || !this.gameState) return;

    const msg: MoveRejectedMessage = {
      type: 'MOVE_REJECTED',
      timestamp: Date.now(),
      reason,
      message,
      correctState: this.gameState,
    };

    this.io.to(player.socketId).emit('message', msg);
  }

  handleResign(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || !player.color || !this.gameState) return;

    const winner = player.color === 'white' ? 'black' : 'white';
    this.gameState.result = {
      type: 'resignation',
      winner,
      whiteVP: 0,
      blackVP: 0,
    };
    this.phase = 'ended';

    this.broadcast({
      type: 'GAME_OVER',
      timestamp: Date.now(),
      result: this.gameState.result,
      finalState: this.gameState,
    } as GameOverMessage);
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  private broadcast(message: ServerToClientMessage): void {
    if (this.io) {
      this.io.to(this.code).emit('message', message);
    }
  }

  private buildSyncState(playerId: string): SyncStateMessage {
    const player = this.players.get(playerId);

    return {
      type: 'SYNC_STATE',
      timestamp: Date.now(),
      phase: this.phase,
      settings: this.settings,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        connected: p.connected,
        isAccountUser: p.isAccountUser,
      })),
      myColor: player?.color || null,
      gameState: this.gameState || undefined,
      placementState: this.placementState || undefined,
      whiteDraft: this.whiteDraft ? this.convertPlayerDraftToDraftPicks(this.whiteDraft) : undefined,
      blackDraft: this.blackDraft ? this.convertPlayerDraftToDraftPicks(this.blackDraft) : undefined,
      draftState: this.phase === 'drafting' ? {
        myDraft: player?.color === 'white'
          ? (this.whiteDraft ? this.convertPlayerDraftToDraftPicks(this.whiteDraft) : undefined)
          : (this.blackDraft ? this.convertPlayerDraftToDraftPicks(this.blackDraft) : undefined),
        opponentSubmitted: player?.color === 'white' ? !!this.blackDraft : !!this.whiteDraft,
        timeRemaining: this.draftDeadline ? Math.max(0, (this.draftDeadline - Date.now()) / 1000) : 0,
      } : undefined,
    };
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  isPlaying(): boolean {
    return this.phase === 'playing';
  }

  isWaiting(): boolean {
    return this.phase === 'waiting';
  }

  isEnded(): boolean {
    return this.phase === 'ended';
  }

  getLastActivity(): number {
    return this.lastActivity;
  }

  getPhase(): RoomPhase {
    return this.phase;
  }

  getSettings(): RoomSettings {
    return this.settings;
  }

  getPlayers(): PlayerInfo[] {
    return Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      connected: p.connected,
      isAccountUser: p.isAccountUser,
    }));
  }

  cleanup(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.draftTimer) clearTimeout(this.draftTimer);
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
  }
}

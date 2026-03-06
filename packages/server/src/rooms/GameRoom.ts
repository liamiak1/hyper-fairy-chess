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
  getNextPlacer,
  isHerald,
  getHeraldActualPosition,
  getPawnSwapPosition,
  shouldPawnSwapToBackRank,
} from '@hyper-fairy-chess/shared';
import { PIECE_BY_ID } from '@hyper-fairy-chess/shared';
import {
  createBoardState,
  getPieceAt,
  hashPosition,
  initializeRoyalTracking,
} from '@hyper-fairy-chess/shared';
import {
  generateLegalMoves,
  prepareMoveFromPositions,
  executeMove,
} from '@hyper-fairy-chess/shared';
import {
  getGameResult,
  createDrawAgreementResult,
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
  private draftTickTimer: ReturnType<typeof setInterval> | null = null;
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Draw offer state
  private drawOffer: PlayerColor | null = null;

  // Blind placement state - stores placed pieces with their positions
  private blindPlacements: Map<PlayerColor, Map<string, { piece: PieceInstance; position: Position }>> = new Map();
  private blindReady: Map<PlayerColor, boolean> = new Map();

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

  addPlayer(socket: Socket, name: string, isAccountUser: boolean = false): {
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
      isAccountUser,
      lastSeen: Date.now(),
    };

    this.players.set(playerId, player);
    socket.join(this.code);
    console.log(`[GameRoom] Player ${playerId} (${color}) joined room ${this.code}, socket ${socket.id}`);

    if (this.players.size === 2) {
      console.log(`[GameRoom] Room ${this.code} now has 2 players, starting draft countdown`);
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

    // null means no time limit
    const hasTimeLimit = this.settings.draftTimeLimit !== null;
    const timeLimit = this.settings.draftTimeLimit ?? 0; // 0 means no limit for the client

    this.broadcast({
      type: 'DRAFT_START',
      timestamp: Date.now(),
      budget: this.settings.budget,
      boardSize: this.settings.boardSize,
      timeLimit: timeLimit,
    });

    if (hasTimeLimit && timeLimit > 0) {
      this.draftDeadline = Date.now() + timeLimit * 1000;

      // Send periodic countdown updates every second
      this.draftTickTimer = setInterval(() => {
        if (this.draftDeadline) {
          const remaining = Math.max(0, Math.ceil((this.draftDeadline - Date.now()) / 1000));
          this.broadcast({
            type: 'DRAFT_COUNTDOWN',
            timestamp: Date.now(),
            timeRemaining: remaining,
          });
        }
      }, 1000);

      this.draftTimer = setTimeout(() => {
        this.handleDraftTimeout();
      }, timeLimit * 1000);
    } else {
      // No time limit - no deadline or timer
      this.draftDeadline = null;
    }
  }

  submitDraft(playerId: string, draftPicks: DraftPick[]): { success: boolean; error?: string } {
    console.log(`[GameRoom] submitDraft called - playerId: ${playerId}, phase: ${this.phase}, budget: ${this.settings.budget}`);

    if (this.phase !== 'drafting') {
      console.log('[GameRoom] submitDraft failed - not in draft phase');
      return { success: false, error: 'Not in draft phase' };
    }

    const player = this.players.get(playerId);
    if (!player || !player.color) {
      console.log('[GameRoom] submitDraft failed - player not found');
      return { success: false, error: 'Player not found' };
    }

    const draft = this.convertDraftPicksToPlayerDraft(draftPicks);
    console.log(`[GameRoom] Draft converted - budgetSpent: ${draft.budgetSpent}, selections:`, draft.selections);

    const validation = validateDraft(draft, this.settings.budget, this.settings.boardSize);
    if (!validation.valid) {
      console.log(`[GameRoom] Draft validation failed - budget: ${this.settings.budget}, errors:`, validation.errors);
      return { success: false, error: validation.errors.join(', ') };
    }

    if (player.color === 'white') {
      this.whiteDraft = draft;
    } else {
      this.blackDraft = draft;
    }

    console.log(`[GameRoom] Broadcasting DRAFT_SUBMITTED for player ${playerId} (${player.color})`);
    this.broadcast({
      type: 'DRAFT_SUBMITTED',
      timestamp: Date.now(),
      playerId,
    });

    console.log(`[GameRoom] whiteDraft: ${!!this.whiteDraft}, blackDraft: ${!!this.blackDraft}`);
    if (this.whiteDraft && this.blackDraft) {
      console.log('[GameRoom] Both drafts submitted - calling completeDraft()');
      this.completeDraft();
    }

    return { success: true };
  }

  private convertDraftPicksToPlayerDraft(picks: DraftPick[]): PlayerDraft {
    const draft = createEmptyDraft();
    draft.selections = picks.map(p => ({ pieceTypeId: p.pieceTypeId, count: p.count }));

    // Calculate budgetSpent and slotsUsed from the selections
    let budgetSpent = 0;
    const slotsUsed = { pawn: 0, piece: 0, royalty: 1 }; // Start with 1 royalty for King

    for (const pick of picks) {
      const pieceType = PIECE_BY_ID[pick.pieceTypeId];
      if (!pieceType) continue;

      budgetSpent += pieceType.cost * pick.count;

      // Update slot usage based on tier
      if (pieceType.tier === 'pawn') {
        slotsUsed.pawn += pick.count;
      } else if (pieceType.tier === 'piece') {
        slotsUsed.piece += pick.count;
      } else if (pieceType.tier === 'royalty') {
        // King-replacing pieces don't add to royalty slots
        if (!pieceType.replacesKing) {
          slotsUsed.royalty += pick.count;
        }
      }
    }

    draft.budgetSpent = budgetSpent;
    draft.slotsUsed = slotsUsed;

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
    if (this.draftTickTimer) {
      clearInterval(this.draftTickTimer);
      this.draftTickTimer = null;
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

    const placementMode = this.settings.placementMode || 'alternating';

    this.placementState = createPlacementStateFromDrafts(
      this.whiteDraft!,
      this.blackDraft!,
      placementMode
    );

    this.gameState = this.createEmptyGameState();

    // Initialize blind placement state if in blind mode
    if (placementMode === 'blind') {
      this.blindPlacements.set('white', new Map());
      this.blindPlacements.set('black', new Map());
      this.blindReady.set('white', false);
      this.blindReady.set('black', false);
    }

    this.broadcast({
      type: 'PLACEMENT_START',
      timestamp: Date.now(),
      placementState: this.placementState,
      gameState: this.gameState!,
    } as PlacementStartMessage);
  }

  private createEmptyGameState(): GameState {
    const budget = this.settings.budget;
    // Parse board size properly - it's a string like '8x8' or '10x10'
    const boardSizeStr = String(this.settings.boardSize);
    const [filesStr, ranksStr] = boardSizeStr.split('x');
    const dimensions = {
      files: parseInt(filesStr, 10) || 8,
      ranks: parseInt(ranksStr, 10) || 8,
    };

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
      halfmoveClock: 0,
      positionHistory: [],
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

    // Parse board ranks from size string (e.g., '8x8' -> 8, '10x8' -> 8)
    const boardSizeStr = String(this.settings.boardSize);
    const boardRanks = parseInt(boardSizeStr.split('x')[1], 10) || 8;
    const validRanks = player.color === 'white' ? [1, 2] : [boardRanks - 1, boardRanks];
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

    // Use getNextPlacer which handles the case when one player runs out of pieces
    this.placementState.currentPlacer = getNextPlacer(
      this.placementState,
      this.placementState.currentPlacer
    );

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
  // Blind Placement Phase
  // =========================================================================

  handleBlindPlacePiece(playerId: string, pieceId: string, position: Position): void {
    if (this.phase !== 'placement' || !this.placementState || !this.gameState) {
      return;
    }

    if (this.placementState.mode !== 'blind') {
      return;
    }

    const player = this.players.get(playerId);
    if (!player || !player.color) {
      return;
    }

    // Check if player is already ready - can't place while ready
    if (this.blindReady.get(player.color)) {
      return;
    }

    const piecesToPlace = player.color === 'white'
      ? this.placementState.whitePiecesToPlace
      : this.placementState.blackPiecesToPlace;

    const pieceIndex = piecesToPlace.findIndex(p => p.id === pieceId);
    if (pieceIndex === -1) {
      return;
    }

    const piece = piecesToPlace[pieceIndex];
    const pieceType = PIECE_BY_ID[piece.typeId];
    if (!pieceType) {
      return;
    }

    // Validate position - parse board ranks from size string
    const boardSizeStr = String(this.settings.boardSize);
    const boardRanks = parseInt(boardSizeStr.split('x')[1], 10) || 8;
    const validRanks = player.color === 'white' ? [1, 2] : [boardRanks - 1, boardRanks];
    if (!validRanks.includes(position.rank)) {
      return;
    }

    const playerPlacements = this.blindPlacements.get(player.color);
    if (!playerPlacements) {
      return;
    }

    // Calculate actual position and handle Herald/Pawn swaps
    let actualPosition = position;
    let pawnSwapInfo: { pawnId: string; newPosition: Position } | undefined;

    if (isHerald(piece)) {
      // Herald goes to pawn rank instead of back rank
      actualPosition = getHeraldActualPosition(
        position,
        player.color,
        { ranks: boardRanks }
      );

      // Check if there's already a pawn placed on the pawn rank in this file
      for (const [placedId, placement] of playerPlacements.entries()) {
        if (placement.position.file === actualPosition.file &&
            placement.position.rank === actualPosition.rank) {
          const placedPieceType = PIECE_BY_ID[placement.piece.typeId];
          if (placedPieceType?.tier === 'pawn') {
            // Move the pawn to the back rank
            const pawnNewPos = getPawnSwapPosition(
              actualPosition.file,
              player.color,
              { ranks: boardRanks }
            );
            // Update the pawn's position in placements
            placement.position = pawnNewPos;
            pawnSwapInfo = { pawnId: placedId, newPosition: pawnNewPos };
          } else {
            // Position occupied by non-pawn, can't place
            return;
          }
        }
      }
    } else if (pieceType.tier === 'pawn') {
      // Check if a Herald is already on the pawn rank in this file
      const pawnRank = player.color === 'white' ? 2 : (boardRanks - 1);
      for (const placement of playerPlacements.values()) {
        if (placement.position.file === position.file &&
            placement.position.rank === pawnRank &&
            isHerald(placement.piece)) {
          // Herald is on pawn rank, pawn goes to back rank
          actualPosition = getPawnSwapPosition(
            position.file,
            player.color,
            { ranks: boardRanks }
          );
          break;
        }
      }
    }

    // Check if actual position is already occupied
    for (const placement of playerPlacements.values()) {
      if (placement.position.file === actualPosition.file &&
          placement.position.rank === actualPosition.rank) {
        return; // Position occupied
      }
    }

    // Store the placement with full piece data
    playerPlacements.set(pieceId, { piece, position: actualPosition });

    // Remove piece from pieces to place
    piecesToPlace.splice(pieceIndex, 1);

    this.lastActivity = Date.now();

    // Send confirmation only to the placing player
    this.sendToPlayer(playerId, {
      type: 'BLIND_PLACEMENT_CONFIRM',
      timestamp: Date.now(),
      pieceId,
      typeId: piece.typeId,
      position: actualPosition,
      actualPosition: isHerald(piece) ? actualPosition : undefined,
      pawnSwap: pawnSwapInfo,
    });
  }

  handleBlindUnplacePiece(playerId: string, pieceId: string): void {
    if (this.phase !== 'placement' || !this.placementState || !this.gameState) {
      return;
    }

    if (this.placementState.mode !== 'blind') {
      return;
    }

    const player = this.players.get(playerId);
    if (!player || !player.color) {
      return;
    }

    // Check if player is already ready - can't unplace while ready
    if (this.blindReady.get(player.color)) {
      return;
    }

    const playerPlacements = this.blindPlacements.get(player.color);
    if (!playerPlacements || !playerPlacements.has(pieceId)) {
      return;
    }

    // Get the stored placement data (includes full piece)
    const placementData = playerPlacements.get(pieceId)!;

    // Remove the placement
    playerPlacements.delete(pieceId);

    // Add the piece back to piecesToPlace
    const piecesToPlace = player.color === 'white'
      ? this.placementState.whitePiecesToPlace
      : this.placementState.blackPiecesToPlace;

    // Reset position to null when adding back
    const pieceToRestore: PieceInstance = {
      ...placementData.piece,
      position: null,
    };
    piecesToPlace.push(pieceToRestore);

    this.lastActivity = Date.now();

    // Send confirmation to the player with piece data so client can restore it
    this.sendToPlayer(playerId, {
      type: 'BLIND_UNPLACE_CONFIRM',
      timestamp: Date.now(),
      pieceId,
      piece: {
        id: pieceToRestore.id,
        typeId: pieceToRestore.typeId,
        owner: pieceToRestore.owner,
      },
    });
  }

  handleBlindReady(playerId: string): void {
    if (this.phase !== 'placement' || !this.placementState || !this.gameState) {
      return;
    }

    if (this.placementState.mode !== 'blind') {
      return;
    }

    const player = this.players.get(playerId);
    if (!player || !player.color) {
      return;
    }

    // Check if all pieces are placed
    const piecesToPlace = player.color === 'white'
      ? this.placementState.whitePiecesToPlace
      : this.placementState.blackPiecesToPlace;

    if (piecesToPlace.length > 0) {
      return; // Still have pieces to place
    }

    // Mark player as ready
    this.blindReady.set(player.color, true);
    this.placementState[player.color === 'white' ? 'whiteReady' : 'blackReady'] = true;

    this.lastActivity = Date.now();

    // Broadcast ready status
    this.broadcast({
      type: 'BLIND_READY_STATUS',
      timestamp: Date.now(),
      color: player.color,
      ready: true,
    });

    // Check if both players are ready
    if (this.blindReady.get('white') && this.blindReady.get('black')) {
      this.revealBlindPlacements();
    }
  }

  handleBlindUnready(playerId: string): void {
    if (this.phase !== 'placement' || !this.placementState || !this.gameState) {
      return;
    }

    if (this.placementState.mode !== 'blind') {
      return;
    }

    const player = this.players.get(playerId);
    if (!player || !player.color) {
      return;
    }

    // Only allow unready if opponent isn't ready yet (or we could allow it anytime)
    // For flexibility, allow it anytime before reveal

    this.blindReady.set(player.color, false);
    this.placementState[player.color === 'white' ? 'whiteReady' : 'blackReady'] = false;

    this.lastActivity = Date.now();

    // Broadcast ready status
    this.broadcast({
      type: 'BLIND_READY_STATUS',
      timestamp: Date.now(),
      color: player.color,
      ready: false,
    });
  }

  private revealBlindPlacements(): void {
    if (!this.placementState || !this.gameState) {
      return;
    }

    // Merge all blind placements onto the board
    for (const [_color, placements] of this.blindPlacements) {
      for (const [_pieceId, placementData] of placements) {
        // Use the stored piece with its position
        const piece: PieceInstance = {
          ...placementData.piece,
          position: placementData.position,
        };

        this.gameState.board.pieces.push(piece);
        const posKey = `${placementData.position.file}${placementData.position.rank}`;
        this.gameState.board.positionMap.set(posKey, piece.id);
      }
    }

    // Clear blind placement state
    this.blindPlacements.clear();
    this.blindReady.clear();

    // Broadcast the reveal
    this.broadcast({
      type: 'BLIND_PLACEMENT_REVEAL',
      timestamp: Date.now(),
      gameState: this.gameState,
    });

    // Start play phase
    this.startPlay();
  }

  // =========================================================================
  // Play Phase
  // =========================================================================

  private startPlay(): void {
    this.phase = 'playing';

    if (this.gameState) {
      this.gameState.phase = 'play';

      // Initialize royal tracking for Regent logic (must be done before play starts)
      // This tracks whether each player started with multiple royalty-tier pieces
      this.gameState.board = initializeRoyalTracking(this.gameState.board);

      // Record the initial position for threefold repetition detection
      const initialHash = hashPosition(
        this.gameState.board,
        this.gameState.currentTurn,
        this.gameState.enPassantTarget
      );
      this.gameState.positionHistory = [initialHash];
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

    // Create and execute the move using prepareMoveFromPositions
    // This handles special moves like castling, en passant, and special captures
    // (withdrawer, coordinator, boxer, chameleon, etc.)
    const move = prepareMoveFromPositions(
      this.gameState,
      piece,
      from,
      to,
      promotionPieceType
    );

    if (!move) {
      this.sendMoveRejected(playerId, 'INVALID_MOVE', 'Could not create move');
      return;
    }

    const newGameState = executeMove(this.gameState, move);

    this.gameState = newGameState;
    this.lastActivity = Date.now();

    // Clear any pending draw offer when a move is made
    this.drawOffer = null;

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
  // Draw Handling
  // =========================================================================

  handleOfferDraw(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || !player.color || !this.gameState) return;

    // Can't offer draw if game is over
    if (this.gameState.result || this.phase !== 'playing') return;

    // Can't offer if you already have a pending offer
    if (this.drawOffer === player.color) return;

    this.drawOffer = player.color;

    this.broadcast({
      type: 'DRAW_OFFERED',
      timestamp: Date.now(),
      by: player.color,
    });
  }

  handleRespondDraw(playerId: string, accept: boolean): void {
    const player = this.players.get(playerId);
    if (!player || !player.color || !this.gameState) return;

    // Can't respond if no draw offer pending
    if (!this.drawOffer) return;

    // Can't respond to your own offer
    if (this.drawOffer === player.color) return;

    if (accept) {
      // Game ends in draw by agreement
      this.gameState.result = createDrawAgreementResult();
      this.phase = 'ended';
      this.drawOffer = null;

      this.broadcast({
        type: 'GAME_OVER',
        timestamp: Date.now(),
        result: this.gameState.result,
        finalState: this.gameState,
      } as GameOverMessage);
    } else {
      // Draw declined
      this.drawOffer = null;

      this.broadcast({
        type: 'DRAW_DECLINED',
        timestamp: Date.now(),
      });
    }
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  private broadcast(message: ServerToClientMessage): void {
    if (this.io) {
      // Log player count and socket info
      const playerCount = this.players.size;
      const playerSocketIds = Array.from(this.players.values()).map(p => p.socketId);
      console.log(`[GameRoom] Broadcasting ${message.type} to room ${this.code} (${playerCount} players, sockets: ${playerSocketIds.join(', ')})`);
      this.io.to(this.code).emit('message', message);
    } else {
      console.log('[GameRoom] WARNING: Cannot broadcast - io is null');
    }
  }

  private sendToPlayer(playerId: string, message: ServerToClientMessage): void {
    const player = this.players.get(playerId);
    if (player && this.io) {
      this.io.to(player.socketId).emit('message', message);
    }
  }

  private buildSyncState(playerId: string): SyncStateMessage {
    const player = this.players.get(playerId);

    // Build blind placement state if in blind mode
    let blindPlacementState = undefined;
    if (this.phase === 'placement' && this.placementState?.mode === 'blind' && player?.color) {
      const playerPlacements = this.blindPlacements.get(player.color);
      const myPlacedPieces: Array<{ pieceId: string; typeId: string; position: Position }> = [];
      if (playerPlacements) {
        for (const [pieceId, data] of playerPlacements) {
          myPlacedPieces.push({ pieceId, typeId: data.piece.typeId, position: data.position });
        }
      }

      const opponentColor = player.color === 'white' ? 'black' : 'white';
      blindPlacementState = {
        myPlacedPieces,
        myReady: this.blindReady.get(player.color) || false,
        opponentReady: this.blindReady.get(opponentColor) || false,
      };
    }

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
      blindPlacementState,
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
    if (this.draftTickTimer) clearInterval(this.draftTickTimer);
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
  }
}

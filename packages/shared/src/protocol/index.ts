/**
 * WebSocket Protocol Types for Online Multiplayer
 */

import type {
  BoardSize,
  GameState,
  PlayerColor,
  Position,
  Move,
  GameResult,
} from '../game/types';
import type { PlacementState } from '../game/rules/placement';

// =============================================================================
// Base Types
// =============================================================================

export type PlayerRole = 'white' | 'black' | 'spectator';

// Room phase type for online multiplayer (distinct from local game phase)
export type RoomPhase = 'waiting' | 'drafting' | 'placement' | 'playing' | 'ended';

// Draft pick sent over the wire (simplified from PlayerDraft)
export interface DraftPick {
  pieceTypeId: string;
  count: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  color: PlayerColor | null;
  connected: boolean;
  isAccountUser: boolean;
}

export interface RoomSettings {
  budget: number;
  boardSize: BoardSize;
  draftTimeLimit: number | null; // seconds, null = no limit
  moveTimeLimit: number | null; // seconds per move, null = no limit
}

// =============================================================================
// Base Message Types
// =============================================================================

export interface ServerMessage {
  type: string;
  timestamp: number;
}

export interface ClientMessage {
  type: string;
  timestamp: number;
  roomCode?: string;
}

// =============================================================================
// Room Management Messages
// =============================================================================

// Client -> Server
export interface CreateRoomMessage extends ClientMessage {
  type: 'CREATE_ROOM';
  playerName: string;
  sessionToken?: string;
  settings: RoomSettings;
}

export interface JoinRoomMessage extends ClientMessage {
  type: 'JOIN_ROOM';
  roomCode: string;
  playerName: string;
  sessionToken?: string;
}

export interface LeaveRoomMessage extends ClientMessage {
  type: 'LEAVE_ROOM';
}

// Server -> Client
export interface RoomCreatedMessage extends ServerMessage {
  type: 'ROOM_CREATED';
  roomCode: string;
  playerId: string;
  role: PlayerRole;
  settings: RoomSettings;
}

export interface RoomJoinedMessage extends ServerMessage {
  type: 'ROOM_JOINED';
  roomCode: string;
  playerId: string;
  role: PlayerRole;
  settings: RoomSettings;
  players: PlayerInfo[];
  phase: RoomPhase;
}

export interface PlayerJoinedMessage extends ServerMessage {
  type: 'PLAYER_JOINED';
  player: PlayerInfo;
}

export interface PlayerLeftMessage extends ServerMessage {
  type: 'PLAYER_LEFT';
  playerId: string;
  reason: 'left' | 'disconnected' | 'timeout';
}

export interface PlayerReconnectedMessage extends ServerMessage {
  type: 'PLAYER_RECONNECTED';
  playerId: string;
}

export interface RoomErrorMessage extends ServerMessage {
  type: 'ROOM_ERROR';
  error: 'NOT_FOUND' | 'FULL' | 'ALREADY_STARTED' | 'INVALID_CODE';
  message: string;
}

// =============================================================================
// Draft Phase Messages
// =============================================================================

// Server -> Client
export interface DraftCountdownMessage extends ServerMessage {
  type: 'DRAFT_COUNTDOWN';
  timeRemaining: number;
}

export interface DraftStartMessage extends ServerMessage {
  type: 'DRAFT_START';
  budget: number;
  boardSize: BoardSize;
  timeLimit: number; // seconds
}

// Client -> Server
export interface DraftSubmitMessage extends ClientMessage {
  type: 'DRAFT_SUBMIT';
  draft: DraftPick[];
}

// Server -> Client
export interface DraftSubmittedMessage extends ServerMessage {
  type: 'DRAFT_SUBMITTED';
  playerId: string; // Which player submitted (doesn't reveal content)
}

export interface DraftRevealMessage extends ServerMessage {
  type: 'DRAFT_REVEAL';
  whiteDraft: DraftPick[];
  blackDraft: DraftPick[];
}

export interface DraftTimeoutMessage extends ServerMessage {
  type: 'DRAFT_TIMEOUT';
  defaultedPlayer: PlayerColor;
}

// =============================================================================
// Placement Phase Messages
// =============================================================================

// Server -> Client
export interface PlacementStartMessage extends ServerMessage {
  type: 'PLACEMENT_START';
  placementState: PlacementState;
}

// Client -> Server
export interface PlacePieceMessage extends ClientMessage {
  type: 'PLACE_PIECE';
  pieceId: string;
  position: Position;
}

// Server -> Client
export interface PiecePlacedMessage extends ServerMessage {
  type: 'PIECE_PLACED';
  pieceId: string;
  position: Position;
  actualPosition?: Position; // For Herald special placement
  pawnSwap?: {
    pawnId: string;
    newPosition: Position;
  };
  nextPlacer: PlayerColor;
  placementState: PlacementState;
  gameState: GameState; // Board state with placed pieces
}

export interface PlacementErrorMessage extends ServerMessage {
  type: 'PLACEMENT_ERROR';
  error: string;
  placementState: PlacementState;
}

export interface PlacementCompleteMessage extends ServerMessage {
  type: 'PLACEMENT_COMPLETE';
  gameState: GameState;
}

// =============================================================================
// Play Phase Messages
// =============================================================================

// Client -> Server
export interface MakeMoveMessage extends ClientMessage {
  type: 'MAKE_MOVE';
  from: Position;
  to: Position;
  promotionPieceType?: string;
}

export interface OfferDrawMessage extends ClientMessage {
  type: 'OFFER_DRAW';
}

export interface RespondDrawMessage extends ClientMessage {
  type: 'RESPOND_DRAW';
  accept: boolean;
}

export interface ResignMessage extends ClientMessage {
  type: 'RESIGN';
}

// Server -> Client
export interface MoveMadeMessage extends ServerMessage {
  type: 'MOVE_MADE';
  move: Move;
  gameState: GameState;
}

export interface MoveRejectedMessage extends ServerMessage {
  type: 'MOVE_REJECTED';
  reason: 'INVALID_MOVE' | 'NOT_YOUR_TURN' | 'GAME_OVER';
  message: string;
  correctState: GameState; // Correct state to resync to
}

export interface DrawOfferedMessage extends ServerMessage {
  type: 'DRAW_OFFERED';
  by: PlayerColor;
}

export interface DrawDeclinedMessage extends ServerMessage {
  type: 'DRAW_DECLINED';
}

export interface GameOverMessage extends ServerMessage {
  type: 'GAME_OVER';
  result: GameResult;
  finalState: GameState;
}

// =============================================================================
// Connection & Sync Messages
// =============================================================================

// Client -> Server
export interface ReconnectMessage extends ClientMessage {
  type: 'RECONNECT';
  roomCode: string;
  playerId: string;
  sessionToken?: string;
}

// Server -> Client
export interface SyncStateMessage extends ServerMessage {
  type: 'SYNC_STATE';
  phase: RoomPhase;
  settings: RoomSettings;
  players: PlayerInfo[];
  myColor: PlayerColor | null;
  gameState?: GameState;
  placementState?: PlacementState;
  whiteDraft?: DraftPick[];
  blackDraft?: DraftPick[];
  draftState?: {
    myDraft?: DraftPick[];
    opponentSubmitted: boolean;
    timeRemaining: number;
  };
}

export interface GameStartMessage extends ServerMessage {
  type: 'GAME_START';
  gameState: GameState;
}

export interface PlayerDisconnectedMessage extends ServerMessage {
  type: 'PLAYER_DISCONNECTED';
  playerId: string;
  timeoutSeconds: number;
}

// Client -> Server
export interface PingMessage extends ClientMessage {
  type: 'PING';
}

// Server -> Client
export interface PongMessage extends ServerMessage {
  type: 'PONG';
  serverTime: number;
}

// =============================================================================
// Union Types for Message Handling
// =============================================================================

export type ClientToServerMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | DraftSubmitMessage
  | PlacePieceMessage
  | MakeMoveMessage
  | OfferDrawMessage
  | RespondDrawMessage
  | ResignMessage
  | ReconnectMessage
  | PingMessage;

export type ServerToClientMessage =
  | RoomCreatedMessage
  | RoomJoinedMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerReconnectedMessage
  | RoomErrorMessage
  | DraftCountdownMessage
  | DraftStartMessage
  | DraftSubmittedMessage
  | DraftRevealMessage
  | DraftTimeoutMessage
  | PlacementStartMessage
  | PiecePlacedMessage
  | PlacementErrorMessage
  | PlacementCompleteMessage
  | GameStartMessage
  | MoveMadeMessage
  | MoveRejectedMessage
  | DrawOfferedMessage
  | DrawDeclinedMessage
  | GameOverMessage
  | SyncStateMessage
  | PlayerDisconnectedMessage
  | PongMessage;

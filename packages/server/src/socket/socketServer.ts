/**
 * Socket.io Server Setup and Handlers
 */

import type { Server, Socket } from 'socket.io';
import type { RoomManager } from '../rooms/RoomManager';
import type {
  ClientToServerMessage,
  CreateRoomMessage,
  JoinRoomMessage,
  DraftSubmitMessage,
  PlacePieceMessage,
  MakeMoveMessage,
  ReconnectMessage,
  RoomCreatedMessage,
  RoomJoinedMessage,
  PlayerJoinedMessage,
  RoomErrorMessage,
} from '@hyper-fairy-chess/shared';

export function setupSocketHandlers(io: Server, roomManager: RoomManager): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Track which room/player this socket belongs to
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    socket.on('message', (msg: ClientToServerMessage) => {
      try {
        handleMessage(socket, msg, roomManager, {
          get roomCode() { return currentRoomCode; },
          set roomCode(code: string | null) { currentRoomCode = code; },
          get playerId() { return currentPlayerId; },
          set playerId(id: string | null) { currentPlayerId = id; },
        });
      } catch (error) {
        console.error('Error handling message:', error);
        socket.emit('message', {
          type: 'ROOM_ERROR',
          timestamp: Date.now(),
          error: 'INVALID_CODE',
          message: 'An error occurred processing your request',
        } as RoomErrorMessage);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);

      if (currentRoomCode && currentPlayerId) {
        const room = roomManager.getRoom(currentRoomCode);
        if (room) {
          room.handleDisconnect(currentPlayerId);
        }
      }
    });
  });

  // Periodic cleanup of stale rooms
  setInterval(() => {
    roomManager.cleanupStaleRooms();
  }, 5 * 60 * 1000); // Every 5 minutes
}

interface SocketState {
  roomCode: string | null;
  playerId: string | null;
}

function handleMessage(
  socket: Socket,
  msg: ClientToServerMessage,
  roomManager: RoomManager,
  state: SocketState
): void {
  switch (msg.type) {
    case 'CREATE_ROOM':
      handleCreateRoom(socket, msg as CreateRoomMessage, roomManager, state);
      break;

    case 'JOIN_ROOM':
      handleJoinRoom(socket, msg as JoinRoomMessage, roomManager, state);
      break;

    case 'LEAVE_ROOM':
      handleLeaveRoom(socket, roomManager, state);
      break;

    case 'DRAFT_SUBMIT':
      handleDraftSubmit(socket, msg as DraftSubmitMessage, roomManager, state);
      break;

    case 'PLACE_PIECE':
      handlePlacePiece(socket, msg as PlacePieceMessage, roomManager, state);
      break;

    case 'MAKE_MOVE':
      handleMakeMove(socket, msg as MakeMoveMessage, roomManager, state);
      break;

    case 'RESIGN':
      handleResign(socket, roomManager, state);
      break;

    case 'RECONNECT':
      handleReconnect(socket, msg as ReconnectMessage, roomManager, state);
      break;

    case 'PING':
      socket.emit('message', {
        type: 'PONG',
        timestamp: Date.now(),
        serverTime: Date.now(),
      });
      break;

    default:
      console.warn('Unknown message type:', (msg as any).type);
  }
}

function handleCreateRoom(
  socket: Socket,
  msg: CreateRoomMessage,
  roomManager: RoomManager,
  state: SocketState
): void {
  const room = roomManager.createRoom(msg.settings);
  const result = room.addPlayer(socket, msg.playerName, msg.sessionToken);

  if (!result.success) {
    socket.emit('message', {
      type: 'ROOM_ERROR',
      timestamp: Date.now(),
      error: 'INVALID_CODE',
      message: result.error || 'Failed to create room',
    } as RoomErrorMessage);
    return;
  }

  state.roomCode = room.code;
  state.playerId = result.playerId!;

  socket.emit('message', {
    type: 'ROOM_CREATED',
    timestamp: Date.now(),
    roomCode: room.code,
    playerId: result.playerId!,
    role: result.color!,
    settings: room.getSettings(),
  } as RoomCreatedMessage);
}

function handleJoinRoom(
  socket: Socket,
  msg: JoinRoomMessage,
  roomManager: RoomManager,
  state: SocketState
): void {
  const room = roomManager.getRoom(msg.roomCode);

  if (!room) {
    socket.emit('message', {
      type: 'ROOM_ERROR',
      timestamp: Date.now(),
      error: 'NOT_FOUND',
      message: 'Room not found',
    } as RoomErrorMessage);
    return;
  }

  const result = room.addPlayer(socket, msg.playerName, msg.sessionToken);

  if (!result.success) {
    socket.emit('message', {
      type: 'ROOM_ERROR',
      timestamp: Date.now(),
      error: room.isPlaying() ? 'ALREADY_STARTED' : 'FULL',
      message: result.error || 'Failed to join room',
    } as RoomErrorMessage);
    return;
  }

  state.roomCode = room.code;
  state.playerId = result.playerId!;

  // Notify the joining player
  socket.emit('message', {
    type: 'ROOM_JOINED',
    timestamp: Date.now(),
    roomCode: room.code,
    playerId: result.playerId!,
    role: result.color!,
    settings: room.getSettings(),
    players: room.getPlayers(),
    phase: room.getPhase(),
  } as RoomJoinedMessage);

  // Notify other players in the room
  socket.to(room.code).emit('message', {
    type: 'PLAYER_JOINED',
    timestamp: Date.now(),
    player: {
      id: result.playerId!,
      name: msg.playerName,
      color: result.color!,
      connected: true,
      isAccountUser: !!msg.sessionToken,
    },
  } as PlayerJoinedMessage);
}

function handleLeaveRoom(
  socket: Socket,
  roomManager: RoomManager,
  state: SocketState
): void {
  if (!state.roomCode || !state.playerId) return;

  const room = roomManager.getRoom(state.roomCode);
  if (room) {
    room.removePlayer(state.playerId);
    socket.leave(state.roomCode);

    // Notify others
    socket.to(state.roomCode).emit('message', {
      type: 'PLAYER_LEFT',
      timestamp: Date.now(),
      playerId: state.playerId,
      reason: 'left',
    });

    // Remove room if empty
    if (room.getPlayerCount() === 0) {
      roomManager.removeRoom(state.roomCode);
    }
  }

  state.roomCode = null;
  state.playerId = null;
}

function handleDraftSubmit(
  socket: Socket,
  msg: DraftSubmitMessage,
  roomManager: RoomManager,
  state: SocketState
): void {
  if (!state.roomCode || !state.playerId) return;

  const room = roomManager.getRoom(state.roomCode);
  if (!room) return;

  const result = room.submitDraft(state.playerId, msg.draft);

  if (!result.success) {
    socket.emit('message', {
      type: 'ROOM_ERROR',
      timestamp: Date.now(),
      error: 'INVALID_CODE',
      message: result.error || 'Invalid draft',
    } as RoomErrorMessage);
  }
}

function handlePlacePiece(
  socket: Socket,
  msg: PlacePieceMessage,
  roomManager: RoomManager,
  state: SocketState
): void {
  if (!state.roomCode || !state.playerId) return;

  const room = roomManager.getRoom(state.roomCode);
  if (!room) return;

  const result = room.placePiece(state.playerId, msg.pieceId, msg.position);

  if (!result.success) {
    socket.emit('message', {
      type: 'PLACEMENT_ERROR',
      timestamp: Date.now(),
      error: result.error || 'Invalid placement',
      placementState: null, // Room will send correct state
    });
  }
}

function handleMakeMove(
  _socket: Socket,
  msg: MakeMoveMessage,
  roomManager: RoomManager,
  state: SocketState
): void {
  if (!state.roomCode || !state.playerId) return;

  const room = roomManager.getRoom(state.roomCode);
  if (!room) return;

  room.makeMove(state.playerId, msg.from, msg.to, msg.promotionPieceType);
}

function handleResign(
  _socket: Socket,
  roomManager: RoomManager,
  state: SocketState
): void {
  if (!state.roomCode || !state.playerId) return;

  const room = roomManager.getRoom(state.roomCode);
  if (!room) return;

  room.handleResign(state.playerId);
}

function handleReconnect(
  socket: Socket,
  msg: ReconnectMessage,
  roomManager: RoomManager,
  state: SocketState
): void {
  const room = roomManager.getRoom(msg.roomCode);

  if (!room) {
    socket.emit('message', {
      type: 'ROOM_ERROR',
      timestamp: Date.now(),
      error: 'NOT_FOUND',
      message: 'Room no longer exists',
    } as RoomErrorMessage);
    return;
  }

  const syncState = room.handleReconnect(msg.playerId, socket);

  if (!syncState) {
    socket.emit('message', {
      type: 'ROOM_ERROR',
      timestamp: Date.now(),
      error: 'NOT_FOUND',
      message: 'Player not found in room',
    } as RoomErrorMessage);
    return;
  }

  state.roomCode = msg.roomCode;
  state.playerId = msg.playerId;

  socket.emit('message', syncState);
}

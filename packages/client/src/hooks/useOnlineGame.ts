/**
 * Online Game State Hook
 * Manages multiplayer game state and synchronization
 */

import { useState, useCallback, useEffect } from 'react';
import { useSocket } from './useSocket';
import type {
  RoomPhase,
  PlayerColor,
  PlayerInfo,
  RoomSettings,
  DraftPick,
  PlacementState,
  ServerToClientMessage,
  GameState,
  Position,
} from '@hyper-fairy-chess/shared';

export interface OnlineGameState {
  // Connection
  isConnected: boolean;
  connectionError: string | null;

  // Room
  roomCode: string | null;
  playerId: string | null;
  playerColor: PlayerColor | null;
  settings: RoomSettings | null;
  players: PlayerInfo[];
  phase: RoomPhase;

  // Draft
  draftTimeRemaining: number | null;
  opponentReady: boolean;
  draftRevealed: boolean;
  whiteDraft: DraftPick[] | null;
  blackDraft: DraftPick[] | null;

  // Placement
  placementState: PlacementState | null;

  // Game
  gameState: GameState | null;

  // Errors
  error: string | null;
}

const initialState: OnlineGameState = {
  isConnected: false,
  connectionError: null,
  roomCode: null,
  playerId: null,
  playerColor: null,
  settings: null,
  players: [],
  phase: 'waiting',
  draftTimeRemaining: null,
  opponentReady: false,
  draftRevealed: false,
  whiteDraft: null,
  blackDraft: null,
  placementState: null,
  gameState: null,
  error: null,
};

export function useOnlineGame() {
  const { isConnected, connectionError, sendMessage, addMessageListener } = useSocket();
  const [state, setState] = useState<OnlineGameState>(initialState);

  // Update connection status
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isConnected,
      connectionError,
    }));
  }, [isConnected, connectionError]);

  // Handle all incoming messages
  useEffect(() => {
    const unsubscribe = addMessageListener((message: ServerToClientMessage) => {
      handleMessage(message);
    });
    return unsubscribe;
  }, [addMessageListener]);

  const handleMessage = useCallback((message: ServerToClientMessage) => {
    switch (message.type) {
      case 'ROOM_CREATED':
        setState(prev => ({
          ...prev,
          roomCode: message.roomCode,
          playerId: message.playerId,
          playerColor: message.role === 'spectator' ? null : message.role,
          settings: message.settings,
          phase: 'waiting',
          error: null,
        }));
        // Store for reconnection
        localStorage.setItem('hfc_roomCode', message.roomCode);
        localStorage.setItem('hfc_playerId', message.playerId);
        break;

      case 'ROOM_JOINED':
        setState(prev => ({
          ...prev,
          roomCode: message.roomCode,
          playerId: message.playerId,
          playerColor: message.role === 'spectator' ? null : message.role,
          settings: message.settings,
          players: message.players,
          phase: message.phase,
          error: null,
        }));
        localStorage.setItem('hfc_roomCode', message.roomCode);
        localStorage.setItem('hfc_playerId', message.playerId);
        break;

      case 'PLAYER_JOINED':
        setState(prev => ({
          ...prev,
          players: [...prev.players, message.player],
        }));
        break;

      case 'PLAYER_LEFT':
        setState(prev => ({
          ...prev,
          players: prev.players.filter(p => p.id !== message.playerId),
        }));
        break;

      case 'ROOM_ERROR':
        setState(prev => ({
          ...prev,
          error: message.message,
        }));
        break;

      case 'DRAFT_START':
        setState(prev => ({
          ...prev,
          phase: 'drafting',
          draftTimeRemaining: message.timeLimit,
          opponentReady: false,
          draftRevealed: false,
          whiteDraft: null,
          blackDraft: null,
        }));
        break;

      case 'DRAFT_COUNTDOWN':
        setState(prev => ({
          ...prev,
          draftTimeRemaining: message.timeRemaining,
        }));
        break;

      case 'DRAFT_SUBMITTED':
        setState(prev => ({
          ...prev,
          opponentReady: message.playerId !== prev.playerId,
        }));
        break;

      case 'DRAFT_REVEAL':
        setState(prev => ({
          ...prev,
          draftRevealed: true,
          whiteDraft: message.whiteDraft,
          blackDraft: message.blackDraft,
        }));
        break;

      case 'PLACEMENT_START':
        setState(prev => ({
          ...prev,
          phase: 'placement',
          placementState: message.placementState,
        }));
        break;

      case 'PIECE_PLACED':
        setState(prev => ({
          ...prev,
          placementState: message.placementState,
          gameState: message.gameState,
        }));
        break;

      case 'PLACEMENT_ERROR':
        setState(prev => ({
          ...prev,
          error: message.error,
          placementState: message.placementState || prev.placementState,
        }));
        break;

      case 'GAME_START':
        setState(prev => ({
          ...prev,
          phase: 'playing',
          gameState: message.gameState,
        }));
        break;

      case 'MOVE_MADE':
        setState(prev => ({
          ...prev,
          gameState: message.gameState,
        }));
        break;

      case 'MOVE_REJECTED':
        setState(prev => ({
          ...prev,
          error: message.reason,
          gameState: message.correctState,
        }));
        break;

      case 'GAME_OVER':
        setState(prev => ({
          ...prev,
          phase: 'ended',
          gameState: message.finalState,
        }));
        break;

      case 'PLAYER_DISCONNECTED':
        setState(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.id === message.playerId ? { ...p, connected: false } : p
          ),
        }));
        break;

      case 'PLAYER_RECONNECTED':
        setState(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.id === message.playerId ? { ...p, connected: true } : p
          ),
        }));
        break;

      case 'SYNC_STATE':
        setState(prev => ({
          ...prev,
          phase: message.phase,
          settings: message.settings,
          players: message.players,
          gameState: message.gameState || prev.gameState,
          placementState: message.placementState || prev.placementState,
          whiteDraft: message.whiteDraft || prev.whiteDraft,
          blackDraft: message.blackDraft || prev.blackDraft,
        }));
        break;
    }
  }, []);

  // Actions
  const createRoom = useCallback((playerName: string, settings: RoomSettings) => {
    sendMessage({
      type: 'CREATE_ROOM',
      timestamp: Date.now(),
      playerName,
      settings,
    });
  }, [sendMessage]);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    sendMessage({
      type: 'JOIN_ROOM',
      timestamp: Date.now(),
      roomCode: roomCode.toUpperCase(),
      playerName,
    });
  }, [sendMessage]);

  const leaveRoom = useCallback(() => {
    sendMessage({
      type: 'LEAVE_ROOM',
      timestamp: Date.now(),
    });
    localStorage.removeItem('hfc_roomCode');
    localStorage.removeItem('hfc_playerId');
    setState(initialState);
  }, [sendMessage]);

  const submitDraft = useCallback((draft: DraftPick[]) => {
    sendMessage({
      type: 'DRAFT_SUBMIT',
      timestamp: Date.now(),
      draft,
    });
  }, [sendMessage]);

  const placePiece = useCallback((pieceId: string, position: Position) => {
    sendMessage({
      type: 'PLACE_PIECE',
      timestamp: Date.now(),
      pieceId,
      position,
    });
  }, [sendMessage]);

  const makeMove = useCallback((from: Position, to: Position, promotionPieceTypeId?: string) => {
    sendMessage({
      type: 'MAKE_MOVE',
      timestamp: Date.now(),
      from,
      to,
      promotionPieceType: promotionPieceTypeId,
    });
  }, [sendMessage]);

  const resign = useCallback(() => {
    sendMessage({
      type: 'RESIGN',
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const reconnect = useCallback(() => {
    const roomCode = localStorage.getItem('hfc_roomCode');
    const playerId = localStorage.getItem('hfc_playerId');

    if (roomCode && playerId) {
      sendMessage({
        type: 'RECONNECT',
        timestamp: Date.now(),
        roomCode,
        playerId,
      });
    }
  }, [sendMessage]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    actions: {
      createRoom,
      joinRoom,
      leaveRoom,
      submitDraft,
      placePiece,
      makeMove,
      resign,
      reconnect,
      clearError,
    },
  };
}

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
  BoardState,
} from '@hyper-fairy-chess/shared';

/**
 * Reconstruct gameState after receiving over socket.io
 * Maps don't serialize to JSON properly, so we rebuild positionMap from pieces
 */
function reconstructGameState(gameState: GameState): GameState {
  const positionMap = new Map<string, string>();
  for (const piece of gameState.board.pieces) {
    if (piece.position) {
      const key = `${piece.position.file}${piece.position.rank}`;
      positionMap.set(key, piece.id);
    }
  }

  const reconstructedBoard: BoardState = {
    ...gameState.board,
    positionMap,
  };

  return {
    ...gameState,
    board: reconstructedBoard,
  };
}

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

  // Blind placement
  blindMode: boolean;
  myPlacedPieces: Array<{ pieceId: string; position: Position }>;
  myReady: boolean;
  opponentBlindReady: boolean;

  // Game
  gameState: GameState | null;

  // Draw offer
  drawOfferedBy: PlayerColor | null;

  // Errors
  error: string | null;

  // Opponent status notification
  opponentStatus: 'connected' | 'disconnected' | 'left' | null;
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
  blindMode: false,
  myPlacedPieces: [],
  myReady: false,
  opponentBlindReady: false,
  gameState: null,
  drawOfferedBy: null,
  error: null,
  opponentStatus: null,
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
          opponentStatus: message.playerId !== prev.playerId ? 'left' : prev.opponentStatus,
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
          gameState: reconstructGameState(message.gameState),
          blindMode: message.placementState.mode === 'blind',
          myPlacedPieces: [],
          myReady: false,
          opponentBlindReady: false,
        }));
        break;

      case 'PIECE_PLACED':
        setState(prev => ({
          ...prev,
          placementState: message.placementState,
          gameState: reconstructGameState(message.gameState),
        }));
        break;

      case 'PLACEMENT_ERROR':
        setState(prev => ({
          ...prev,
          error: message.error,
          placementState: message.placementState || prev.placementState,
        }));
        break;

      case 'BLIND_PLACEMENT_CONFIRM':
        setState(prev => {
          // Update myPlacedPieces with the new piece
          let updatedPlacedPieces = [
            ...prev.myPlacedPieces,
            { pieceId: message.pieceId, position: message.position },
          ];

          // If a pawn was swapped (Herald placement), update the pawn's position
          if (message.pawnSwap) {
            updatedPlacedPieces = updatedPlacedPieces.map(p =>
              p.pieceId === message.pawnSwap!.pawnId
                ? { ...p, position: message.pawnSwap!.newPosition }
                : p
            );
          }

          return {
            ...prev,
            myPlacedPieces: updatedPlacedPieces,
            // Remove the piece from placementState's piecesToPlace for UI update
            placementState: prev.placementState ? {
              ...prev.placementState,
              whitePiecesToPlace: prev.playerColor === 'white'
                ? prev.placementState.whitePiecesToPlace.filter(p => p.id !== message.pieceId)
                : prev.placementState.whitePiecesToPlace,
              blackPiecesToPlace: prev.playerColor === 'black'
                ? prev.placementState.blackPiecesToPlace.filter(p => p.id !== message.pieceId)
                : prev.placementState.blackPiecesToPlace,
            } : null,
          };
        });
        break;

      case 'BLIND_UNPLACE_CONFIRM':
        setState(prev => {
          if (!prev.placementState) return prev;

          // Reconstruct the full PieceInstance from the message data
          const restoredPiece = {
            id: message.piece.id,
            typeId: message.piece.typeId,
            owner: message.piece.owner,
            position: null,
            hasMoved: false,
            isFrozen: false,
          };

          // Add piece back to appropriate piecesToPlace list
          const isWhite = prev.playerColor === 'white';
          return {
            ...prev,
            myPlacedPieces: prev.myPlacedPieces.filter(p => p.pieceId !== message.pieceId),
            placementState: {
              ...prev.placementState,
              whitePiecesToPlace: isWhite
                ? [...prev.placementState.whitePiecesToPlace, restoredPiece]
                : prev.placementState.whitePiecesToPlace,
              blackPiecesToPlace: !isWhite
                ? [...prev.placementState.blackPiecesToPlace, restoredPiece]
                : prev.placementState.blackPiecesToPlace,
            },
          };
        });
        break;

      case 'BLIND_READY_STATUS':
        setState(prev => ({
          ...prev,
          myReady: message.color === prev.playerColor ? message.ready : prev.myReady,
          opponentBlindReady: message.color !== prev.playerColor ? message.ready : prev.opponentBlindReady,
          placementState: prev.placementState ? {
            ...prev.placementState,
            whiteReady: message.color === 'white' ? message.ready : prev.placementState.whiteReady,
            blackReady: message.color === 'black' ? message.ready : prev.placementState.blackReady,
          } : null,
        }));
        break;

      case 'BLIND_PLACEMENT_REVEAL':
        // Full board is revealed, transition to play
        setState(prev => ({
          ...prev,
          gameState: reconstructGameState(message.gameState),
          blindMode: false,
          myPlacedPieces: [],
          myReady: false,
          opponentBlindReady: false,
        }));
        break;

      case 'GAME_START':
        setState(prev => ({
          ...prev,
          phase: 'playing',
          gameState: reconstructGameState(message.gameState),
        }));
        break;

      case 'MOVE_MADE':
        setState(prev => ({
          ...prev,
          gameState: reconstructGameState(message.gameState),
          drawOfferedBy: null, // Clear any pending draw offer when a move is made
        }));
        break;

      case 'MOVE_REJECTED':
        setState(prev => ({
          ...prev,
          error: message.reason,
          gameState: reconstructGameState(message.correctState),
        }));
        break;

      case 'GAME_OVER':
        setState(prev => ({
          ...prev,
          phase: 'ended',
          gameState: reconstructGameState(message.finalState),
        }));
        break;

      case 'PLAYER_DISCONNECTED':
        setState(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.id === message.playerId ? { ...p, connected: false } : p
          ),
          opponentStatus: message.playerId !== prev.playerId ? 'disconnected' : prev.opponentStatus,
        }));
        break;

      case 'PLAYER_RECONNECTED':
        setState(prev => ({
          ...prev,
          players: prev.players.map(p =>
            p.id === message.playerId ? { ...p, connected: true } : p
          ),
          opponentStatus: message.playerId !== prev.playerId ? 'connected' : prev.opponentStatus,
        }));
        break;

      case 'SYNC_STATE':
        setState(prev => ({
          ...prev,
          phase: message.phase,
          settings: message.settings,
          players: message.players,
          gameState: message.gameState ? reconstructGameState(message.gameState) : prev.gameState,
          placementState: message.placementState || prev.placementState,
          whiteDraft: message.whiteDraft || prev.whiteDraft,
          blackDraft: message.blackDraft || prev.blackDraft,
          // Restore blind placement state if present
          blindMode: message.placementState?.mode === 'blind',
          myPlacedPieces: message.blindPlacementState?.myPlacedPieces || [],
          myReady: message.blindPlacementState?.myReady || false,
          opponentBlindReady: message.blindPlacementState?.opponentReady || false,
        }));
        break;

      case 'DRAW_OFFERED':
        setState(prev => ({
          ...prev,
          drawOfferedBy: message.by,
        }));
        break;

      case 'DRAW_DECLINED':
        setState(prev => ({
          ...prev,
          drawOfferedBy: null,
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

  // Blind placement actions
  const blindPlacePiece = useCallback((pieceId: string, position: Position) => {
    sendMessage({
      type: 'BLIND_PLACE_PIECE',
      timestamp: Date.now(),
      pieceId,
      position,
    });
  }, [sendMessage]);

  const blindUnplacePiece = useCallback((pieceId: string) => {
    sendMessage({
      type: 'BLIND_UNPLACE_PIECE',
      timestamp: Date.now(),
      pieceId,
    });
  }, [sendMessage]);

  const setBlindReady = useCallback(() => {
    sendMessage({
      type: 'BLIND_PLACEMENT_READY',
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const cancelBlindReady = useCallback(() => {
    sendMessage({
      type: 'BLIND_PLACEMENT_UNREADY',
      timestamp: Date.now(),
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

  const offerDraw = useCallback(() => {
    sendMessage({
      type: 'OFFER_DRAW',
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const respondDraw = useCallback((accept: boolean) => {
    sendMessage({
      type: 'RESPOND_DRAW',
      timestamp: Date.now(),
      accept,
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
      blindPlacePiece,
      blindUnplacePiece,
      setBlindReady,
      cancelBlindReady,
      makeMove,
      resign,
      offerDraw,
      respondDraw,
      reconnect,
      clearError,
    },
  };
}

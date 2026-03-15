/**
 * Game state management for 3-player GreenChess.
 */

import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import { simulateThreeMove, isInThreeCheck, getThreeLegalMoves } from './checkDetection';
import type {
  ThreeGameState,
  ThreeBoardState,
  ThreePiece,
  ThreePos,
  Section,
} from './types';
import { threeposKey, threeposEqual, THREE_SECTIONS } from './types';

let pieceIdCounter = 0;
export function resetThreePieceIdCounter() {
  pieceIdCounter = 0;
}

function nextId(prefix: string): string {
  return `${prefix}_${++pieceIdCounter}`;
}

/** Create an empty board state with no pieces. */
function createEmptyThreeBoard(): ThreeBoardState {
  return {
    pieces: [],
    currentTurn: 'white',
    activePlayers: [...THREE_SECTIONS],
    positionMap: new Map(),
  };
}

/** Create initial 3-player game state (setup phase). */
export function createThreePlayerGameState(pointBudget: number): ThreeGameState {
  return {
    board: createEmptyThreeBoard(),
    phase: 'setup',
    pointBudget,
    halfmoveClock: 0,
    turnNumber: 1,
    result: null,
    enPassantTarget: null,
  };
}

/** Rebuild the positionMap from the pieces array. */
export function rebuildThreePositionMap(state: ThreeGameState): ThreeGameState {
  const newMap = new Map<string, ThreePiece>();
  for (const p of state.board.pieces) {
    newMap.set(threeposKey(p.position), p);
  }
  return {
    ...state,
    board: { ...state.board, positionMap: newMap },
  };
}

/**
 * Place a piece onto the board during the placement phase.
 * Returns the new state if valid, or the same state if invalid.
 */
export function placeThreePiece(
  state: ThreeGameState,
  pieceId: string,
  pos: ThreePos,
): ThreeGameState {
  const piece = state.board.pieces.find((p) => p.id === pieceId);
  if (!piece) return state;
  if (state.board.positionMap.has(threeposKey(pos))) return state; // occupied

  const updatedPieces = state.board.pieces.map((p) =>
    p.id === pieceId ? { ...p, position: pos } : p,
  );
  const newMap = new Map(state.board.positionMap);
  newMap.set(threeposKey(pos), { ...piece, position: pos });

  return {
    ...state,
    board: { ...state.board, pieces: updatedPieces, positionMap: newMap },
  };
}

/**
 * Execute a move during the play phase.
 * Validates the move is legal, applies it, advances the turn.
 */
export function executeThreeMove(
  state: ThreeGameState,
  from: ThreePos,
  to: ThreePos,
): ThreeGameState {
  const movingPiece = state.board.positionMap.get(threeposKey(from));
  if (!movingPiece) return state;
  if (movingPiece.owner !== state.board.currentTurn) return state;

  // Apply the move
  let newState = simulateThreeMove(state, from, to);

  // En passant: if pawn captured en passant, remove the captured pawn
  let newEnPassantTarget: ThreePos | null = null;
  const pt = PIECE_BY_ID[movingPiece.typeId];
  if (pt?.movement.special.includes('pawn-forward')) {
    // Check for double-step (set en passant target)
    if (Math.abs(to.srank - from.srank) === 2 && from.section === to.section) {
      const epRank = ((from.srank + to.srank) / 2) as ThreePos['srank'];
      newEnPassantTarget = { section: from.section, sfile: from.sfile, srank: epRank };
    }
    // En passant capture: if pawn moved diagonally to empty en passant square
    if (state.enPassantTarget && threeposEqual(to, state.enPassantTarget)) {
      // The captured pawn is on the same rank as the moving pawn's FROM square but at the TO sfile
      const epCapturedPos: ThreePos = { section: from.section, sfile: to.sfile, srank: from.srank };
      const newPieces = newState.board.pieces.filter(
        (p) => !threeposEqual(p.position, epCapturedPos),
      );
      const newMap = new Map<string, ThreePiece>();
      for (const p of newPieces) newMap.set(threeposKey(p.position), p);
      newState = { ...newState, board: { ...newState.board, pieces: newPieces, positionMap: newMap } };
    }
  }

  // Advance turn
  const players = newState.board.activePlayers;
  const idx = players.indexOf(newState.board.currentTurn);
  const nextTurn = players[(idx + 1) % players.length];

  // Update halfmove clock
  const captured = state.board.positionMap.has(threeposKey(to));
  const isPawn = pt?.movement.special.includes('pawn-forward');
  const newHalfmove = captured || isPawn ? 0 : state.halfmoveClock + 1;

  // Turn number increments after black (last player in cycle)
  const newTurnNumber =
    newState.board.currentTurn === 'black'
      ? state.turnNumber + 1
      : state.turnNumber;

  newState = {
    ...newState,
    board: { ...newState.board, currentTurn: nextTurn },
    halfmoveClock: newHalfmove,
    turnNumber: newTurnNumber,
    enPassantTarget: newEnPassantTarget,
  };

  // Check for game end: if the moving piece captured a king, the victim is eliminated
  // (simplified: detect if any royal pieces were on 'to' — already removed by simulateThreeMove)
  // Check for checkmate/stalemate for next player
  newState = detectGameEnd(newState);

  return newState;
}

function detectGameEnd(state: ThreeGameState): ThreeGameState {
  // Check if any active player has no legal moves
  for (const section of state.board.activePlayers) {
    // Check if this player's king was captured
    const hasKing = state.board.pieces.some((p) => {
      if (p.owner !== section) return false;
      const pt = PIECE_BY_ID[p.typeId];
      return pt?.isRoyal ?? false;
    });

    if (!hasKing) {
      // This player lost — for MVP, the game ends
      // Find remaining players to determine winner
      const remaining = state.board.activePlayers.filter((s) => s !== section);
      const winner = remaining.length === 1 ? remaining[0] : null;
      return {
        ...state,
        phase: 'ended',
        result: { winner, reason: 'checkmate' },
      };
    }
  }

  // Check for checkmate/stalemate of current turn player
  const currentPlayer = state.board.currentTurn;
  const hasAnyLegalMove = state.board.pieces
    .filter((p) => p.owner === currentPlayer)
    .some((p) => getThreeLegalMoves(state, p.id).length > 0);

  if (!hasAnyLegalMove) {
    const inCheck = isInThreeCheck(state, currentPlayer);
    if (inCheck) {
      // Checkmate — current player loses
      const remaining = state.board.activePlayers.filter((s) => s !== currentPlayer);
      const winner = remaining.length === 1 ? remaining[0] : null;
      return {
        ...state,
        phase: 'ended',
        result: { winner, reason: 'checkmate' },
      };
    } else {
      // Stalemate — draw
      return {
        ...state,
        phase: 'ended',
        result: { winner: null, reason: 'stalemate' },
      };
    }
  }

  return state;
}

/**
 * Add a piece to the board state (used during placement phase setup).
 * The piece starts with no position — position is assigned when placed.
 */
export function addThreePieceToBoard(
  state: ThreeGameState,
  owner: Section,
  typeId: string,
  position: ThreePos,
): ThreeGameState {
  const id = nextId(`${owner}_${typeId}`);
  const piece: ThreePiece = { id, owner, typeId, position, hasMoved: false };
  const newMap = new Map(state.board.positionMap);
  newMap.set(threeposKey(position), piece);
  return {
    ...state,
    board: {
      ...state.board,
      pieces: [...state.board.pieces, piece],
      positionMap: newMap,
    },
  };
}

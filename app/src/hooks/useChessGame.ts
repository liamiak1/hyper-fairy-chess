/**
 * React hook for managing chess game state
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  GameState,
  Position,
  PieceInstance,
  PieceType,
  PlayerColor,
  GameResult,
} from '../game/types';
import { arePositionsEqual } from '../game/types';
import { PIECE_BY_ID } from '../game/pieces/pieceDefinitions';
import { getPieceAt, initializeRoyalTracking } from '../game/board/boardUtils';
import { generateLegalMoves } from '../game/rules/checkDetection';
import { getCastlingDestinations } from '../game/rules/castling';
import {
  executeMove,
  prepareMoveFromPositions,
  createInitialGameState,
  createStandardChessPieces,
  createEmptyGameState,
  getCoordinatorCaptures,
  getBoxerCaptures,
  getWithdrawerCapture,
  getThiefCapture,
  getLongLeaperCaptures,
  getChameleonCaptures,
} from '../game/rules/moveExecution';
import { isPromotionMove, getPromotionOptionsForPiece } from '../game/rules/promotion';
import { getGameResult, getResultDescription, createResignationResult } from '../game/rules/gameEndDetection';
import type { PlacementState } from '../game/rules/placement';
import {
  createPlacementStateFromDrafts,
  getPlacementZones,
  getValidPlacementSquares,
  isValidPlacement,
  getPiecesToPlace,
  isPlacementComplete,
  getNextPlacer,
  isHerald,
  getHeraldActualPosition,
  shouldPawnSwapToBackRank,
  getPawnSwapPosition,
} from '../game/rules/placement';
import type { PlayerDraft } from '../game/rules/draft';
import {
  createEmptyDraft,
  getAvailablePieces,
  canAddPiece,
  addPieceToDraft,
  removePieceFromDraft,
  resetDraftPieceIdCounter,
} from '../game/rules/draft';

// =============================================================================
// Types
// =============================================================================

interface PromotionPending {
  piece: PieceInstance;
  from: Position;
  to: Position;
}

interface SpecialCaptureTarget {
  position: Position;
  movePosition: Position; // The move that causes this capture
}

export type GameMode = 'standard' | 'placement' | 'draft';

export interface UseChessGameReturn {
  // State
  gameState: GameState;
  selectedPiece: PieceInstance | null;
  validMoves: Position[];
  specialCaptureTargets: SpecialCaptureTarget[];
  promotionPending: PromotionPending | null;
  promotionOptions: PieceType[];

  // Placement state
  placementState: PlacementState | null;
  piecesToPlace: PieceInstance[];
  selectedPieceToPlace: PieceInstance | null;
  validPlacementSquares: Position[];
  isPlacementPhase: boolean;

  // Draft state
  isSetupPhase: boolean;
  isDraftPhase: boolean;
  showHandoff: boolean;
  currentDrafter: PlayerColor;
  currentDraft: PlayerDraft | null;
  availablePieces: PieceType[];
  budget: number;

  // Actions
  selectSquare: (position: Position) => void;
  selectPromotion: (pieceTypeId: string) => void;
  cancelPromotion: () => void;
  resetGame: () => void;
  resign: (player: PlayerColor) => void;

  // Placement actions
  selectPieceToPlace: (piece: PieceInstance) => void;
  placePiece: (position: Position) => void;

  // Draft actions
  startDraft: (budget: number) => void;
  addToDraft: (pieceType: PieceType) => void;
  removeFromDraft: (pieceTypeId: string) => void;
  confirmDraft: () => void;
  acknowledgeHandoff: () => void;

  // Undo
  undoMove: () => void;
  canUndo: boolean;

  // Computed state
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isGameOver: boolean;
  result: GameResult | null;
  resultDescription: string | null;
  currentTurn: PlayerColor;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useChessGame(
  mode: GameMode = 'standard'
): UseChessGameReturn {
  // Initialize game state
  const [gameState, setGameState] = useState<GameState>(() => {
    if (mode === 'draft') {
      return { ...createEmptyGameState('8x8'), phase: 'setup' as const };
    }
    if (mode === 'placement') {
      return createEmptyGameState('8x8');
    }
    const pieces = createStandardChessPieces();
    return createInitialGameState(pieces, '8x8');
  });

  // Selection state (for play phase)
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);

  // Promotion state
  const [promotionPending, setPromotionPending] = useState<PromotionPending | null>(null);

  // Placement state
  const [placementState, setPlacementState] = useState<PlacementState | null>(null);

  // Undo history - stores previous game states
  const [stateHistory, setStateHistory] = useState<GameState[]>([]);

  // Draft state
  const [budget, setBudget] = useState<number>(400);
  const [whiteDraft, setWhiteDraft] = useState<PlayerDraft | null>(null);
  const [blackDraft, setBlackDraft] = useState<PlayerDraft | null>(null);
  const [currentDrafter, setCurrentDrafter] = useState<PlayerColor>('white');
  const [showHandoff, setShowHandoff] = useState(false);

  // Computed: selected piece
  const selectedPiece = useMemo(() => {
    if (!selectedPieceId) return null;
    return gameState.board.pieces.find((p) => p.id === selectedPieceId) ?? null;
  }, [selectedPieceId, gameState.board.pieces]);

  // Computed: valid moves for selected piece
  const validMoves = useMemo(() => {
    if (!selectedPiece || !selectedPiece.position) return [];

    const pieceType = PIECE_BY_ID[selectedPiece.typeId];
    if (!pieceType) return [];

    // Get basic legal moves
    const moves = generateLegalMoves(
      gameState.board,
      selectedPiece,
      gameState.enPassantTarget
    );

    // Add castling moves if this is a royal piece
    if (pieceType.isRoyal) {
      const castlingMoves = getCastlingDestinations(gameState.board, selectedPiece);
      moves.push(...castlingMoves);
    }

    return moves;
  }, [selectedPiece, gameState.board, gameState.enPassantTarget]);

  // Computed: special capture targets for selected piece
  const specialCaptureTargets = useMemo(() => {
    if (!selectedPiece || validMoves.length === 0) return [];

    const pieceType = PIECE_BY_ID[selectedPiece.typeId];
    if (!pieceType) return [];

    const targets: SpecialCaptureTarget[] = [];

    // Only calculate for pieces with special capture types
    if (!['coordinator', 'boxer', 'withdrawal', 'thief', 'long-leap', 'chameleon'].includes(pieceType.captureType)) {
      return [];
    }

    for (const move of validMoves) {
      let captures: { pieceId: string; position: Position }[] = [];

      switch (pieceType.captureType) {
        case 'coordinator':
          captures = getCoordinatorCaptures(gameState.board, selectedPiece.owner, move);
          break;
        case 'boxer':
          captures = getBoxerCaptures(gameState.board, selectedPiece.owner, move);
          break;
        case 'withdrawal':
          if (selectedPiece.position) {
            const capture = getWithdrawerCapture(gameState.board, selectedPiece.owner, selectedPiece.position, move);
            if (capture) captures = [capture];
          }
          break;
        case 'thief':
          if (selectedPiece.position) {
            const capture = getThiefCapture(gameState.board, selectedPiece.owner, selectedPiece.position, move);
            if (capture) captures = [capture];
          }
          break;
        case 'long-leap':
          if (selectedPiece.position) {
            captures = getLongLeaperCaptures(gameState.board, selectedPiece.owner, selectedPiece.position, move);
          }
          break;
        case 'chameleon':
          if (selectedPiece.position) {
            const chameleonCaptures = getChameleonCaptures(gameState.board, selectedPiece, selectedPiece.position, move);
            if (chameleonCaptures) captures = chameleonCaptures;
          }
          break;
      }

      for (const capture of captures) {
        targets.push({
          position: capture.position,
          movePosition: move,
        });
      }
    }

    return targets;
  }, [selectedPiece, validMoves, gameState.board]);

  // Computed: game result
  const result = useMemo(() => {
    return getGameResult(gameState);
  }, [gameState]);

  // Computed: promotion options
  const promotionOptions = useMemo(() => {
    if (!promotionPending) return [];
    const pieceType = PIECE_BY_ID[promotionPending.piece.typeId];
    if (!pieceType) return [];
    return getPromotionOptionsForPiece(pieceType, gameState);
  }, [promotionPending, gameState]);

  // Computed: phase checks
  const isSetupPhase = gameState.phase === 'setup';
  const isDraftPhase = gameState.phase === 'draft';
  const isPlacementPhase = gameState.phase === 'placement';

  // Computed: current draft (for current drafter)
  const currentDraft = useMemo(() => {
    if (!isDraftPhase) return null;
    return currentDrafter === 'white' ? whiteDraft : blackDraft;
  }, [isDraftPhase, currentDrafter, whiteDraft, blackDraft]);

  // Computed: available pieces for draft
  const availablePieces = useMemo(() => {
    return getAvailablePieces();
  }, []);

  // Computed: pieces to place for current placer
  const piecesToPlace = useMemo(() => {
    if (!placementState) return [];
    return getPiecesToPlace(placementState, placementState.currentPlacer);
  }, [placementState]);

  // Computed: selected piece to place
  const selectedPieceToPlace = useMemo(() => {
    if (!placementState || !placementState.selectedPieceId) return null;
    const allPieces = [...placementState.whitePiecesToPlace, ...placementState.blackPiecesToPlace];
    return allPieces.find((p) => p.id === placementState.selectedPieceId) ?? null;
  }, [placementState]);

  // Computed: valid placement squares
  const validPlacementSquares = useMemo(() => {
    if (!placementState || !selectedPieceToPlace) return [];
    const zones = getPlacementZones(gameState.boardSize, placementState.currentPlacer);
    return getValidPlacementSquares(gameState.board, selectedPieceToPlace, zones, gameState.board.dimensions);
  }, [placementState, selectedPieceToPlace, gameState.board, gameState.boardSize]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Handle square click
   */
  const selectSquare = useCallback(
    (position: Position) => {
      // Game over - no more moves
      if (result) return;

      // Promotion pending - ignore clicks
      if (promotionPending) return;

      const clickedPiece = getPieceAt(gameState.board, position);

      // If no piece selected
      if (!selectedPiece) {
        // Select own piece
        if (clickedPiece && clickedPiece.owner === gameState.currentTurn) {
          setSelectedPieceId(clickedPiece.id);
        }
        return;
      }

      // Piece is selected - check if clicking same piece (deselect)
      if (selectedPiece.position && arePositionsEqual(selectedPiece.position, position)) {
        setSelectedPieceId(null);
        return;
      }

      // Check if clicking a valid move FIRST (before switching selection)
      // This handles swaps with friendly pieces (Phantom King, etc.)
      const isValidMove = validMoves.some((m) => arePositionsEqual(m, position));

      // If NOT a valid move and clicking another own piece, switch selection
      if (!isValidMove && clickedPiece && clickedPiece.owner === gameState.currentTurn) {
        setSelectedPieceId(clickedPiece.id);
        return;
      }

      if (isValidMove && selectedPiece.position) {
        // Check if this is a promotion move
        const pieceType = PIECE_BY_ID[selectedPiece.typeId];
        if (
          pieceType &&
          isPromotionMove(selectedPiece, pieceType, position, gameState.board.dimensions)
        ) {
          // Set promotion pending
          setPromotionPending({
            piece: selectedPiece,
            from: selectedPiece.position,
            to: position,
          });
          return;
        }

        // Execute the move
        const move = prepareMoveFromPositions(
          gameState,
          selectedPiece,
          selectedPiece.position,
          position
        );

        if (move) {
          // Save current state to history before executing move
          setStateHistory(prev => [...prev, gameState]);
          const newState = executeMove(gameState, move);
          setGameState(newState);
          setSelectedPieceId(null);
        }
      } else {
        // Invalid move - deselect
        setSelectedPieceId(null);
      }
    },
    [gameState, selectedPiece, validMoves, result, promotionPending]
  );

  /**
   * Select promotion piece
   */
  const selectPromotion = useCallback(
    (pieceTypeId: string) => {
      if (!promotionPending) return;

      const move = prepareMoveFromPositions(
        gameState,
        promotionPending.piece,
        promotionPending.from,
        promotionPending.to,
        pieceTypeId
      );

      if (move) {
        // Save current state to history before executing move
        setStateHistory(prev => [...prev, gameState]);
        const newState = executeMove(gameState, move);
        setGameState(newState);
      }

      setPromotionPending(null);
      setSelectedPieceId(null);
    },
    [gameState, promotionPending]
  );

  /**
   * Cancel promotion (go back to move selection)
   */
  const cancelPromotion = useCallback(() => {
    setPromotionPending(null);
  }, []);

  /**
   * Reset the game
   */
  const resetGame = useCallback(() => {
    if (mode === 'draft') {
      setGameState({ ...createEmptyGameState('8x8'), phase: 'setup' as const });
      setPlacementState(null);
      setWhiteDraft(null);
      setBlackDraft(null);
      setCurrentDrafter('white');
      setShowHandoff(false);
    } else if (mode === 'placement') {
      setGameState(createEmptyGameState('8x8'));
      setPlacementState(null);
    } else {
      const pieces = createStandardChessPieces();
      setGameState(createInitialGameState(pieces, '8x8'));
      setPlacementState(null);
    }
    setSelectedPieceId(null);
    setPromotionPending(null);
    setStateHistory([]); // Clear undo history
  }, [mode]);

  /**
   * Undo the last move
   */
  const undoMove = useCallback(() => {
    if (stateHistory.length === 0) return;

    // Get the previous state
    const previousState = stateHistory[stateHistory.length - 1];

    // Remove the last state from history
    setStateHistory(prev => prev.slice(0, -1));

    // Restore the previous state
    setGameState(previousState);
    setSelectedPieceId(null);
    setPromotionPending(null);
  }, [stateHistory]);

  /**
   * Resign the game
   */
  const resign = useCallback(
    (player: PlayerColor) => {
      if (result) return;

      setGameState((prev) => ({
        ...prev,
        result: createResignationResult(player),
        phase: 'ended',
      }));
    },
    [result]
  );

  // ==========================================================================
  // Placement Actions
  // ==========================================================================

  /**
   * Select a piece to place
   */
  const selectPieceToPlace = useCallback(
    (piece: PieceInstance) => {
      if (!placementState) return;
      if (piece.owner !== placementState.currentPlacer) return;

      setPlacementState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          selectedPieceId: prev.selectedPieceId === piece.id ? null : piece.id,
        };
      });
    },
    [placementState]
  );

  /**
   * Place the selected piece on the board
   */
  const placePiece = useCallback(
    (position: Position) => {
      if (!placementState || !selectedPieceToPlace) return;

      const zones = getPlacementZones(gameState.boardSize, placementState.currentPlacer);
      if (!isValidPlacement(gameState.board, selectedPieceToPlace, position, zones)) return;

      const currentPlacer = placementState.currentPlacer;
      let actualPosition = position;

      // Herald special placement: goes to pawn rank instead of back rank
      // Also need to move any existing pawn on that file to the back rank
      let pawnToMove: PieceInstance | null = null;
      let pawnNewPosition: Position | null = null;

      if (isHerald(selectedPieceToPlace)) {
        actualPosition = getHeraldActualPosition(
          position,
          currentPlacer,
          gameState.board.dimensions
        );

        // Check if there's already a pawn on the pawn rank in this file
        const pawnRank = currentPlacer === 'white' ? 2 : (gameState.board.dimensions.ranks - 1);
        const pawnRankPosKey = `${actualPosition.file}${pawnRank}`;
        const existingPieceId = gameState.board.positionMap.get(pawnRankPosKey);

        if (existingPieceId) {
          const existingPiece = gameState.board.pieces.find((p) => p.id === existingPieceId);
          if (existingPiece) {
            const existingPieceType = PIECE_BY_ID[existingPiece.typeId];
            if (existingPieceType?.tier === 'pawn' && existingPiece.owner === currentPlacer) {
              // Move this pawn to the back rank
              pawnToMove = existingPiece;
              pawnNewPosition = getPawnSwapPosition(
                actualPosition.file,
                currentPlacer,
                gameState.board.dimensions
              );
            }
          }
        }
      }

      // Pawn special placement: if Herald is already on pawn rank in this file, go to back rank
      const pieceType = PIECE_BY_ID[selectedPieceToPlace.typeId];
      if (pieceType && pieceType.tier === 'pawn') {
        if (shouldPawnSwapToBackRank(
          gameState.board,
          position.file,
          currentPlacer,
          gameState.board.dimensions
        )) {
          actualPosition = getPawnSwapPosition(
            position.file,
            currentPlacer,
            gameState.board.dimensions
          );
        }
      }

      // Create the placed piece with actual position
      const placedPiece: PieceInstance = {
        ...selectedPieceToPlace,
        position: actualPosition,
      };

      // Update board state - add piece to board
      let newPieces = [...gameState.board.pieces, placedPiece];
      const newPositionMap = new Map(gameState.board.positionMap);

      // If a pawn needs to be moved due to Herald placement, update it
      if (pawnToMove && pawnNewPosition) {
        newPieces = newPieces.map((p) =>
          p.id === pawnToMove!.id ? { ...p, position: pawnNewPosition } : p
        );
        // Remove pawn from old position and add to new position
        newPositionMap.delete(`${pawnToMove.position!.file}${pawnToMove.position!.rank}`);
        newPositionMap.set(`${pawnNewPosition.file}${pawnNewPosition.rank}`, pawnToMove.id);
      }
      newPositionMap.set(`${actualPosition.file}${actualPosition.rank}`, placedPiece.id);

      // Update placement state - remove piece from to-place list
      const newWhitePieces =
        currentPlacer === 'white'
          ? placementState.whitePiecesToPlace.filter((p) => p.id !== selectedPieceToPlace.id)
          : placementState.whitePiecesToPlace;
      const newBlackPieces =
        currentPlacer === 'black'
          ? placementState.blackPiecesToPlace.filter((p) => p.id !== selectedPieceToPlace.id)
          : placementState.blackPiecesToPlace;

      // Create updated placement state to check completion
      const updatedPlacementState: PlacementState = {
        whitePiecesToPlace: newWhitePieces,
        blackPiecesToPlace: newBlackPieces,
        currentPlacer: getNextPlacer(
          { ...placementState, whitePiecesToPlace: newWhitePieces, blackPiecesToPlace: newBlackPieces },
          currentPlacer
        ),
        selectedPieceId: null,
      };

      // Check if placement is complete
      const placementComplete = isPlacementComplete(updatedPlacementState);

      // Update game state
      setGameState((prev) => {
        let newBoard = {
          ...prev.board,
          pieces: newPieces,
          positionMap: newPositionMap,
        };

        // Initialize royal tracking when placement completes (for Regent logic)
        if (placementComplete) {
          newBoard = initializeRoyalTracking(newBoard);
        }

        return {
          ...prev,
          board: newBoard,
          phase: placementComplete ? 'play' : 'placement',
          currentTurn: placementComplete ? 'white' : updatedPlacementState.currentPlacer,
        };
      });

      // Update placement state
      setPlacementState(placementComplete ? null : updatedPlacementState);
    },
    [placementState, selectedPieceToPlace, gameState]
  );

  // ==========================================================================
  // Draft Actions
  // ==========================================================================

  /**
   * Start the draft with a given budget
   */
  const startDraft = useCallback((selectedBudget: number) => {
    setBudget(selectedBudget);
    setWhiteDraft(createEmptyDraft());
    setBlackDraft(null);
    setCurrentDrafter('white');
    setShowHandoff(false);
    setGameState((prev) => ({
      ...prev,
      phase: 'draft',
      pointBudget: selectedBudget,
    }));
  }, []);

  /**
   * Add a piece to the current player's draft
   */
  const addToDraft = useCallback(
    (pieceType: PieceType) => {
      const draft = currentDrafter === 'white' ? whiteDraft : blackDraft;
      if (!draft) return;
      if (!canAddPiece(draft, pieceType, budget, gameState.boardSize)) return;

      const newDraft = addPieceToDraft(draft, pieceType);
      if (currentDrafter === 'white') {
        setWhiteDraft(newDraft);
      } else {
        setBlackDraft(newDraft);
      }
    },
    [currentDrafter, whiteDraft, blackDraft, budget, gameState.boardSize]
  );

  /**
   * Remove a piece from the current player's draft
   */
  const removeFromDraft = useCallback(
    (pieceTypeId: string) => {
      const draft = currentDrafter === 'white' ? whiteDraft : blackDraft;
      if (!draft) return;

      const newDraft = removePieceFromDraft(draft, pieceTypeId);
      if (currentDrafter === 'white') {
        setWhiteDraft(newDraft);
      } else {
        setBlackDraft(newDraft);
      }
    },
    [currentDrafter, whiteDraft, blackDraft]
  );

  /**
   * Confirm the current player's draft
   */
  const confirmDraft = useCallback(() => {
    if (currentDrafter === 'white') {
      // White confirmed, show handoff for black
      setShowHandoff(true);
    } else {
      // Black confirmed, move to placement
      if (whiteDraft && blackDraft) {
        resetDraftPieceIdCounter();
        const newPlacementState = createPlacementStateFromDrafts(whiteDraft, blackDraft);
        setPlacementState(newPlacementState);
        setGameState((prev) => ({
          ...prev,
          phase: 'placement',
          currentTurn: 'white',
        }));
        setWhiteDraft(null);
        setBlackDraft(null);
      }
    }
  }, [currentDrafter, whiteDraft, blackDraft]);

  /**
   * Acknowledge handoff and start next player's draft
   */
  const acknowledgeHandoff = useCallback(() => {
    setShowHandoff(false);
    setCurrentDrafter('black');
    setBlackDraft(createEmptyDraft());
  }, []);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    gameState,
    selectedPiece,
    validMoves,
    specialCaptureTargets,
    promotionPending,
    promotionOptions,

    // Placement state
    placementState,
    piecesToPlace,
    selectedPieceToPlace,
    validPlacementSquares,
    isPlacementPhase,

    // Draft state
    isSetupPhase,
    isDraftPhase,
    showHandoff,
    currentDrafter,
    currentDraft,
    availablePieces,
    budget,

    selectSquare,
    selectPromotion,
    cancelPromotion,
    resetGame,
    resign,

    // Undo
    undoMove,
    canUndo: stateHistory.length > 0,

    // Placement actions
    selectPieceToPlace,
    placePiece,

    // Draft actions
    startDraft,
    addToDraft,
    removeFromDraft,
    confirmDraft,
    acknowledgeHandoff,

    isCheck: gameState.inCheck !== null,
    isCheckmate: result?.type === 'checkmate',
    isStalemate: result?.type === 'stalemate',
    isGameOver: result !== null,
    result,
    resultDescription: result ? getResultDescription(result) : null,
    currentTurn: gameState.currentTurn,
  };
}

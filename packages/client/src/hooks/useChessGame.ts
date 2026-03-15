/**
 * React hook for managing chess game state
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { buildAIDraft } from '../ai/aiDraft';
import type {
  GameState,
  Position,
  PieceInstance,
  PieceType,
  PlayerColor,
  GameResult,
  PlacementState,
  PlayerDraft,
} from '@hyper-fairy-chess/shared';
import {
  arePositionsEqual,
  PIECE_BY_ID,
  getPieceAt,
  initializeRoyalTracking,
  generateLegalMoves,
  getCastlingDestinations,
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
  getCheckersCaptures,
  getChameleonCaptures,
  isPromotionMove,
  getPromotionOptionsForPiece,
  getGameResult,
  getResultDescription,
  createResignationResult,
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
  createEmptyDraft,
  getAvailablePieces,
  canAddPiece,
  addPieceToDraft,
  removePieceFromDraft,
  resetDraftPieceIdCounter,
  TURN_ORDER,
  createFourPlayerGameState,
  createFourPlayerPlacementState,
} from '@hyper-fairy-chess/shared';

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
  // AI state
  isAIThinking: boolean;

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
  nextDrafter: PlayerColor;
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
  loadDraft: (draft: PlayerDraft) => void;
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
  mode: GameMode = 'standard',
  aiColor?: PlayerColor,
  playerColors?: PlayerColor[]
): UseChessGameReturn {
  const is4Player = playerColors !== undefined && playerColors.length === 4;

  // Initialize game state
  const [gameState, setGameState] = useState<GameState>(() => {
    if (mode === 'draft') {
      if (playerColors && playerColors.length === 4) {
        return { ...createFourPlayerGameState(0), phase: 'setup' as const };
      }
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

  // AI state
  const [isAIThinking, setIsAIThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  // Draft state
  const [budget, setBudget] = useState<number>(400);
  const [whiteDraft, setWhiteDraft] = useState<PlayerDraft | null>(null);
  const [blackDraft, setBlackDraft] = useState<PlayerDraft | null>(null);
  const [redDraft, setRedDraft] = useState<PlayerDraft | null>(null);
  const [blueDraft, setBlueDraft] = useState<PlayerDraft | null>(null);
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
    if (!['coordinator', 'boxer', 'withdrawal', 'thief', 'long-leap', 'checkers', 'chameleon'].includes(pieceType.captureType)) {
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
        case 'checkers':
          if (selectedPiece.position) {
            captures = getCheckersCaptures(gameState.board, selectedPiece, selectedPiece.position, move);
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
    switch (currentDrafter) {
      case 'white': return whiteDraft;
      case 'black': return blackDraft;
      case 'red': return redDraft;
      case 'blue': return blueDraft;
      default: return null;
    }
  }, [isDraftPhase, currentDrafter, whiteDraft, blackDraft, redDraft, blueDraft]);

  // Computed: next drafter (player who drafts after current one)
  const nextDrafter = useMemo((): PlayerColor => {
    if (is4Player) {
      const idx = TURN_ORDER.indexOf(currentDrafter);
      return TURN_ORDER[(idx + 1) % TURN_ORDER.length];
    }
    return currentDrafter === 'white' ? 'black' : 'white';
  }, [is4Player, currentDrafter]);

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
    const allPieces = [
      ...placementState.whitePiecesToPlace,
      ...placementState.blackPiecesToPlace,
      ...(placementState.redPiecesToPlace ?? []),
      ...(placementState.bluePiecesToPlace ?? []),
    ];
    return allPieces.find((p) => p.id === placementState.selectedPieceId) ?? null;
  }, [placementState]);

  // Computed: valid placement squares
  const validPlacementSquares = useMemo(() => {
    if (!placementState || !selectedPieceToPlace) return [];
    const zones = getPlacementZones(gameState.boardSize, placementState.currentPlacer);
    return getValidPlacementSquares(gameState.board, selectedPieceToPlace, zones, gameState.board.dimensions, gameState.boardSize);
  }, [placementState, selectedPieceToPlace, gameState.board, gameState.boardSize]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Handle square click
   */
  const selectSquare = useCallback(
    (position: Position) => {
      // Promotion pending - ignore clicks
      if (promotionPending) return;

      const clickedPiece = getPieceAt(gameState.board, position);

      // If no piece selected
      if (!selectedPiece) {
        // Select any piece (own for moving, enemy for viewing)
        if (clickedPiece) {
          setSelectedPieceId(clickedPiece.id);
        }
        return;
      }

      // Game over - allow viewing but no moves
      if (result) {
        // Can still select pieces to view their moves
        if (clickedPiece) {
          setSelectedPieceId(clickedPiece.id);
        } else {
          setSelectedPieceId(null);
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

      // If we have an enemy piece selected (viewing mode), allow switching to any piece
      if (selectedPiece.owner !== gameState.currentTurn) {
        if (clickedPiece) {
          setSelectedPieceId(clickedPiece.id);
        } else {
          setSelectedPieceId(null);
        }
        return;
      }

      // If NOT a valid move and clicking another piece, switch selection
      if (!isValidMove && clickedPiece) {
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
      if (is4Player) {
        setGameState({ ...createFourPlayerGameState(0), phase: 'setup' as const });
        setRedDraft(null);
        setBlueDraft(null);
      } else {
        setGameState({ ...createEmptyGameState('8x8'), phase: 'setup' as const });
      }
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
  }, [mode, is4Player]);

  /**
   * Undo the last move
   */
  const undoMove = useCallback(() => {
    if (stateHistory.length === 0) return;

    // In AI games, undo 2 moves (human + AI) so it's the human's turn again.
    // If the AI is still thinking, cancel it — only 1 state needs undoing.
    const stepsToUndo = aiColor ? Math.min(2, stateHistory.length) : 1;

    if (aiColor && workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setIsAIThinking(false);
    }

    const previousState = stateHistory[stateHistory.length - stepsToUndo];
    setStateHistory(prev => prev.slice(0, -stepsToUndo));
    setGameState(previousState);
    setSelectedPieceId(null);
    setPromotionPending(null);
  }, [stateHistory, aiColor]);

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
      if (!isValidPlacement(gameState.board, selectedPieceToPlace, position, zones, gameState.boardSize)) return;

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

        // Pawn swap only applies to white/black (rank-based placement)
        if (currentPlacer !== 'red' && currentPlacer !== 'blue') {
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
        } // end if (currentPlacer !== 'red' && currentPlacer !== 'blue')
      } // end if (isHerald)

      // Pawn special placement: if Herald is already on pawn rank in this file, go to back rank
      const pieceType = PIECE_BY_ID[selectedPieceToPlace.typeId];
      if (pieceType && pieceType.tier === 'pawn' && currentPlacer !== 'red' && currentPlacer !== 'blue') {
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
      const newRedPieces =
        currentPlacer === 'red'
          ? (placementState.redPiecesToPlace ?? []).filter((p) => p.id !== selectedPieceToPlace.id)
          : placementState.redPiecesToPlace;
      const newBluePieces =
        currentPlacer === 'blue'
          ? (placementState.bluePiecesToPlace ?? []).filter((p) => p.id !== selectedPieceToPlace.id)
          : placementState.bluePiecesToPlace;

      // Create updated placement state to check completion
      const updatedPlacementState: PlacementState = {
        whitePiecesToPlace: newWhitePieces,
        blackPiecesToPlace: newBlackPieces,
        redPiecesToPlace: newRedPieces,
        bluePiecesToPlace: newBluePieces,
        currentPlacer: getNextPlacer(
          { ...placementState, whitePiecesToPlace: newWhitePieces, blackPiecesToPlace: newBlackPieces, redPiecesToPlace: newRedPieces, bluePiecesToPlace: newBluePieces },
          currentPlacer
        ),
        selectedPieceId: null,
        mode: placementState.mode,
        whiteReady: placementState.whiteReady,
        blackReady: placementState.blackReady,
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
      const draft = currentDrafter === 'white' ? whiteDraft
        : currentDrafter === 'black' ? blackDraft
        : currentDrafter === 'red' ? redDraft
        : blueDraft;
      if (!draft) return;
      if (!canAddPiece(draft, pieceType, budget, gameState.boardSize)) return;

      const newDraft = addPieceToDraft(draft, pieceType);
      switch (currentDrafter) {
        case 'white': setWhiteDraft(newDraft); break;
        case 'black': setBlackDraft(newDraft); break;
        case 'red': setRedDraft(newDraft); break;
        case 'blue': setBlueDraft(newDraft); break;
      }
    },
    [currentDrafter, whiteDraft, blackDraft, redDraft, blueDraft, budget, gameState.boardSize]
  );

  /**
   * Remove a piece from the current player's draft
   */
  const removeFromDraft = useCallback(
    (pieceTypeId: string) => {
      const draft = currentDrafter === 'white' ? whiteDraft
        : currentDrafter === 'black' ? blackDraft
        : currentDrafter === 'red' ? redDraft
        : blueDraft;
      if (!draft) return;

      const newDraft = removePieceFromDraft(draft, pieceTypeId);
      switch (currentDrafter) {
        case 'white': setWhiteDraft(newDraft); break;
        case 'black': setBlackDraft(newDraft); break;
        case 'red': setRedDraft(newDraft); break;
        case 'blue': setBlueDraft(newDraft); break;
      }
    },
    [currentDrafter, whiteDraft, blackDraft, redDraft, blueDraft]
  );

  /**
   * Replace the current player's draft wholesale (used when loading a saved army)
   */
  const loadDraft = useCallback(
    (newDraft: PlayerDraft) => {
      switch (currentDrafter) {
        case 'white': setWhiteDraft(newDraft); break;
        case 'black': setBlackDraft(newDraft); break;
        case 'red': setRedDraft(newDraft); break;
        case 'blue': setBlueDraft(newDraft); break;
      }
    },
    [currentDrafter]
  );

  /**
   * Confirm the current player's draft
   */
  const confirmDraft = useCallback(() => {
    if (is4Player) {
      const draftOrder = TURN_ORDER; // white → blue → black → red
      const idx = draftOrder.indexOf(currentDrafter);
      if (idx < draftOrder.length - 1) {
        setShowHandoff(true);
      } else {
        // All 4 drafted → move to placement
        if (whiteDraft && blueDraft && blackDraft && redDraft) {
          resetDraftPieceIdCounter();
          const newPlacementState = createFourPlayerPlacementState(whiteDraft, blueDraft, blackDraft, redDraft);
          setPlacementState(newPlacementState);
          setGameState((prev) => ({
            ...prev,
            phase: 'placement',
            currentTurn: 'white',
          }));
          setWhiteDraft(null);
          setBlackDraft(null);
          setRedDraft(null);
          setBlueDraft(null);
        }
      }
      return;
    }
    // 2-player
    if (currentDrafter === 'white') {
      setShowHandoff(true);
    } else {
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
  }, [is4Player, currentDrafter, whiteDraft, blueDraft, blackDraft, redDraft]);

  /**
   * Acknowledge handoff and start next player's draft
   */
  const acknowledgeHandoff = useCallback(() => {
    setShowHandoff(false);
    if (is4Player) {
      const draftOrder = TURN_ORDER;
      const idx = draftOrder.indexOf(currentDrafter);
      const next = draftOrder[idx + 1];
      if (next) {
        setCurrentDrafter(next);
        const emptyDraft = createEmptyDraft();
        switch (next) {
          case 'blue': setBlueDraft(emptyDraft); break;
          case 'black': setBlackDraft(emptyDraft); break;
          case 'red': setRedDraft(emptyDraft); break;
        }
      }
      return;
    }
    setCurrentDrafter('black');
    setBlackDraft(createEmptyDraft());
  }, [is4Player, currentDrafter]);

  // ==========================================================================
  // AI Effects
  // ==========================================================================

  // Effect A — Auto-acknowledge handoff when AI is black
  useEffect(() => {
    if (!aiColor || !showHandoff) return;
    if (aiColor !== 'black') return;
    const t = setTimeout(() => {
      setShowHandoff(false);
      setCurrentDrafter('black');
      setBlackDraft(createEmptyDraft());
    }, 50);
    return () => clearTimeout(t);
  }, [showHandoff, aiColor]);

  // Keep a ref so the setTimeout callback always reads the latest whiteDraft
  const whiteDraftRef = useRef(whiteDraft);
  whiteDraftRef.current = whiteDraft;

  // Effect B+C — Build AI draft and immediately confirm (single step, no async import)
  useEffect(() => {
    if (!aiColor || !isDraftPhase || currentDrafter !== aiColor) return;
    // Only act once — when the draft is still empty
    const currentDraftForAI = aiColor === 'black' ? blackDraft : whiteDraft;
    if (currentDraftForAI && currentDraftForAI.selections.length > 0) return;

    const t = setTimeout(() => {
      const builtDraft = buildAIDraft(budget, gameState.boardSize);
      if (aiColor === 'white') {
        setWhiteDraft(builtDraft);
        setShowHandoff(true);
      } else {
        // Use ref so we get the latest whiteDraft even if closure is stale
        const currentWhite = whiteDraftRef.current;
        if (currentWhite) {
          resetDraftPieceIdCounter();
          const ps = createPlacementStateFromDrafts(currentWhite, builtDraft);
          setPlacementState(ps);
          setGameState((prev) => ({ ...prev, phase: 'placement', currentTurn: 'white' }));
          setWhiteDraft(null);
          setBlackDraft(null);
        }
      }
    }, 300);
    return () => clearTimeout(t);
  }, [aiColor, isDraftPhase, currentDrafter, budget, gameState.boardSize]);

  // Effect D — AI placement
  useEffect(() => {
    if (!aiColor || !isPlacementPhase || !placementState) return;
    if (placementState.currentPlacer !== aiColor) return;

    const piecesLeft = aiColor === 'white'
      ? placementState.whitePiecesToPlace
      : placementState.blackPiecesToPlace;
    if (piecesLeft.length === 0) return;

    const piece = piecesLeft[0];
    const zones = getPlacementZones(gameState.boardSize, aiColor);
    const validSquares = getValidPlacementSquares(
      gameState.board,
      piece,
      zones,
      gameState.board.dimensions,
      gameState.boardSize
    );
    if (validSquares.length === 0) return;

    // Pick center-most square
    const files = gameState.board.dimensions.files;
    const ranks = gameState.board.dimensions.ranks;
    const centerFile = (files - 1) / 2;
    const centerRank = (ranks - 1) / 2;

    const best = validSquares.reduce((a, b) => {
      const da = Math.abs(a.file.charCodeAt(0) - 'a'.charCodeAt(0) - centerFile)
        + Math.abs(a.rank - 1 - centerRank);
      const db = Math.abs(b.file.charCodeAt(0) - 'a'.charCodeAt(0) - centerFile)
        + Math.abs(b.rank - 1 - centerRank);
      return da <= db ? a : b;
    });

    const t = setTimeout(() => {
      // Inline placement logic (mirrors placePiece callback)
      const currentPlacer = aiColor;
      let actualPosition = best;

      let pawnToMove: PieceInstance | null = null;
      let pawnNewPosition: import('@hyper-fairy-chess/shared').Position | null = null;

      if (isHerald(piece)) {
        actualPosition = getHeraldActualPosition(best, currentPlacer, gameState.board.dimensions);
        const pawnRank = currentPlacer === 'white' ? 2 : (gameState.board.dimensions.ranks - 1);
        const existingId = gameState.board.positionMap.get(`${actualPosition.file}${pawnRank}`);
        if (existingId) {
          const existing = gameState.board.pieces.find((p) => p.id === existingId);
          if (existing) {
            const et = PIECE_BY_ID[existing.typeId];
            if (et?.tier === 'pawn' && existing.owner === currentPlacer) {
              pawnToMove = existing;
              pawnNewPosition = getPawnSwapPosition(actualPosition.file, currentPlacer, gameState.board.dimensions);
            }
          }
        }
      }

      const pt = PIECE_BY_ID[piece.typeId];
      if (pt?.tier === 'pawn') {
        if (shouldPawnSwapToBackRank(gameState.board, best.file, currentPlacer, gameState.board.dimensions)) {
          actualPosition = getPawnSwapPosition(best.file, currentPlacer, gameState.board.dimensions);
        }
      }

      const placedPiece: PieceInstance = { ...piece, position: actualPosition };
      let newPieces = [...gameState.board.pieces, placedPiece];
      const newPositionMap = new Map(gameState.board.positionMap);

      if (pawnToMove && pawnNewPosition) {
        newPieces = newPieces.map((p) =>
          p.id === pawnToMove!.id ? { ...p, position: pawnNewPosition } : p
        );
        newPositionMap.delete(`${pawnToMove.position!.file}${pawnToMove.position!.rank}`);
        newPositionMap.set(`${pawnNewPosition.file}${pawnNewPosition.rank}`, pawnToMove.id);
      }
      newPositionMap.set(`${actualPosition.file}${actualPosition.rank}`, placedPiece.id);

      const newWhitePieces = currentPlacer === 'white'
        ? placementState.whitePiecesToPlace.filter((p) => p.id !== piece.id)
        : placementState.whitePiecesToPlace;
      const newBlackPieces = currentPlacer === 'black'
        ? placementState.blackPiecesToPlace.filter((p) => p.id !== piece.id)
        : placementState.blackPiecesToPlace;

      const updatedPS: PlacementState = {
        whitePiecesToPlace: newWhitePieces,
        blackPiecesToPlace: newBlackPieces,
        currentPlacer: getNextPlacer(
          { ...placementState, whitePiecesToPlace: newWhitePieces, blackPiecesToPlace: newBlackPieces },
          currentPlacer
        ),
        selectedPieceId: null,
        mode: placementState.mode,
        whiteReady: placementState.whiteReady,
        blackReady: placementState.blackReady,
      };

      const placementComplete = isPlacementComplete(updatedPS);

      setGameState((prev) => {
        let newBoard = {
          ...prev.board,
          pieces: newPieces,
          positionMap: newPositionMap,
        };
        if (placementComplete) {
          newBoard = initializeRoyalTracking(newBoard);
        }
        return {
          ...prev,
          board: newBoard,
          phase: placementComplete ? 'play' : 'placement',
          currentTurn: placementComplete ? 'white' : updatedPS.currentPlacer,
        };
      });

      setPlacementState(placementComplete ? null : updatedPS);
    }, 80);

    return () => clearTimeout(t);
  }, [aiColor, isPlacementPhase, placementState, gameState]);

  // Effect E — AI play moves
  useEffect(() => {
    if (!aiColor || gameState.phase !== 'play') return;
    if (gameState.currentTurn !== aiColor) return;

    const currentResult = getGameResult(gameState);
    if (currentResult) return;

    setIsAIThinking(true);

    const worker = new Worker(
      new URL('../ai/aiWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.postMessage({ gameState, color: aiColor, depth: 3 });

    worker.onmessage = (e: MessageEvent) => {
      const aiMove = e.data as { pieceId: string; from: import('@hyper-fairy-chess/shared').Position; to: import('@hyper-fairy-chess/shared').Position; promotionPieceId?: string } | null;
      if (aiMove) {
        setGameState((prev) => {
          const piece = prev.board.pieces.find((p) => p.id === aiMove.pieceId);
          if (!piece) return prev;
          const move = prepareMoveFromPositions(prev, piece, aiMove.from, aiMove.to, aiMove.promotionPieceId);
          if (!move) return prev;
          setStateHistory((h) => [...h, prev]);
          return executeMove(prev, move);
        });
      }
      worker.terminate();
      workerRef.current = null;
      setIsAIThinking(false);
    };

    worker.onerror = () => {
      worker.terminate();
      workerRef.current = null;
      setIsAIThinking(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [aiColor, gameState.currentTurn, gameState.phase]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    isAIThinking,
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
    nextDrafter,
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
    loadDraft,
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

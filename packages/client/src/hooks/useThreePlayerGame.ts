/**
 * Hook for 3-player GreenChess game state management.
 */

import { useState, useCallback } from 'react';
import type { PieceType, PlayerDraft, BoardSize } from '@hyper-fairy-chess/shared';
import {
  createEmptyDraft,
  getAvailablePieces,
  canAddPiece,
  addPieceToDraft,
  removePieceFromDraft,
  validateDraft,
  hasKingReplacer,
} from '@hyper-fairy-chess/shared';
import type {
  ThreeGameState,
  ThreeGamePhase,
  ThreePiece,
  ThreePos,
  Section,
  ThreePlacementState,
} from '@hyper-fairy-chess/shared';
import {
  createThreePlayerGameState,
  executeThreeMove,
  getThreeLegalMoves,
  isInThreeCheck,
  getValidThreePlacementSquares,
  isThreePlacementComplete,
  isValidThreePlacement,
  threeposKey,
  threeposEqual,
  THREE_SECTIONS,
} from '@hyper-fairy-chess/shared';

// 3-player uses the 8x8 slot limits (8 pawns, 6 pieces, 2 royalty)
const THREE_BOARD_SIZE: BoardSize = '8x8';

// Turn order for drafting
const DRAFT_ORDER: Section[] = ['white', 'red', 'black'];

let threeIdCounter = 0;

function createThreePiecesFromDraft(draft: PlayerDraft, owner: Section): ThreePiece[] {
  const pieces: ThreePiece[] = [];

  // Auto-add King if no king-replacer
  if (!hasKingReplacer(draft)) {
    pieces.push({
      id: `${owner}_king_${threeIdCounter++}`,
      owner,
      typeId: 'king',
      position: { section: owner, sfile: 1, srank: 1 }, // temp; will be placed
      hasMoved: false,
    });
  }

  for (const selection of draft.selections) {
    for (let i = 0; i < selection.count; i++) {
      pieces.push({
        id: `${owner}_${selection.pieceTypeId}_${threeIdCounter++}`,
        owner,
        typeId: selection.pieceTypeId,
        position: { section: owner, sfile: 1, srank: 1 }, // temp
        hasMoved: false,
      });
    }
  }

  return pieces;
}

export interface UseThreePlayerGameReturn {
  gameState: ThreeGameState;
  phase: ThreeGamePhase;

  // Draft
  currentDrafter: Section;
  currentDraft: PlayerDraft;
  showHandoff: boolean;
  nextDrafter: Section | null;
  availablePieces: PieceType[];
  addToDraft: (piece: PieceType) => void;
  removeFromDraft: (pieceTypeId: string) => void;
  confirmDraft: () => void;
  acknowledgeHandoff: () => void;

  // Placement
  placementState: ThreePlacementState | null;
  selectedPos: ThreePos | null;
  selectedPieceToPlace: ThreePiece | null;
  validMoves: ThreePos[];
  validPlacementSquares: ThreePos[];
  selectPieceToPlace: (piece: ThreePiece) => void;

  // Play
  inCheck: Section | null;

  handleSquareClick: (pos: ThreePos) => void;
  resetGame: () => void;

  startGame: (budget: number) => void;
}

export function useThreePlayerGame(initialBudget = 405): UseThreePlayerGameReturn {
  const [gameState, setGameState] = useState<ThreeGameState>(() =>
    createThreePlayerGameState(initialBudget),
  );
  const [budget, setBudget] = useState(initialBudget);

  // Draft state per player
  const [drafts, setDrafts] = useState<Record<Section, PlayerDraft>>({
    white: createEmptyDraft(),
    red: createEmptyDraft(),
    black: createEmptyDraft(),
  });
  const [draftIndex, setDraftIndex] = useState(0); // index into DRAFT_ORDER
  const [showHandoff, setShowHandoff] = useState(false);
  const [pendingNextDraftIndex, setPendingNextDraftIndex] = useState<number | null>(null);

  // Placement state
  const [placementState, setPlacementState] = useState<ThreePlacementState | null>(null);

  // Selection state
  const [selectedPos, setSelectedPos] = useState<ThreePos | null>(null);
  const [selectedPieceToPlace, setSelectedPieceToPlace] = useState<ThreePiece | null>(null);
  const [validMoves, setValidMoves] = useState<ThreePos[]>([]);
  const [validPlacementSquares, setValidPlacementSquares] = useState<ThreePos[]>([]);
  const [inCheck, setInCheck] = useState<Section | null>(null);

  const currentDrafter = DRAFT_ORDER[draftIndex];
  const currentDraft = drafts[currentDrafter];
  const nextDrafter = pendingNextDraftIndex !== null ? DRAFT_ORDER[pendingNextDraftIndex] : null;

  const startGame = useCallback((newBudget: number) => {
    setBudget(newBudget);
    threeIdCounter = 0;
    setGameState({ ...createThreePlayerGameState(newBudget), phase: 'draft' });
    setDrafts({ white: createEmptyDraft(), red: createEmptyDraft(), black: createEmptyDraft() });
    setDraftIndex(0);
    setShowHandoff(false);
    setPendingNextDraftIndex(null);
    setPlacementState(null);
    setSelectedPos(null);
    setSelectedPieceToPlace(null);
    setValidMoves([]);
    setValidPlacementSquares([]);
  }, []);

  const addToDraft = useCallback(
    (piece: PieceType) => {
      if (!canAddPiece(currentDraft, piece, budget, THREE_BOARD_SIZE)) return;
      setDrafts((prev) => ({
        ...prev,
        [currentDrafter]: addPieceToDraft(prev[currentDrafter], piece),
      }));
    },
    [currentDraft, currentDrafter, budget],
  );

  const removeFromDraft = useCallback(
    (pieceTypeId: string) => {
      setDrafts((prev) => ({
        ...prev,
        [currentDrafter]: removePieceFromDraft(prev[currentDrafter], pieceTypeId),
      }));
    },
    [currentDrafter],
  );

  const confirmDraft = useCallback(() => {
    const validation = validateDraft(currentDraft, budget, THREE_BOARD_SIZE);
    if (!validation.valid) return;

    const nextIndex = draftIndex + 1;
    if (nextIndex < DRAFT_ORDER.length) {
      // More players to draft — show handoff
      setPendingNextDraftIndex(nextIndex);
      setShowHandoff(true);
    } else {
      // All players drafted — move to placement
      transitionToPlacement();
    }
  }, [currentDraft, draftIndex, budget, drafts]);

  const acknowledgeHandoff = useCallback(() => {
    if (pendingNextDraftIndex === null) return;
    setDraftIndex(pendingNextDraftIndex);
    setShowHandoff(false);
    setPendingNextDraftIndex(null);
    setGameState((prev) => ({ ...prev, phase: 'draft' }));
  }, [pendingNextDraftIndex]);

  const transitionToPlacement = useCallback(() => {
    // Build all pieces for all players
    const whitePieces = createThreePiecesFromDraft(drafts.white, 'white');
    const redPieces = createThreePiecesFromDraft(drafts.red, 'red');
    const blackPieces = createThreePiecesFromDraft(drafts.black, 'black');

    const newPlacementState: ThreePlacementState = {
      whitePiecesToPlace: whitePieces,
      redPiecesToPlace: redPieces,
      blackPiecesToPlace: blackPieces,
      currentPlacer: 'white',
      selectedPieceId: null,
    };

    setPlacementState(newPlacementState);
    // Add unplaced pieces to game state board (with dummy positions — placement will update)
    const allPieces = [...whitePieces, ...redPieces, ...blackPieces];
    setGameState((prev) => ({
      ...prev,
      phase: 'placement',
      board: {
        ...prev.board,
        pieces: allPieces,
        positionMap: new Map(),
      },
    }));
  }, [drafts]);

  // Handle placement: select piece from list, then click board square
  const handlePlacementClick = useCallback(
    (pos: ThreePos, ps: ThreePlacementState, gs: ThreeGameState) => {
      const placer = ps.currentPlacer;

      // If a piece is already selected, try to place it
      if (selectedPieceToPlace && selectedPieceToPlace.owner === placer) {
        if (isValidThreePlacement(selectedPieceToPlace, pos, gs)) {
          // Place the piece: update positionMap in gameState
          const newMap = new Map(gs.board.positionMap);
          const placed: ThreePiece = { ...selectedPieceToPlace, position: pos, hasMoved: false };
          newMap.set(threeposKey(pos), placed);

          const newPieces = gs.board.pieces.map((p) =>
            p.id === selectedPieceToPlace.id ? placed : p,
          );

          const newGs: ThreeGameState = {
            ...gs,
            board: { ...gs.board, pieces: newPieces, positionMap: newMap },
          };

          // Remove from placement list
          const newPs = removePlacedPiece(ps, selectedPieceToPlace.id);

          setGameState(newGs);
          setSelectedPieceToPlace(null);
          setValidPlacementSquares([]);

          // Advance placer if all current placer's pieces are placed
          const remaining = getUnplacedPiecesForSection(newPs, placer);
          if (remaining.length === 0) {
            // Advance to next player or start game
            const nextPlacer = advancePlacer(placer, newPs);
            if (nextPlacer === null || isThreePlacementComplete(newPs)) {
              // All placed — start game
              setPlacementState({ ...newPs, currentPlacer: placer });
              setGameState({ ...newGs, phase: 'play' });
              return;
            }
            setPlacementState({ ...newPs, currentPlacer: nextPlacer });
          } else {
            setPlacementState(newPs);
          }
          return;
        }
      }

      // Otherwise, check if the clicked square has a piece to select (clicking board to see piece)
      // For placement, we primarily select from a panel — but clicking an unplaced piece slot works too
      setSelectedPieceToPlace(null);
      setValidPlacementSquares([]);
    },
    [selectedPieceToPlace],
  );

  const selectPieceToPlace = useCallback(
    (piece: ThreePiece) => {
      setGameState((gs) => {
        if (!placementState) return gs;
        if (piece.owner !== placementState.currentPlacer) return gs;
        const squares = getValidThreePlacementSquares(piece, gs);
        setSelectedPieceToPlace(piece);
        setValidPlacementSquares(squares);
        setSelectedPos(null);
        setValidMoves([]);
        return gs;
      });
    },
    [placementState],
  );

  // Handle play: select piece then select destination
  const handlePlayClick = useCallback(
    (pos: ThreePos, gs: ThreeGameState) => {
      const clickedPiece = gs.board.positionMap.get(threeposKey(pos)) ?? null;

      if (selectedPos && threeposEqual(pos, selectedPos)) {
        // Deselect
        setSelectedPos(null);
        setValidMoves([]);
        return;
      }

      if (selectedPos) {
        // Try to execute a move
        if (validMoves.some((m) => threeposEqual(m, pos))) {
          const newGs = executeThreeMove(gs, selectedPos, pos);
          setGameState(newGs);
          setSelectedPos(null);
          setValidMoves([]);

          // Update check state
          const checkedSection = THREE_SECTIONS.find((s) => isInThreeCheck(newGs, s)) ?? null;
          setInCheck(checkedSection);
          return;
        }
      }

      // Select a piece
      if (clickedPiece && clickedPiece.owner === gs.board.currentTurn) {
        const moves = getThreeLegalMoves(gs, clickedPiece.id);
        setSelectedPos(pos);
        setValidMoves(moves);
      } else {
        setSelectedPos(null);
        setValidMoves([]);
      }
    },
    [selectedPos, validMoves],
  );

  const handleSquareClick = useCallback(
    (pos: ThreePos) => {
      if (gameState.phase === 'placement' && placementState) {
        handlePlacementClick(pos, placementState, gameState);
      } else if (gameState.phase === 'play') {
        handlePlayClick(pos, gameState);
      }
    },
    [gameState, placementState, handlePlacementClick, handlePlayClick],
  );

  const resetGame = useCallback(() => {
    threeIdCounter = 0;
    setGameState(createThreePlayerGameState(budget));
    setDrafts({ white: createEmptyDraft(), red: createEmptyDraft(), black: createEmptyDraft() });
    setDraftIndex(0);
    setShowHandoff(false);
    setPendingNextDraftIndex(null);
    setPlacementState(null);
    setSelectedPos(null);
    setSelectedPieceToPlace(null);
    setValidMoves([]);
    setValidPlacementSquares([]);
    setInCheck(null);
  }, [budget]);

  return {
    gameState,
    phase: gameState.phase,
    currentDrafter,
    currentDraft,
    showHandoff,
    nextDrafter,
    availablePieces: getAvailablePieces(),
    addToDraft,
    removeFromDraft,
    confirmDraft,
    acknowledgeHandoff,
    placementState,
    selectedPos,
    selectedPieceToPlace,
    validMoves,
    validPlacementSquares,
    selectPieceToPlace,
    inCheck,
    handleSquareClick,
    resetGame,
    startGame,
  };
}

// Helper: get unplaced pieces for a section from placement state
function getUnplacedPiecesForSection(ps: ThreePlacementState, section: Section): ThreePiece[] {
  switch (section) {
    case 'white': return ps.whitePiecesToPlace;
    case 'red': return ps.redPiecesToPlace;
    case 'black': return ps.blackPiecesToPlace;
  }
}

// Helper: remove a piece from the placement lists
function removePlacedPiece(ps: ThreePlacementState, pieceId: string): ThreePlacementState {
  return {
    ...ps,
    whitePiecesToPlace: ps.whitePiecesToPlace.filter((p) => p.id !== pieceId),
    redPiecesToPlace: ps.redPiecesToPlace.filter((p) => p.id !== pieceId),
    blackPiecesToPlace: ps.blackPiecesToPlace.filter((p) => p.id !== pieceId),
  };
}

// Helper: find the next section that still has pieces to place
function advancePlacer(current: Section, ps: ThreePlacementState): Section | null {
  const idx = THREE_SECTIONS.indexOf(current);
  for (let i = 1; i <= THREE_SECTIONS.length; i++) {
    const next = THREE_SECTIONS[(idx + i) % THREE_SECTIONS.length];
    if (getUnplacedPiecesForSection(ps, next).length > 0) {
      return next;
    }
  }
  return null;
}

// Re-export for external use
export { getValidThreePlacementSquares };

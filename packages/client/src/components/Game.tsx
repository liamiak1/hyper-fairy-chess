/**
 * Main game component - connects Board with game logic
 */

import { useState, useCallback, useEffect } from 'react';
import { useChessGame } from '../hooks/useChessGame';
import type { GameMode } from '../hooks/useChessGame';
import type { Position, PlayerColor, PieceType } from '../game/types';
import { PIECE_BY_ID } from '../game/pieces/pieceDefinitions';
import { Board } from './Board';
import { GameInfo } from './GameInfo';
import { PromotionDialog } from './PromotionDialog';
import { PlacementUI } from './PlacementUI';
import { SetupScreen } from './SetupScreen';
import { DraftUI } from './DraftUI';
import { HandoffScreen } from './HandoffScreen';
import { PieceInfoPopup } from './PieceInfoPopup';
import './Game.css';

interface GameProps {
  mode?: GameMode;
}

interface PieceInfoState {
  pieceType: PieceType;
  color: PlayerColor;
  x: number;
  y: number;
}

export function Game({ mode = 'draft' }: GameProps) {
  const [hoveredMove, setHoveredMove] = useState<Position | null>(null);
  const [pieceInfo, setPieceInfo] = useState<PieceInfoState | null>(null);

  // Close popup on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pieceInfo) {
        setPieceInfo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pieceInfo]);

  const handlePieceRightClick = useCallback((pieceTypeId: string, color: PlayerColor, x: number, y: number) => {
    const pieceType = PIECE_BY_ID[pieceTypeId];
    if (pieceType) {
      setPieceInfo({ pieceType, color, x, y });
    }
  }, []);

  const {
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
    undoMove,
    canUndo,

    // Placement actions
    selectPieceToPlace,
    placePiece,

    // Draft actions
    startDraft,
    addToDraft,
    removeFromDraft,
    confirmDraft,
    acknowledgeHandoff,

    isCheck,
    isGameOver,
    resultDescription,
    currentTurn,
  } = useChessGame(mode);

  // Handle board click - different behavior for placement vs play
  const handleSquareClick = (position: { file: string; rank: number }) => {
    if (isPlacementPhase) {
      placePiece(position as any);
    } else {
      selectSquare(position as any);
    }
  };

  // Setup phase - budget selection
  if (isSetupPhase) {
    return <SetupScreen onStartGame={startDraft} />;
  }

  // Draft phase - show handoff screen between players
  if (showHandoff) {
    return <HandoffScreen nextPlayer="black" onReady={acknowledgeHandoff} />;
  }

  // Draft phase - piece selection
  if (isDraftPhase && currentDraft) {
    return (
      <DraftUI
        availablePieces={availablePieces}
        currentDraft={currentDraft}
        budget={budget}
        boardSize={gameState.boardSize}
        playerColor={currentDrafter}
        onAddPiece={addToDraft}
        onRemovePiece={removeFromDraft}
        onConfirmDraft={confirmDraft}
      />
    );
  }

  // Placement and Play phases
  return (
    <div className="game-container">
      <h1 className="game-title">Hyper Fairy Chess</h1>

      {!isPlacementPhase && (
        <GameInfo
          currentTurn={currentTurn}
          isCheck={isCheck}
          isGameOver={isGameOver}
          resultDescription={resultDescription}
          moveCount={gameState.moveHistory.length}
        />
      )}

      <div className="game-main">
        <div className="board-wrapper">
          <Board
            size={gameState.boardSize}
            pieces={gameState.board.pieces}
            selectedSquare={isPlacementPhase ? null : (selectedPiece?.position ?? null)}
            validMoves={isPlacementPhase ? [] : validMoves}
            onSquareClick={handleSquareClick}
            lastMove={
              gameState.moveHistory.length > 0
                ? gameState.moveHistory[gameState.moveHistory.length - 1]
                : null
            }
            validPlacementSquares={validPlacementSquares}
            isPlacementMode={isPlacementPhase}
            specialCaptureTargets={isPlacementPhase ? [] : specialCaptureTargets}
            hoveredMove={hoveredMove}
            onSquareHover={isPlacementPhase ? undefined : setHoveredMove}
            currentTurn={gameState.currentTurn}
            onPieceRightClick={handlePieceRightClick}
          />
        </div>

        {isPlacementPhase && placementState && (
          <PlacementUI
            piecesToPlace={piecesToPlace}
            selectedPiece={selectedPieceToPlace}
            onSelectPiece={selectPieceToPlace}
            currentPlacer={placementState.currentPlacer}
            whitePiecesRemaining={placementState.whitePiecesToPlace.length}
            blackPiecesRemaining={placementState.blackPiecesToPlace.length}
          />
        )}
      </div>

      {promotionPending && (
        <PromotionDialog
          options={promotionOptions}
          color={promotionPending.piece.owner}
          onSelect={selectPromotion}
          onCancel={cancelPromotion}
        />
      )}

      {pieceInfo && (
        <PieceInfoPopup
          pieceType={pieceInfo.pieceType}
          color={pieceInfo.color}
          x={pieceInfo.x}
          y={pieceInfo.y}
          onClose={() => setPieceInfo(null)}
        />
      )}

      <div className="game-controls">
        <button className="btn btn-secondary" onClick={resetGame}>
          New Game
        </button>
        {!isGameOver && !isPlacementPhase && canUndo && (
          <button className="btn btn-secondary" onClick={undoMove}>
            Undo
          </button>
        )}
        {!isGameOver && !isPlacementPhase && (
          <button
            className="btn btn-danger"
            onClick={() => resign(currentTurn)}
          >
            Resign
          </button>
        )}
      </div>

      {gameState.moveHistory.length > 0 && (
        <div className="move-history">
          <h3>Moves</h3>
          <div className="moves-list">
            {gameState.moveHistory.map((move, i) => (
              <span key={i} className="move">
                {i % 2 === 0 && <span className="move-number">{Math.floor(i / 2) + 1}.</span>}
                {move.notation}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

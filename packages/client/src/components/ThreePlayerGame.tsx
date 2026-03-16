/**
 * Top-level component for 3-player GreenChess mode.
 */

import { useCallback } from 'react';
import type { PlayerColor, PieceType, BoardSize } from '@hyper-fairy-chess/shared';
import { PIECE_BY_ID } from '@hyper-fairy-chess/shared';
import type { ThreePiece } from '@hyper-fairy-chess/shared';
import { useThreePlayerGame } from '../hooks/useThreePlayerGame';
import { SetupScreen } from './SetupScreen';
import { DraftUI } from './DraftUI';
import { HandoffScreen } from './HandoffScreen';
import { BoardThreePlayer } from './BoardThreePlayer';
import { ThreePlacementUI } from './ThreePlacementUI';
import { PieceInfoPopup } from './PieceInfoPopup';
import './ThreePlayerGame.css';

import { useState } from 'react';

interface PieceInfoState {
  pieceType: PieceType;
  color: PlayerColor;
  x: number;
  y: number;
}

const THREE_BOARD_SIZE: BoardSize = '8x8';

// Map section to PlayerColor for DraftUI compatibility
const SECTION_TO_COLOR: Record<string, PlayerColor> = {
  white: 'white',
  red: 'red',
  black: 'black',
};

interface ThreePlayerGameProps {
  onBack?: () => void;
}

export function ThreePlayerGame({ onBack }: ThreePlayerGameProps) {
  const game = useThreePlayerGame(405);
  const [pieceInfo, setPieceInfo] = useState<PieceInfoState | null>(null);

  const handlePieceRightClick = useCallback((piece: ThreePiece, x: number, y: number) => {
    const pt = PIECE_BY_ID[piece.typeId];
    if (pt) {
      setPieceInfo({ pieceType: pt, color: SECTION_TO_COLOR[piece.owner] ?? 'white', x, y });
    }
  }, []);


  if (game.phase === 'setup') {
    return (
      <div className="three-player-game">
        <SetupScreen onStartGame={game.startGame} />
      </div>
    );
  }

  if (game.phase === 'draft') {
    if (game.showHandoff && game.nextDrafter) {
      return (
        <div className="three-player-game">
          <HandoffScreen
            nextPlayer={SECTION_TO_COLOR[game.nextDrafter]}
            onReady={game.acknowledgeHandoff}
          />
        </div>
      );
    }

    return (
      <div className="three-player-game">
        <DraftUI
          availablePieces={game.availablePieces}
          currentDraft={game.currentDraft}
          budget={game.gameState.pointBudget}
          boardSize={THREE_BOARD_SIZE}
          playerColor={SECTION_TO_COLOR[game.currentDrafter]}
          onAddPiece={game.addToDraft}
          onRemovePiece={game.removeFromDraft}
          onLoadArmy={() => {}} // not supported in 3-player for now
          onConfirmDraft={game.confirmDraft}
        />
      </div>
    );
  }

  if (game.phase === 'placement' && game.placementState) {
    // Show handoff screen when switching placement turns
    if (game.showPlacementHandoff && game.nextPlacer) {
      return (
        <div className="three-player-game">
          <HandoffScreen
            nextPlayer={SECTION_TO_COLOR[game.nextPlacer]}
            onReady={game.acknowledgePlacementHandoff}
          />
        </div>
      );
    }

    return (
      <div className="three-player-game">
        <div className="three-player-layout">
          <BoardThreePlayer
            state={game.gameState}
            selectedPos={game.selectedPos}
            validMoves={game.validMoves}
            validPlacementSquares={game.validPlacementSquares}
            isPlacementMode={true}
            onSquareClick={game.handleSquareClick}
            onPieceRightClick={handlePieceRightClick}
          />
          <ThreePlacementUI
            placementState={game.placementState}
            selectedPiece={game.selectedPieceToPlace}
            onSelectPiece={game.selectPieceToPlace}
          />
        </div>
        {pieceInfo && (
          <PieceInfoPopup
            pieceType={pieceInfo.pieceType}
            color={pieceInfo.color}
            x={pieceInfo.x}
            y={pieceInfo.y}
            onClose={() => setPieceInfo(null)}
          />
        )}
      </div>
    );
  }

  if (game.phase === 'play') {
    const currentSection = game.gameState.board.currentTurn;
    const colorMap: Record<string, string> = { white: 'White', red: 'Red', black: 'Black' };
    const inCheck = game.inCheck;

    return (
      <div className="three-player-game">
        <div className="three-player-layout">
          <div className="three-board-area">
            <div className="three-turn-info">
              <span className={`turn-indicator ${currentSection}`}>
                {colorMap[currentSection]}'s turn
              </span>
              {inCheck && (
                <span className="check-indicator">
                  {colorMap[inCheck]} is in check!
                </span>
              )}
            </div>
            <BoardThreePlayer
              state={game.gameState}
              selectedPos={game.selectedPos}
              validMoves={game.validMoves}
              validPlacementSquares={[]}
              isPlacementMode={false}
              onSquareClick={game.handleSquareClick}
              onPieceRightClick={handlePieceRightClick}
            />
          </div>
        </div>
        {pieceInfo && (
          <PieceInfoPopup
            pieceType={pieceInfo.pieceType}
            color={pieceInfo.color}
            x={pieceInfo.x}
            y={pieceInfo.y}
            onClose={() => setPieceInfo(null)}
          />
        )}
      </div>
    );
  }

  if (game.phase === 'ended') {
    const result = game.gameState.result;
    const winnerName = result?.winner
      ? { white: 'White', red: 'Red', black: 'Black' }[result.winner]
      : null;

    return (
      <div className="three-player-game">
        <div className="game-result-screen">
          <h1>{winnerName ? `${winnerName} wins!` : 'Draw'}</h1>
          <p>{result?.reason ?? ''}</p>
          <button className="start-btn" onClick={game.resetGame}>
            Play Again
          </button>
          {onBack && (
            <button className="back-btn" onClick={onBack}>
              Main Menu
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

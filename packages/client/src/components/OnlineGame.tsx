/**
 * Online Game Component
 * Orchestrates the multiplayer game flow
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useOnlineGame } from '../hooks/useOnlineGame';
import type { Position, PlayerColor, PieceType, PieceInstance, GameResult } from '@hyper-fairy-chess/shared';

interface SpecialCaptureTarget {
  position: Position;
  movePosition: Position; // The move that causes this capture
}
import {
  BOARD_CONFIGS,
  getPlacementZones,
  getValidPlacementSquares,
  generateLegalMoves,
  isPromotionMove,
  getPromotionOptionsForPiece,
  isNearFiftyMoveRule,
  isNearThreefoldRepetition,
  getCoordinatorCaptures,
  getBoxerCaptures,
  getWithdrawerCapture,
  getThiefCapture,
  getLongLeaperCaptures,
  getCheckersCaptures,
  getChameleonCaptures,
  PIECE_BY_ID,
} from '@hyper-fairy-chess/shared';
import { OnlineLobby } from './OnlineLobby';
import { WaitingRoom } from './WaitingRoom';
import { OnlineDraftUI } from './OnlineDraftUI';
import { Board } from './Board';
import { GameInfo } from './GameInfo';
import { PromotionDialog } from './PromotionDialog';
import { PlacementUI } from './PlacementUI';
import { BlindPlacementUI } from './BlindPlacementUI';
import { OpponentPiecesPanel } from './OpponentPiecesPanel';
import { PieceInfoPopup } from './PieceInfoPopup';
import './OnlineGame.css';

interface OnlineGameProps {
  onBack: () => void;
}

interface PieceInfoState {
  pieceType: PieceType;
  color: PlayerColor;
  x: number;
  y: number;
}

interface PromotionPendingState {
  from: Position;
  to: Position;
  options: PieceType[];
}

function getResultDescription(result: GameResult): string {
  const winner = result.winner === 'white' ? 'White' : result.winner === 'black' ? 'Black' : null;
  switch (result.type) {
    case 'checkmate':
      return `Checkmate! ${winner} wins.`;
    case 'resignation':
      return `${winner} wins by resignation.`;
    case 'timeout':
      return `${winner} wins on time.`;
    case 'stalemate':
      return result.winner
        ? `Stalemate! ${winner} wins by VP (${result.whiteVP} - ${result.blackVP}).`
        : `Stalemate! Draw (VP tie: ${result.whiteVP} - ${result.blackVP}).`;
    case 'draw-agreement':
      return 'Draw by agreement.';
    case 'draw-vp-tie':
      return `Draw by VP tie (${result.whiteVP} - ${result.blackVP}).`;
    case 'draw-fifty-move':
      return 'Draw by fifty-move rule.';
    case 'draw-repetition':
      return 'Draw by threefold repetition.';
    default:
      return 'Game over.';
  }
}

export function OnlineGame({ onBack }: OnlineGameProps) {
  const { state, actions } = useOnlineGame();
  const [pieceInfo, setPieceInfo] = useState<PieceInfoState | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Position | null>(null);
  const [selectedPieceToPlace, setSelectedPieceToPlace] = useState<PieceInstance | null>(null);
  const [promotionPending, setPromotionPending] = useState<PromotionPendingState | null>(null);
  const [hoveredMove, setHoveredMove] = useState<Position | null>(null);

  // Close popup on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pieceInfo) setPieceInfo(null);
        if (promotionPending) setPromotionPending(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pieceInfo, promotionPending]);

  // No automatic reconnection - user must explicitly click "Rejoin Game"

  const handlePieceRightClick = useCallback((pieceTypeId: string, color: PlayerColor, x: number, y: number) => {
    const pieceType = PIECE_BY_ID[pieceTypeId];
    if (pieceType) {
      setPieceInfo({ pieceType, color, x, y });
    }
  }, []);

  // These useMemo hooks must be called unconditionally (React rules of hooks)
  // They handle null gameState gracefully

  // Reconstruct board with proper positionMap (Maps don't survive JSON serialization)
  const board = useMemo(() => {
    if (!state.gameState?.board?.pieces) return null;
    const positionMap = new Map<string, string>();
    for (const piece of state.gameState.board.pieces) {
      if (piece.position) {
        positionMap.set(`${piece.position.file}${piece.position.rank}`, piece.id);
      }
    }
    return {
      ...state.gameState.board,
      positionMap,
    };
  }, [state.gameState?.board]);

  // Find selected piece (for playing phase)
  const isPlayingPhase = (state.phase === 'playing' || state.phase === 'ended') && state.gameState;

  // Find selected piece (for playing phase) - can be own or enemy piece for viewing
  const selectedPieceForGame = useMemo(() => {
    if (!selectedSquare || !isPlayingPhase || !state.gameState?.board?.pieces) return null;
    return state.gameState.board.pieces.find(
      p => p.position && p.position.file === selectedSquare.file &&
           p.position.rank === selectedSquare.rank
    ) || null;
  }, [selectedSquare, isPlayingPhase, state.gameState?.board?.pieces]);

  // Calculate valid moves for selected piece
  const validMovesForGame = useMemo(() => {
    if (!selectedPieceForGame || !board || !state.gameState) return [];
    try {
      return generateLegalMoves(board, selectedPieceForGame, state.gameState.enPassantTarget);
    } catch (err) {
      console.error('Error calculating valid moves:', err);
      return [];
    }
  }, [selectedPieceForGame, board, state.gameState?.enPassantTarget]);

  // Calculate special capture targets for selected piece (withdrawer, coordinator, etc.)
  const specialCaptureTargetsForGame = useMemo((): SpecialCaptureTarget[] => {
    if (!selectedPieceForGame || validMovesForGame.length === 0 || !board) return [];

    const pieceType = PIECE_BY_ID[selectedPieceForGame.typeId];
    if (!pieceType) return [];

    const targets: SpecialCaptureTarget[] = [];

    // Only calculate for pieces with special capture types
    if (!['coordinator', 'boxer', 'withdrawal', 'thief', 'long-leap', 'checkers', 'chameleon'].includes(pieceType.captureType)) {
      return [];
    }

    for (const move of validMovesForGame) {
      let captures: { pieceId: string; position: Position }[] = [];

      switch (pieceType.captureType) {
        case 'coordinator':
          captures = getCoordinatorCaptures(board, selectedPieceForGame.owner, move);
          break;
        case 'boxer':
          captures = getBoxerCaptures(board, selectedPieceForGame.owner, move);
          break;
        case 'withdrawal':
          if (selectedPieceForGame.position) {
            const capture = getWithdrawerCapture(board, selectedPieceForGame.owner, selectedPieceForGame.position, move);
            if (capture) captures = [capture];
          }
          break;
        case 'thief':
          if (selectedPieceForGame.position) {
            const capture = getThiefCapture(board, selectedPieceForGame.owner, selectedPieceForGame.position, move);
            if (capture) captures = [capture];
          }
          break;
        case 'long-leap':
          if (selectedPieceForGame.position) {
            captures = getLongLeaperCaptures(board, selectedPieceForGame.owner, selectedPieceForGame.position, move);
          }
          break;
        case 'checkers':
          if (selectedPieceForGame.position) {
            captures = getCheckersCaptures(board, selectedPieceForGame, selectedPieceForGame.position, move);
          }
          break;
        case 'chameleon':
          if (selectedPieceForGame.position) {
            const chameleonCaptures = getChameleonCaptures(board, selectedPieceForGame, selectedPieceForGame.position, move);
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
  }, [selectedPieceForGame, validMovesForGame, board]);

  // If no room, show lobby
  if (!state.roomCode) {
    return (
      <OnlineLobby
        isConnected={state.isConnected}
        connectionError={state.connectionError}
        error={state.error}
        onCreateRoom={actions.createRoom}
        onJoinRoom={actions.joinRoom}
        onRejoinGame={actions.reconnect}
        onBack={onBack}
      />
    );
  }

  // Waiting for opponent
  if (state.phase === 'waiting') {
    return (
      <WaitingRoom
        roomCode={state.roomCode}
        playerColor={state.playerColor!}
        players={state.players}
        settings={state.settings!}
        onLeave={actions.leaveRoom}
      />
    );
  }

  // Drafting phase
  if (state.phase === 'drafting') {
    console.log('[OnlineGame] Rendering draft UI with budget:', state.settings?.budget, 'settings:', state.settings);
    return (
      <OnlineDraftUI
        playerColor={state.playerColor!}
        budget={state.settings!.budget}
        boardSize={state.settings!.boardSize}
        timeRemaining={state.draftTimeRemaining}
        opponentReady={state.opponentReady}
        draftRevealed={state.draftRevealed}
        whiteDraft={state.whiteDraft}
        blackDraft={state.blackDraft}
        onSubmitDraft={actions.submitDraft}
      />
    );
  }

  // Blind Placement phase
  if (state.phase === 'placement' && state.placementState && state.blindMode) {
    const myPieces = state.playerColor === 'white'
      ? state.placementState.whitePiecesToPlace
      : state.placementState.blackPiecesToPlace;
    const opponentArmy = state.playerColor === 'white'
      ? state.placementState.blackPiecesToPlace
      : state.placementState.whitePiecesToPlace;

    return (
      <BlindPlacementUI
        playerColor={state.playerColor!}
        piecesToPlace={myPieces}
        myPlacedPieces={state.myPlacedPieces}
        opponentArmy={opponentArmy}
        boardSize={state.settings!.boardSize}
        myReady={state.myReady}
        opponentReady={state.opponentBlindReady}
        onPlacePiece={actions.blindPlacePiece}
        onUnplacePiece={actions.blindUnplacePiece}
        onReady={actions.setBlindReady}
        onCancelReady={actions.cancelBlindReady}
        onPieceRightClick={handlePieceRightClick}
        roomCode={state.roomCode!}
      />
    );
  }

  // Regular Placement phase
  if (state.phase === 'placement' && state.placementState) {
    const isMyTurn = state.placementState.currentPlacer === state.playerColor;
    const myPieces = state.playerColor === 'white'
      ? state.placementState.whitePiecesToPlace
      : state.placementState.blackPiecesToPlace;
    const opponentPieces = state.playerColor === 'white'
      ? state.placementState.blackPiecesToPlace
      : state.placementState.whitePiecesToPlace;

    const handlePlacementClick = (position: Position) => {
      if (!isMyTurn || !selectedPieceToPlace) return;
      actions.placePiece(selectedPieceToPlace.id, position);
      setSelectedPieceToPlace(null);
    };

    // Calculate valid placement squares using proper zone logic
    const boardSize = state.settings!.boardSize;
    const boardConfig = BOARD_CONFIGS[boardSize];
    let validPlacementSquares: Position[] = [];
    if (isMyTurn && selectedPieceToPlace && state.playerColor) {
      try {
        const zones = getPlacementZones(boardSize, state.playerColor);
        // Get board from gameState, ensuring positionMap is a proper Map
        let board = state.gameState?.board;
        if (!board || !(board.positionMap instanceof Map)) {
          // Reconstruct board with proper Map if needed
          const pieces = board?.pieces || [];
          const positionMap = new Map<string, string>();
          for (const piece of pieces) {
            if (piece.position) {
              positionMap.set(`${piece.position.file}${piece.position.rank}`, piece.id);
            }
          }
          board = {
            pieces,
            positionMap,
            dimensions: { files: boardConfig.files, ranks: boardConfig.ranks },
          };
        }
        validPlacementSquares = getValidPlacementSquares(
          board,
          selectedPieceToPlace,
          zones,
          { ranks: boardConfig.ranks }
        );
      } catch (err) {
        console.error('Error calculating placement squares:', err);
      }
    }

    return (
      <div className="online-game-container">
        <div className="online-game-header">
          <h2>Placement Phase</h2>
          <div className="room-info">Room: {state.roomCode}</div>
        </div>

        {state.opponentStatus === 'disconnected' && (
          <div className="opponent-notification warning">
            Opponent disconnected. Waiting for them to reconnect...
          </div>
        )}
        {state.opponentStatus === 'left' && (
          <div className="opponent-notification error">
            Opponent has left the game.
          </div>
        )}

        <div className="online-game-main placement-layout">
          <OpponentPiecesPanel
            pieces={opponentPieces}
            opponentColor={state.playerColor === 'white' ? 'black' : 'white'}
            piecesRemaining={opponentPieces.length}
          />

          <div className="board-wrapper">
            <Board
              size={boardSize}
              pieces={state.gameState?.board.pieces || []}
              selectedSquare={null}
              validMoves={[]}
              onSquareClick={handlePlacementClick}
              lastMove={null}
              validPlacementSquares={validPlacementSquares}
              isPlacementMode={true}
              specialCaptureTargets={[]}
              currentTurn={state.playerColor!}
              onPieceRightClick={handlePieceRightClick}
              flipped={state.playerColor === 'black'}
            />
          </div>

          <PlacementUI
            piecesToPlace={myPieces}
            selectedPiece={selectedPieceToPlace}
            onSelectPiece={isMyTurn ? setSelectedPieceToPlace : () => {}}
            currentPlacer={state.placementState.currentPlacer}
            playerColor={state.playerColor!}
            whitePiecesRemaining={state.placementState.whitePiecesToPlace.length}
            blackPiecesRemaining={state.placementState.blackPiecesToPlace.length}
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

        <button className="btn-leave" onClick={actions.leaveRoom}>
          Leave Game
        </button>
      </div>
    );
  }

  // Playing phase
  if ((state.phase === 'playing' || state.phase === 'ended') && state.gameState) {
    const isMyTurn = state.gameState.currentTurn === state.playerColor;
    const isGameOver = state.gameState.result !== null;

    const handleSquareClick = (position: Position) => {
      if (selectedSquare) {
        // If viewing enemy piece, allow switching to any piece or deselecting
        const currentSelectedPiece = state.gameState!.board.pieces.find(
          p => p.position && p.position.file === selectedSquare.file &&
               p.position.rank === selectedSquare.rank
        );

        // If selected piece is enemy piece (viewing mode), just allow reselection
        if (currentSelectedPiece && currentSelectedPiece.owner !== state.playerColor) {
          const clickedPiece = state.gameState!.board.pieces.find(
            p => p.position && p.position.file === position.file &&
                 p.position.rank === position.rank
          );
          if (clickedPiece) {
            setSelectedSquare(position);
          } else {
            setSelectedSquare(null);
          }
          return;
        }

        // If game over, allow viewing but no moves
        if (isGameOver) {
          const clickedPiece = state.gameState!.board.pieces.find(
            p => p.position && p.position.file === position.file &&
                 p.position.rank === position.rank
          );
          if (clickedPiece) {
            setSelectedSquare(position);
          } else {
            setSelectedSquare(null);
          }
          return;
        }

        // Not my turn - just allow viewing
        if (!isMyTurn) {
          const clickedPiece = state.gameState!.board.pieces.find(
            p => p.position && p.position.file === position.file &&
                 p.position.rank === position.rank
          );
          if (clickedPiece) {
            setSelectedSquare(position);
          } else {
            setSelectedSquare(null);
          }
          return;
        }

        // Try to make a move with own piece
        const movingPiece = state.gameState!.board.pieces.find(
          p => p.position && p.position.file === selectedSquare.file &&
               p.position.rank === selectedSquare.rank
        );

        if (movingPiece && movingPiece.owner === state.playerColor) {
          // Check if this is a promotion move
          const pieceType = PIECE_BY_ID[movingPiece.typeId];
          const boardConfig = BOARD_CONFIGS[state.settings!.boardSize];
          const dimensions = { files: boardConfig.files, ranks: boardConfig.ranks };

          if (pieceType && isPromotionMove(movingPiece, pieceType, position, dimensions)) {
            // Get promotion options based on pieces in the game
            const options = getPromotionOptionsForPiece(pieceType, state.gameState!);

            if (options.length === 1) {
              // Only one option (e.g., Fool -> Jester), auto-promote
              actions.makeMove(selectedSquare, position, options[0].id);
            } else if (options.length > 1) {
              // Show promotion dialog
              setPromotionPending({
                from: selectedSquare,
                to: position,
                options,
              });
              return; // Don't clear selection yet
            } else {
              // No valid options, fall back to queen (shouldn't happen)
              actions.makeMove(selectedSquare, position, 'queen');
            }
          } else {
            actions.makeMove(selectedSquare, position);
          }
        }
        setSelectedSquare(null);
      } else {
        // Select any piece (own for moving, enemy for viewing)
        const piece = state.gameState!.board.pieces.find(
          p => p.position && p.position.file === position.file &&
               p.position.rank === position.rank
        );
        if (piece) {
          setSelectedSquare(position);
        }
      }
    };

    // Use the top-level hooks (moved outside conditionals for React rules compliance)
    const validMoves = validMovesForGame;
    const specialCaptureTargets = specialCaptureTargetsForGame;

    const lastMove = state.gameState.moveHistory.length > 0
      ? state.gameState.moveHistory[state.gameState.moveHistory.length - 1]
      : null;

    return (
      <div className="online-game-container">
        <div className="online-game-header">
          <h2>
            {isGameOver ? 'Game Over' : (isMyTurn ? 'Your Turn' : "Opponent's Turn")}
          </h2>
          <div className="room-info">Room: {state.roomCode}</div>
        </div>

        {state.opponentStatus === 'disconnected' && (
          <div className="opponent-notification warning">
            Opponent disconnected. Waiting for them to reconnect...
          </div>
        )}
        {state.opponentStatus === 'left' && (
          <div className="opponent-notification error">
            Opponent has left the game.
          </div>
        )}

        {/* Draw offer notification */}
        {state.drawOfferedBy && state.drawOfferedBy !== state.playerColor && (
          <div className="draw-offer-notification">
            <span>Your opponent offers a draw</span>
            <div className="draw-offer-buttons">
              <button className="btn btn-success" onClick={() => actions.respondDraw(true)}>
                Accept
              </button>
              <button className="btn btn-danger" onClick={() => actions.respondDraw(false)}>
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Draw warning banners */}
        {!isGameOver && isNearFiftyMoveRule(state.gameState) && (
          <div className="draw-warning-banner">
            Fifty-move rule approaching! (1 move away from automatic draw)
          </div>
        )}
        {!isGameOver && isNearThreefoldRepetition(state.gameState) && (
          <div className="draw-warning-banner">
            Threefold repetition approaching! (Position has occurred twice)
          </div>
        )}

        <GameInfo
          currentTurn={state.gameState.currentTurn}
          isCheck={state.gameState.inCheck !== null}
          isGameOver={isGameOver}
          resultDescription={state.gameState.result ? getResultDescription(state.gameState.result) : null}
          moveCount={state.gameState.moveHistory.length}
        />

        {/* ELO change display */}
        {isGameOver && state.eloUpdate && (
          <div className="elo-update-banner">
            <span className="elo-label">Rating Change:</span>
            <span className={`elo-change ${state.playerColor === 'white' ? (state.eloUpdate.whiteEloChange >= 0 ? 'positive' : 'negative') : (state.eloUpdate.blackEloChange >= 0 ? 'positive' : 'negative')}`}>
              {state.playerColor === 'white'
                ? (state.eloUpdate.whiteEloChange >= 0 ? '+' : '') + state.eloUpdate.whiteEloChange
                : (state.eloUpdate.blackEloChange >= 0 ? '+' : '') + state.eloUpdate.blackEloChange}
            </span>
            <span className="elo-new">
              (New: {state.playerColor === 'white' ? state.eloUpdate.whiteNewElo : state.eloUpdate.blackNewElo})
            </span>
          </div>
        )}

        <div className="online-game-main">
          <div className="board-wrapper">
            <Board
              size={state.settings!.boardSize}
              pieces={state.gameState.board.pieces}
              selectedSquare={selectedSquare}
              validMoves={validMoves}
              onSquareClick={handleSquareClick}
              lastMove={lastMove}
              validPlacementSquares={[]}
              isPlacementMode={false}
              specialCaptureTargets={specialCaptureTargets}
              hoveredMove={hoveredMove}
              onSquareHover={setHoveredMove}
              currentTurn={state.gameState.currentTurn}
              onPieceRightClick={handlePieceRightClick}
              flipped={state.playerColor === 'black'}
              isViewingEnemy={selectedPieceForGame !== null && selectedPieceForGame.owner !== state.playerColor}
            />
          </div>
        </div>

        {promotionPending && (
          <PromotionDialog
            options={promotionPending.options}
            color={state.playerColor!}
            onSelect={(pieceType) => {
              actions.makeMove(promotionPending.from, promotionPending.to, pieceType);
              setPromotionPending(null);
            }}
            onCancel={() => setPromotionPending(null)}
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

        <div className="online-game-controls">
          {!isGameOver && (
            <>
              <button className="btn btn-danger" onClick={actions.resign}>
                Resign
              </button>
              <button
                className="btn btn-draw"
                onClick={actions.offerDraw}
                disabled={state.drawOfferedBy === state.playerColor}
              >
                {state.drawOfferedBy === state.playerColor ? 'Draw Offered' : 'Offer Draw'}
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={actions.leaveRoom}>
            Leave Game
          </button>
        </div>

        {state.gameState.moveHistory.length > 0 && (
          <div className="move-history">
            <h3>Moves</h3>
            <div className="moves-list">
              {state.gameState.moveHistory.map((move, i) => (
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

  // Fallback loading state
  return (
    <div className="online-game-loading">
      <p>Loading game...</p>
    </div>
  );
}

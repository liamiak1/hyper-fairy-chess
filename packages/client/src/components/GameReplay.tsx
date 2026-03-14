/**
 * Game Replay Viewer
 * Steps through a completed game move by move.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { executeMove } from '@hyper-fairy-chess/shared';
import type { GameState, Move, BoardState } from '@hyper-fairy-chess/shared';
import { Board } from './Board';
import { getGameById } from '../api/games';
import type { GameSummary } from '../api/games';
import './GameReplay.css';

interface GameReplayProps {
  gameSummary: GameSummary;
  onClose: () => void;
}

/** Rebuild the positionMap (Map<string,string>) which doesn't survive JSON. */
function reconstructGameState(gs: GameState): GameState {
  const positionMap = new Map<string, string>();
  for (const piece of gs.board.pieces) {
    if (piece.position) {
      positionMap.set(`${piece.position.file}${piece.position.rank}`, piece.id);
    }
  }
  const board: BoardState = { ...gs.board, positionMap };
  return { ...gs, board };
}

/** Pre-build every board position by replaying moves from the initial state. */
function buildStates(initial: GameState, moves: Move[]): GameState[] {
  const states: GameState[] = [initial];
  let current = initial;
  for (const move of moves) {
    try {
      current = executeMove(current, move);
      states.push(current);
    } catch {
      // If a move fails to apply, stop here (shouldn't happen with valid data)
      break;
    }
  }
  return states;
}

export function GameReplay({ gameSummary, onClose }: GameReplayProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [states, setStates] = useState<GameState[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getGameById(gameSummary.id).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const record = result.game as {
        initialBoardState: GameState | null;
        moves: Move[] | null;
      };

      if (!record.initialBoardState) {
        setError('No board data available for this game.');
        setLoading(false);
        return;
      }

      const initial = reconstructGameState(record.initialBoardState);
      const gameMoves = record.moves ?? [];
      const allStates = buildStates(initial, gameMoves);

      setStates(allStates);
      setMoves(gameMoves);
      setStep(allStates.length - 1); // Start at the final position
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [gameSummary.id]);

  const goTo = useCallback((newStep: number) => {
    setStep(Math.max(0, Math.min(newStep, states.length - 1)));
  }, [states.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(step - 1);
      if (e.key === 'ArrowRight') goTo(step + 1);
      if (e.key === 'Home') goTo(0);
      if (e.key === 'End') goTo(states.length - 1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, states.length, goTo, onClose]);

  const currentState = states[step] ?? null;
  const lastMove = step > 0 ? moves[step - 1] : null;

  const resultLabel = useMemo(() => {
    if (!gameSummary.winnerColor) return 'Draw';
    return gameSummary.winnerColor === 'white'
      ? `${gameSummary.whitePlayerName} wins`
      : `${gameSummary.blackPlayerName} wins`;
  }, [gameSummary]);

  return (
    <div className="replay-overlay" onClick={onClose}>
      <div className="replay-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="replay-header">
          <div className="replay-title">
            <span className="replay-players">
              {gameSummary.whitePlayerName} vs {gameSummary.blackPlayerName}
            </span>
            <span className="replay-result">{resultLabel}</span>
          </div>
          <button className="replay-close" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="replay-loading">Loading game...</div>}
        {error && <div className="replay-error">{error}</div>}

        {!loading && !error && currentState && (
          <div className="replay-body">
            {/* Board */}
            <div className="replay-board-area">
              <Board
                size={currentState.boardSize}
                pieces={currentState.board.pieces}
                selectedSquare={null}
                validMoves={[]}
                onSquareClick={() => {}}
                lastMove={lastMove}
              />

              {/* Controls */}
              <div className="replay-controls">
                <button
                  className="replay-btn"
                  onClick={() => goTo(0)}
                  disabled={step === 0}
                  title="Start (Home)"
                >
                  ⏮
                </button>
                <button
                  className="replay-btn"
                  onClick={() => goTo(step - 1)}
                  disabled={step === 0}
                  title="Previous move (←)"
                >
                  ◀
                </button>
                <span className="replay-step">
                  {step === 0 ? 'Start' : `Move ${step} of ${moves.length}`}
                </span>
                <button
                  className="replay-btn"
                  onClick={() => goTo(step + 1)}
                  disabled={step === states.length - 1}
                  title="Next move (→)"
                >
                  ▶
                </button>
                <button
                  className="replay-btn"
                  onClick={() => goTo(states.length - 1)}
                  disabled={step === states.length - 1}
                  title="End (End)"
                >
                  ⏭
                </button>
              </div>
            </div>

            {/* Move list */}
            <div className="replay-moves">
              <div className="replay-moves-header">Moves</div>
              <div className="replay-moves-list">
                <div
                  className={`replay-move-row start-row ${step === 0 ? 'active' : ''}`}
                  onClick={() => goTo(0)}
                >
                  Start
                </div>
                {moves.map((move, i) => {
                  const moveNumber = i + 1;
                  const isWhiteMove = i % 2 === 0;
                  const isActive = step === i + 1;
                  return (
                    <div
                      key={i}
                      className={`replay-move-row ${isActive ? 'active' : ''}`}
                      onClick={() => goTo(i + 1)}
                    >
                      {isWhiteMove && (
                        <span className="move-number">{Math.ceil(moveNumber / 2)}.</span>
                      )}
                      <span className={`move-notation ${isWhiteMove ? 'white-move' : 'black-move'}`}>
                        {move.notation || `${move.from.file}${move.from.rank}→${move.to.file}${move.to.rank}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

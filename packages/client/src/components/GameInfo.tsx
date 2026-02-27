/**
 * Game info display - shows turn, check status, and result
 */

import type { PlayerColor } from '../game/types';
import './GameInfo.css';

interface GameInfoProps {
  currentTurn: PlayerColor;
  isCheck: boolean;
  isGameOver: boolean;
  resultDescription: string | null;
  moveCount: number;
}

export function GameInfo({
  currentTurn,
  isCheck,
  isGameOver,
  resultDescription,
  moveCount,
}: GameInfoProps) {
  return (
    <div className="game-info">
      {isGameOver ? (
        <div className="result-banner">
          <span className="result-text">{resultDescription}</span>
        </div>
      ) : (
        <div className="turn-indicator">
          <div className={`turn-color ${currentTurn}`} />
          <span className="turn-text">
            {currentTurn === 'white' ? 'White' : 'Black'} to move
          </span>
          {isCheck && <span className="check-badge">CHECK!</span>}
        </div>
      )}

      <div className="move-counter">
        Move {Math.floor(moveCount / 2) + 1}
      </div>
    </div>
  );
}

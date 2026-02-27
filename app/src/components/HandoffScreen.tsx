/**
 * Handoff screen - transition between players during draft
 */

import type { PlayerColor } from '../game/types';
import './HandoffScreen.css';

interface HandoffScreenProps {
  nextPlayer: PlayerColor;
  onReady: () => void;
}

export function HandoffScreen({ nextPlayer, onReady }: HandoffScreenProps) {
  const playerName = nextPlayer === 'white' ? 'White' : 'Black';

  return (
    <div className="handoff-screen">
      <div className="handoff-content">
        <h1 className="handoff-title">Pass the Device</h1>
        <p className="handoff-message">
          Please pass the device to the <strong className={nextPlayer}>{playerName}</strong> player.
        </p>
        <p className="handoff-warning">
          Do not click the button until the {playerName} player is ready.
        </p>
        <button className="ready-btn" onClick={onReady}>
          I'm {playerName} - Start My Draft
        </button>
      </div>
    </div>
  );
}

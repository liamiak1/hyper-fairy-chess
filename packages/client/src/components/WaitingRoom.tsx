/**
 * Waiting Room Component
 * Shows room code and waits for opponent to join
 */

import type { PlayerInfo, RoomSettings, PlayerColor } from '@hyper-fairy-chess/shared';
import './WaitingRoom.css';

interface WaitingRoomProps {
  roomCode: string;
  playerColor: PlayerColor;
  players: PlayerInfo[];
  settings: RoomSettings;
  onLeave: () => void;
}

export function WaitingRoom({
  roomCode,
  playerColor,
  players,
  settings,
  onLeave,
}: WaitingRoomProps) {
  const opponent = players.find(p => p.color !== playerColor);

  return (
    <div className="waiting-room">
      <div className="waiting-card">
        <h2>Game Room</h2>

        <div className="room-code-display">
          <span className="label">Share this code with your opponent:</span>
          <div className="code">{roomCode}</div>
          <button
            className="copy-btn"
            onClick={() => navigator.clipboard.writeText(roomCode)}
          >
            Copy Code
          </button>
        </div>

        <div className="game-settings">
          <h3>Game Settings</h3>
          <div className="setting-row">
            <span className="setting-label">Draft Budget:</span>
            <span className="setting-value">{settings.budget}</span>
          </div>
          <div className="setting-row">
            <span className="setting-label">Board Size:</span>
            <span className="setting-value">{settings.boardSize}</span>
          </div>
          <div className="setting-row">
            <span className="setting-label">Draft Time:</span>
            <span className="setting-value">
              {settings.draftTimeLimit
                ? `${Math.floor(settings.draftTimeLimit / 60)} min`
                : 'No limit'}
            </span>
          </div>
        </div>

        <div className="players-section">
          <h3>Players</h3>
          <div className="player-slots">
            <div className={`player-slot ${playerColor === 'white' ? 'you' : ''}`}>
              <span className="player-color white">♔</span>
              <span className="player-name">
                {players.find(p => p.color === 'white')?.name || 'Waiting...'}
              </span>
              {playerColor === 'white' && <span className="you-badge">You</span>}
            </div>
            <div className={`player-slot ${playerColor === 'black' ? 'you' : ''}`}>
              <span className="player-color black">♚</span>
              <span className="player-name">
                {players.find(p => p.color === 'black')?.name || 'Waiting...'}
              </span>
              {playerColor === 'black' && <span className="you-badge">You</span>}
            </div>
          </div>
        </div>

        {!opponent && (
          <div className="waiting-indicator">
            <span className="spinner">◌</span>
            <span>Waiting for opponent to join...</span>
          </div>
        )}

        <button className="btn-secondary leave-btn" onClick={onLeave}>
          Leave Room
        </button>
      </div>
    </div>
  );
}

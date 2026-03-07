/**
 * Waiting Room Component
 * Shows room code and waits for opponent to join
 */

import { useState, useEffect } from 'react';
import type { PlayerInfo, RoomSettings, PlayerColor } from '@hyper-fairy-chess/shared';
import './WaitingRoom.css';

// Get the server URL from environment or default to localhost
const getApiBase = (): string => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

interface WaitingRoomProps {
  roomCode: string;
  playerColor: PlayerColor;
  players: PlayerInfo[];
  settings: RoomSettings;
  onLeave: () => void;
}

interface PlayerElo {
  [username: string]: number | null;
}

export function WaitingRoom({
  roomCode,
  playerColor,
  players,
  settings,
  onLeave,
}: WaitingRoomProps) {
  const opponent = players.find(p => p.color !== playerColor);
  const [eloRatings, setEloRatings] = useState<PlayerElo>({});

  // Fetch ELO ratings for account users
  useEffect(() => {
    const fetchElo = async (player: PlayerInfo) => {
      if (!player.isAccountUser) return;

      try {
        const response = await fetch(`${getApiBase()}/stats/player/${player.name}`);
        if (response.ok) {
          const data = await response.json();
          setEloRatings(prev => ({ ...prev, [player.name]: data.eloRating }));
        }
      } catch (error) {
        console.error('Failed to fetch ELO for', player.name, error);
      }
    };

    for (const player of players) {
      if (player.isAccountUser && eloRatings[player.name] === undefined) {
        fetchElo(player);
      }
    }
  }, [players, eloRatings]);

  const getPlayerDisplay = (player: PlayerInfo | undefined) => {
    if (!player) return 'Waiting...';
    const elo = player.isAccountUser ? eloRatings[player.name] : null;
    if (elo !== null && elo !== undefined) {
      return `${player.name} (${elo})`;
    }
    if (player.isAccountUser) {
      return `${player.name} (...)`;
    }
    return player.name;
  };

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
          <div className="setting-row">
            <span className="setting-label">Placement:</span>
            <span className="setting-value">
              {settings.placementMode === 'blind' ? 'Blind (simultaneous)' : 'Alternating'}
            </span>
          </div>
        </div>

        <div className="players-section">
          <h3>Players</h3>
          <div className="player-slots">
            <div className={`player-slot ${playerColor === 'white' ? 'you' : ''}`}>
              <span className="player-color white">♔</span>
              <span className="player-name">
                {getPlayerDisplay(players.find(p => p.color === 'white'))}
              </span>
              {playerColor === 'white' && <span className="you-badge">You</span>}
            </div>
            <div className={`player-slot ${playerColor === 'black' ? 'you' : ''}`}>
              <span className="player-color black">♚</span>
              <span className="player-name">
                {getPlayerDisplay(players.find(p => p.color === 'black'))}
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

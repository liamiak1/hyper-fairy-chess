/**
 * Online Lobby Component
 * Handles room creation and joining
 */

import { useState } from 'react';
import type { RoomSettings } from '@hyper-fairy-chess/shared';
import './OnlineLobby.css';

interface OnlineLobbyProps {
  isConnected: boolean;
  connectionError: string | null;
  error: string | null;
  onCreateRoom: (playerName: string, settings: RoomSettings) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
  onBack: () => void;
}

export function OnlineLobby({
  isConnected,
  connectionError,
  error,
  onCreateRoom,
  onJoinRoom,
  onBack,
}: OnlineLobbyProps) {
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [playerName, setPlayerName] = useState(() =>
    localStorage.getItem('hfc_playerName') || ''
  );
  const [roomCode, setRoomCode] = useState('');
  const [settings, setSettings] = useState<RoomSettings>({
    budget: 360,
    boardSize: '8x8',
    draftTimeLimit: 180,
    moveTimeLimit: null,
  });
  const [budgetOption, setBudgetOption] = useState<string>('360');

  const handleCreateRoom = () => {
    if (!playerName.trim()) return;
    localStorage.setItem('hfc_playerName', playerName.trim());
    onCreateRoom(playerName.trim(), settings);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    localStorage.setItem('hfc_playerName', playerName.trim());
    onJoinRoom(roomCode.trim().toUpperCase(), playerName.trim());
  };

  const handleRoomCodeInput = (value: string) => {
    // Allow only alphanumeric, convert to uppercase, max 6 chars
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    setRoomCode(cleaned);
  };

  if (!isConnected) {
    return (
      <div className="online-lobby">
        <div className="lobby-card">
          <h2>Online Multiplayer</h2>
          <div className="connection-status connecting">
            {connectionError ? (
              <>
                <span className="status-icon">✖</span>
                <span>Connection failed: {connectionError}</span>
              </>
            ) : (
              <>
                <span className="status-icon spinning">◌</span>
                <span>Connecting to server...</span>
              </>
            )}
          </div>
          <button className="btn-secondary" onClick={onBack}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'menu') {
    return (
      <div className="online-lobby">
        <div className="lobby-card">
          <h2>Online Multiplayer</h2>
          <div className="connection-status connected">
            <span className="status-icon">●</span>
            <span>Connected</span>
          </div>

          <div className="lobby-options">
            <button className="btn-primary large" onClick={() => setMode('create')}>
              Create Game
            </button>
            <button className="btn-primary large" onClick={() => setMode('join')}>
              Join Game
            </button>
          </div>

          <button className="btn-secondary" onClick={onBack}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="online-lobby">
        <div className="lobby-card">
          <h2>Create Game</h2>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="playerName">Your Name</label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>

          <div className="form-group">
            <label htmlFor="budget">Draft Budget</label>
            <select
              id="budget"
              value={budgetOption}
              onChange={(e) => {
                const value = e.target.value;
                setBudgetOption(value);
                if (value === 'random') {
                  const options = [260, 360, 500, 700, 900];
                  const randomBudget = options[Math.floor(Math.random() * options.length)];
                  setSettings({ ...settings, budget: randomBudget });
                } else {
                  setSettings({ ...settings, budget: Number(value) });
                }
              }}
            >
              <option value="260">260 (Quick)</option>
              <option value="360">360 (Standard)</option>
              <option value="500">500 (Extended)</option>
              <option value="700">700 (Long)</option>
              <option value="900">900 (Epic)</option>
              <option value="random">Random</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="boardSize">Board Size</label>
            <select
              id="boardSize"
              value={settings.boardSize}
              onChange={(e) => setSettings({ ...settings, boardSize: e.target.value as '8x8' | '10x8' | '10x10' })}
            >
              <option value="8x8">8x8 (Standard)</option>
              <option value="10x8">10x8 (Extended)</option>
              <option value="10x10">10x10 (Large)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="draftTime">Draft Time Limit</label>
            <select
              id="draftTime"
              value={settings.draftTimeLimit || 0}
              onChange={(e) => setSettings({
                ...settings,
                draftTimeLimit: Number(e.target.value) || null
              })}
            >
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={180}>3 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={0}>No limit</option>
            </select>
          </div>

          <div className="button-group">
            <button
              className="btn-primary"
              onClick={handleCreateRoom}
              disabled={!playerName.trim()}
            >
              Create Room
            </button>
            <button className="btn-secondary" onClick={() => setMode('menu')}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Join mode
  return (
    <div className="online-lobby">
      <div className="lobby-card">
        <h2>Join Game</h2>

        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label htmlFor="playerName">Your Name</label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
          />
        </div>

        <div className="form-group">
          <label htmlFor="roomCode">Room Code</label>
          <input
            id="roomCode"
            type="text"
            value={roomCode}
            onChange={(e) => handleRoomCodeInput(e.target.value)}
            placeholder="ABC123"
            className="room-code-input"
            maxLength={6}
          />
        </div>

        <div className="button-group">
          <button
            className="btn-primary"
            onClick={handleJoinRoom}
            disabled={!playerName.trim() || roomCode.length !== 6}
          >
            Join Room
          </button>
          <button className="btn-secondary" onClick={() => setMode('menu')}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

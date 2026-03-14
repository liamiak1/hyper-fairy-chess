/**
 * Main Menu Component
 * Entry point for choosing game mode
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';
import './MainMenu.css';

interface MainMenuProps {
  onLocalPlay: () => void;
  onOnlinePlay: () => void;
  onProfile: () => void;
}

export function MainMenu({ onLocalPlay, onOnlinePlay, onProfile }: MainMenuProps) {
  const { isAuthenticated, user, authAvailable } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleProfileClick = () => {
    if (isAuthenticated) {
      onProfile();
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <div className="main-menu">
      <div className="menu-card">
        <h1 className="game-logo">Hyper Fairy Chess</h1>
        <p className="tagline">Draft your army. Place your pieces. Conquer!</p>

        <div className="menu-options">
          <button className="menu-btn primary" onClick={onLocalPlay}>
            <span className="btn-icon">♟</span>
            <span className="btn-text">
              <span className="btn-title">Local Game</span>
              <span className="btn-desc">Play on this device (hot-seat)</span>
            </span>
          </button>

          <button className="menu-btn online" onClick={onOnlinePlay}>
            <span className="btn-icon">⚔</span>
            <span className="btn-text">
              <span className="btn-title">Online Multiplayer</span>
              <span className="btn-desc">Create or join a room</span>
            </span>
          </button>

          {authAvailable && (
            <button className="menu-btn profile" onClick={handleProfileClick}>
              <span className="btn-icon">👤</span>
              <span className="btn-text">
                <span className="btn-title">
                  {isAuthenticated ? `Profile (${user?.username})` : 'Login / Sign Up'}
                </span>
                <span className="btn-desc">
                  {isAuthenticated ? 'Manage saved armies and stats' : 'Create account to save armies'}
                </span>
              </span>
            </button>
          )}
        </div>

        <div className="menu-footer">
          <p>Right-click any piece to see its moves</p>
        </div>
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

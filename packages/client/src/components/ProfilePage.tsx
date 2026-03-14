/**
 * Profile Page Component
 * Shows user stats and saved armies management
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getArmies, deleteArmy, type SavedArmy } from '../api/armies';
import { PIECE_BY_ID } from '@hyper-fairy-chess/shared';
import { ArmyBuilder } from './ArmyBuilder';
import './ProfilePage.css';

interface ProfilePageProps {
  onBack: () => void;
}

export function ProfilePage({ onBack }: ProfilePageProps) {
  const { user, token, logout } = useAuth();
  const [armies, setArmies] = useState<SavedArmy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArmyBuilder, setShowArmyBuilder] = useState(false);
  const [editingArmy, setEditingArmy] = useState<SavedArmy | null>(null);

  // Fetch armies on mount
  useEffect(() => {
    if (token) {
      fetchArmies();
    }
  }, [token]);

  const fetchArmies = async () => {
    if (!token) return;
    setLoading(true);
    const result = await getArmies(token);
    if (result.success) {
      setArmies(result.armies);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleDeleteArmy = async (armyId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this army?')) return;

    const result = await deleteArmy(token, armyId);
    if (result.success) {
      setArmies(armies.filter((a) => a.id !== armyId));
    } else {
      setError(result.error);
    }
  };

  const handleCreateNew = () => {
    setEditingArmy(null);
    setShowArmyBuilder(true);
  };

  const handleEditArmy = (army: SavedArmy) => {
    setEditingArmy(army);
    setShowArmyBuilder(true);
  };

  const handleArmyBuilderClose = () => {
    setShowArmyBuilder(false);
    setEditingArmy(null);
    fetchArmies(); // Refresh list
  };

  const handleLogout = () => {
    logout();
    onBack();
  };

  // Get piece symbols for display
  const getPieceIcons = (army: SavedArmy): string => {
    return army.pieces
      .slice(0, 6)
      .map((p) => {
        const pieceType = PIECE_BY_ID[p.pieceTypeId];
        return pieceType?.symbol || '?';
      })
      .join(' ');
  };

  const getTotalPieces = (army: SavedArmy): number => {
    return army.pieces.reduce((sum, p) => sum + p.count, 0);
  };

  if (showArmyBuilder) {
    return (
      <ArmyBuilder
        editingArmy={editingArmy}
        onClose={handleArmyBuilderClose}
      />
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <header className="profile-header">
          <div className="header-left">
            <button className="back-btn" onClick={onBack}>
              ← Back to Menu
            </button>
          </div>
          <div className="header-right">
            <span className="username">{user?.username}</span>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <section className="stats-section">
          <h2>Player Stats</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{user?.eloRating || 1200}</span>
              <span className="stat-label">ELO Rating</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{user?.gamesPlayed || 0}</span>
              <span className="stat-label">Games Played</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{user?.wins || 0}</span>
              <span className="stat-label">Wins</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{user?.losses || 0}</span>
              <span className="stat-label">Losses</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{user?.draws || 0}</span>
              <span className="stat-label">Draws</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {user?.gamesPlayed ? Math.round(((user.wins ?? 0) / user.gamesPlayed) * 100) : 0}%
              </span>
              <span className="stat-label">Win Rate</span>
            </div>
          </div>
        </section>

        <section className="armies-section">
          <div className="armies-header">
            <h2>My Armies</h2>
            <button className="create-btn" onClick={handleCreateNew}>
              + Create New Army
            </button>
          </div>

          {loading && <p className="loading">Loading armies...</p>}
          {error && <p className="error">{error}</p>}

          {!loading && armies.length === 0 && (
            <p className="no-armies">
              You haven't saved any armies yet. Create one to quickly load it during draft!
            </p>
          )}

          <div className="armies-list">
            {armies.map((army) => (
              <div key={army.id} className="army-card">
                <div className="army-info">
                  <span className="army-name">{army.name}</span>
                  <span className="army-budget">{army.budget} pts</span>
                  <span className="army-pieces">{getTotalPieces(army)} pieces</span>
                </div>
                <div className="army-icons">{getPieceIcons(army)}</div>
                <div className="army-actions">
                  <button
                    className="edit-btn"
                    onClick={() => handleEditArmy(army)}
                  >
                    Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteArmy(army.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

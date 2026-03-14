/**
 * Profile Page Component
 * Shows user stats and saved armies management
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getArmies, deleteArmy, type SavedArmy } from '../api/armies';
import { getGames, type GameSummary } from '../api/games';
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
  const [games, setGames] = useState<GameSummary[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);

  // Fetch armies and game history on mount
  useEffect(() => {
    if (token) {
      fetchArmies();
      fetchGames();
    }
  }, [token]);

  const fetchGames = async () => {
    if (!token) return;
    setGamesLoading(true);
    const result = await getGames(token);
    if (result.success) setGames(result.games);
    setGamesLoading(false);
  };

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

  const formatGameResult = (game: GameSummary, myName: string): { label: string; cls: string } => {
    const isWhite = game.whitePlayerName === myName;
    const won = game.winnerColor === (isWhite ? 'white' : 'black');
    const lost = game.winnerColor === (isWhite ? 'black' : 'white');
    if (won) return { label: 'Win', cls: 'result-win' };
    if (lost) return { label: 'Loss', cls: 'result-loss' };
    return { label: 'Draw', cls: 'result-draw' };
  };

  const formatEloChange = (game: GameSummary, myName: string): string | null => {
    const isWhite = game.whitePlayerName === myName;
    const change = isWhite ? game.whiteEloChange : game.blackEloChange;
    if (change === null) return null;
    return change >= 0 ? `+${change}` : `${change}`;
  };

  const formatDate = (iso: string): string => {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatResultType = (type: string): string => {
    const map: Record<string, string> = {
      'checkmate': 'Checkmate',
      'resignation': 'Resignation',
      'timeout': 'Timeout',
      'draw-agreement': 'Draw (agreed)',
      'draw-vp-tie': 'Draw (VP tie)',
      'draw-fifty-move': 'Draw (50-move)',
      'draw-repetition': 'Draw (repetition)',
      'stalemate': 'Stalemate',
    };
    return map[type] ?? type;
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

        <section className="history-section">
          <h2>Game History</h2>

          {gamesLoading && <p className="loading">Loading games...</p>}

          {!gamesLoading && games.length === 0 && (
            <p className="no-armies">No games recorded yet. Play some games to see your history here!</p>
          )}

          {!gamesLoading && games.length > 0 && (
            <div className="history-list">
              {games.map((game) => {
                const myName = user?.username ?? '';
                const opponent = game.whitePlayerName === myName ? game.blackPlayerName : game.whitePlayerName;
                const result = formatGameResult(game, myName);
                const eloChange = formatEloChange(game, myName);
                return (
                  <div key={game.id} className={`history-row ${result.cls}`}>
                    <div className="history-result-badge">{result.label}</div>
                    <div className="history-info">
                      <span className="history-opponent">vs {opponent}</span>
                      <span className="history-meta">
                        {game.settings ? `${game.settings.budget}pts · ${game.settings.boardSize}` : ''}
                        {' · '}
                        {formatResultType(game.resultType)}
                        {' · '}
                        {game.moveCount} moves
                      </span>
                    </div>
                    <div className="history-right">
                      {eloChange && (
                        <span className={`history-elo ${parseFloat(eloChange) >= 0 ? 'elo-pos' : 'elo-neg'}`}>
                          {eloChange}
                        </span>
                      )}
                      <span className="history-date">{formatDate(game.playedAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

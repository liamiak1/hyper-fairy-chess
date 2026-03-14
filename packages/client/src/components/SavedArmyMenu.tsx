/**
 * SavedArmyMenu - loads server-saved armies during draft phase
 * Filters armies by compatibility with the current game budget and board size.
 */

import { useState, useEffect } from 'react';
import type { BoardSize, PlayerDraft } from '@hyper-fairy-chess/shared';
import {
  createEmptyDraft,
  addPieceToDraft,
  isArmyValidForGame,
  PIECE_BY_ID,
} from '@hyper-fairy-chess/shared';
import { useAuth } from '../context/AuthContext';
import { getArmies, type SavedArmy, type ArmyPiece } from '../api/armies';
import './SavedArmyMenu.css';

interface SavedArmyMenuProps {
  budget: number;
  boardSize: BoardSize;
  disabled?: boolean;
  onLoad: (draft: PlayerDraft) => void;
}

function buildDraftFromPieces(pieces: ArmyPiece[]): PlayerDraft {
  let draft = createEmptyDraft();
  for (const ap of pieces) {
    const pieceType = PIECE_BY_ID[ap.pieceTypeId];
    if (!pieceType) continue;
    for (let i = 0; i < ap.count; i++) {
      draft = addPieceToDraft(draft, pieceType);
    }
  }
  return draft;
}

export function SavedArmyMenu({ budget, boardSize, disabled, onLoad }: SavedArmyMenuProps) {
  const { token, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [armies, setArmies] = useState<SavedArmy[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Fetch armies when menu is first opened
  useEffect(() => {
    if (!open || fetched || !token) return;
    setLoading(true);
    getArmies(token).then((result) => {
      if (result.success) setArmies(result.armies);
      setLoading(false);
      setFetched(true);
    });
  }, [open, fetched, token]);

  if (!isAuthenticated) return null;

  const compatible = armies.filter((a) => {
    const check = isArmyValidForGame(
      a.pieces.map((p) => ({ pieceTypeId: p.pieceTypeId, count: p.count })),
      a.budget,
      budget,
      boardSize
    );
    return check.valid;
  });

  const handleLoad = (army: SavedArmy) => {
    const draft = buildDraftFromPieces(army.pieces);
    onLoad(draft);
    setOpen(false);
  };

  return (
    <div className="saved-army-menu">
      <button
        className={`saved-army-toggle ${open ? 'active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        type="button"
      >
        Saved Armies {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="saved-army-dropdown">
          {loading && <div className="sam-status">Loading...</div>}

          {!loading && compatible.length === 0 && (
            <div className="sam-status">
              {armies.length === 0
                ? 'No saved armies yet — create one in your profile.'
                : 'No saved armies fit this game\'s budget and board size.'}
            </div>
          )}

          {compatible.map((army) => {
            const totalPieces = army.pieces.reduce((s, p) => s + p.count, 0);
            const icons = army.pieces
              .slice(0, 5)
              .map((p) => PIECE_BY_ID[p.pieceTypeId]?.symbol ?? '?')
              .join(' ');
            return (
              <button
                key={army.id}
                className="sam-item"
                onClick={() => handleLoad(army)}
                type="button"
              >
                <span className="sam-name">{army.name}</span>
                <span className="sam-icons">{icons}</span>
                <span className="sam-meta">{army.budget} pts · {totalPieces} pieces</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

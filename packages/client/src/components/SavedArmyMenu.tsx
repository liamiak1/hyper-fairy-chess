/**
 * SavedArmyMenu - unified save/load armies during draft phase.
 *
 * Logged-in users: load from DB, save to DB.
 * Guests: load from localStorage, save to localStorage.
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
import { getArmies, createArmy, type SavedArmy, type ArmyPiece } from '../api/armies';
import { useArmyPresets } from '../hooks/useArmyPresets';
import type { ArmyPreset } from '../hooks/useArmyPresets';
import './SavedArmyMenu.css';

interface SavedArmyMenuProps {
  budget: number;
  boardSize: BoardSize;
  disabled?: boolean;
  currentDraft?: PlayerDraft; // When provided, shows the save section
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

function buildDraftFromPreset(preset: ArmyPreset): PlayerDraft {
  let slotsUsed = { pawn: 0, piece: 0, royalty: 1 };
  for (const s of preset.selections) {
    const pt = PIECE_BY_ID[s.pieceTypeId];
    if (!pt) continue;
    if (pt.tier === 'pawn') slotsUsed.pawn += s.count;
    else if (pt.tier === 'piece') slotsUsed.piece += s.count;
    else if (pt.tier === 'royalty' && !pt.replacesKing) slotsUsed.royalty += s.count;
  }
  return { selections: preset.selections, budgetSpent: preset.budgetUsed, slotsUsed };
}

export function SavedArmyMenu({ budget, boardSize, disabled, currentDraft, onLoad }: SavedArmyMenuProps) {
  const { token, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  // DB armies (logged-in users)
  const [armies, setArmies] = useState<SavedArmy[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Save state
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Guest localStorage presets
  const { addPreset, removePreset, getPresetsForSettings } = useArmyPresets();
  const guestPresets = isAuthenticated ? [] : getPresetsForSettings(boardSize, budget);

  // Fetch DB armies on first open (logged-in only)
  useEffect(() => {
    if (!open || fetched || !token || !isAuthenticated) return;
    setLoading(true);
    getArmies(token).then((result) => {
      if (result.success) setArmies(result.armies);
      setLoading(false);
      setFetched(true);
    });
  }, [open, fetched, token, isAuthenticated]);

  const canSave = !!currentDraft && currentDraft.selections.length > 0 && saveName.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    const name = saveName.trim();
    const pieces = currentDraft!.selections.map((s) => ({ pieceTypeId: s.pieceTypeId, count: s.count }));
    const armyBudget = currentDraft!.budgetSpent;

    if (isAuthenticated && token) {
      setSaving(true);
      const result = await createArmy(token, name, pieces, armyBudget);
      setSaving(false);
      if (result.success) {
        setSaveName('');
        setSaveMsg('Saved!');
        // Refresh list
        setFetched(false);
        setArmies([]);
      } else {
        setSaveMsg(result.error);
      }
    } else {
      // Guest: save to localStorage
      addPreset(name, currentDraft!.selections, armyBudget, budget, boardSize);
      setSaveName('');
      setSaveMsg('Saved locally!');
    }

    setTimeout(() => setSaveMsg(null), 2000);
  };

  // Compatible DB armies
  const compatible = armies.filter((a) =>
    isArmyValidForGame(
      a.pieces.map((p) => ({ pieceTypeId: p.pieceTypeId, count: p.count })),
      a.budget,
      budget,
      boardSize
    ).valid
  );

  const hasDraftToSave = !!currentDraft && currentDraft.selections.length > 0;
  const hasAnything = isAuthenticated ? compatible.length > 0 : guestPresets.length > 0;

  return (
    <div className="saved-army-menu">
      <button
        className={`saved-army-toggle ${open ? 'active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        type="button"
      >
        Armies {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="saved-army-dropdown">
          {/* Save section */}
          {hasDraftToSave && (
            <div className="sam-save-section">
              <input
                className="sam-save-input"
                type="text"
                placeholder="Name this army..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                maxLength={50}
              />
              <button
                className="sam-save-btn"
                onClick={handleSave}
                disabled={!canSave || saving}
                type="button"
              >
                {saving ? '...' : 'Save'}
              </button>
              {saveMsg && <div className="sam-save-msg">{saveMsg}</div>}
            </div>
          )}

          {/* Divider if both sections present */}
          {hasDraftToSave && hasAnything && (
            <div className="sam-divider" />
          )}

          {/* Load section */}
          {loading && <div className="sam-status">Loading...</div>}

          {!loading && !hasAnything && (
            <div className="sam-status">
              {isAuthenticated
                ? armies.length === 0
                  ? 'No saved armies yet — save one above or create in your profile.'
                  : 'No saved armies fit this game\'s budget and board size.'
                : guestPresets.length === 0
                  ? hasDraftToSave
                    ? 'No saved armies. Save this draft above, or log in to sync across devices.'
                    : 'No saved armies. Log in to save armies across devices.'
                  : null}
            </div>
          )}

          {/* DB armies (logged-in) */}
          {isAuthenticated && compatible.map((army) => {
            const icons = army.pieces.slice(0, 5).map((p) => PIECE_BY_ID[p.pieceTypeId]?.symbol ?? '?').join(' ');
            const total = army.pieces.reduce((s, p) => s + p.count, 0);
            return (
              <button
                key={army.id}
                className="sam-item"
                onClick={() => { onLoad(buildDraftFromPieces(army.pieces)); setOpen(false); }}
                type="button"
              >
                <span className="sam-name">{army.name}</span>
                <span className="sam-icons">{icons}</span>
                <span className="sam-meta">{army.budget} pts · {total} pieces</span>
              </button>
            );
          })}

          {/* Guest localStorage presets */}
          {!isAuthenticated && guestPresets.map((preset) => (
            <div key={preset.id} className="sam-item sam-item-guest">
              <button
                className="sam-item-load"
                onClick={() => { onLoad(buildDraftFromPreset(preset)); setOpen(false); }}
                type="button"
              >
                <span className="sam-name">{preset.name}</span>
                <span className="sam-meta">{preset.budgetUsed} pts</span>
              </button>
              <button
                className="sam-delete-btn"
                onClick={() => removePreset(preset.id)}
                type="button"
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

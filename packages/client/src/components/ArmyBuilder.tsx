/**
 * Army Builder - standalone UI for creating/editing saved armies
 */

import { useState } from 'react';
import type { PieceType, PieceTier, BoardSize } from '@hyper-fairy-chess/shared';
import {
  canAddPiece,
  getSlotLimits,
  getPieceCountInDraft,
  getDraftPieceCount,
  hasKingReplacer,
  getAvailablePieces,
  createEmptyDraft,
  addPieceToDraft,
  removePieceFromDraft,
  PIECE_BY_ID,
  BUDGET_PRESETS,
  MIN_BUDGET,
  MAX_BUDGET,
  BUDGET_STEP,
  type PlayerDraft,
} from '@hyper-fairy-chess/shared';
import { PieceInfoPopup } from './PieceInfoPopup';
import { useAuth } from '../context/AuthContext';
import { createArmy, updateArmy, type SavedArmy, type ArmyPiece } from '../api/armies';
import './ArmyBuilder.css';

interface ArmyBuilderProps {
  editingArmy: SavedArmy | null;
  onClose: () => void;
}

interface PieceInfoState {
  pieceType: PieceType;
  x: number;
  y: number;
}

function draftFromArmyPieces(pieces: ArmyPiece[]): PlayerDraft {
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

export function ArmyBuilder({ editingArmy, onClose }: ArmyBuilderProps) {
  const { token } = useAuth();

  const [name, setName] = useState(editingArmy?.name ?? '');
  const [budget, setBudget] = useState(editingArmy?.budget ?? 400);
  const [boardSize, setBoardSize] = useState<BoardSize>('8x8');
  const [draft, setDraft] = useState<PlayerDraft>(() =>
    editingArmy ? draftFromArmyPieces(editingArmy.pieces) : createEmptyDraft()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pieceInfo, setPieceInfo] = useState<PieceInfoState | null>(null);

  const availablePieces = getAvailablePieces();
  const slotLimits = getSlotLimits(boardSize);
  const budgetRemaining = budget - draft.budgetSpent;
  const totalPieces = getDraftPieceCount(draft);

  const piecesByTier = groupByTier(availablePieces);

  const handleAdd = (pieceType: PieceType) => {
    setDraft((d) => addPieceToDraft(d, pieceType));
  };

  const handleRemove = (pieceTypeId: string) => {
    setDraft((d) => removePieceFromDraft(d, pieceTypeId));
  };

  const handleSave = async () => {
    if (!token) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter an army name');
      return;
    }

    setSaving(true);
    setError(null);

    const pieces: ArmyPiece[] = draft.selections.map((s) => ({
      pieceTypeId: s.pieceTypeId,
      count: s.count,
    }));

    let result;
    if (editingArmy) {
      result = await updateArmy(token, editingArmy.id, trimmedName, pieces, budget);
    } else {
      result = await createArmy(token, trimmedName, pieces, budget);
    }

    setSaving(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error);
    }
  };

  const handleRightClick = (piece: PieceType, e: React.MouseEvent) => {
    e.preventDefault();
    setPieceInfo({ pieceType: piece, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="army-builder">
      <div className="builder-container">
        <header className="builder-header">
          <h2>{editingArmy ? 'Edit Army' : 'Create Army'}</h2>
          <button className="cancel-btn" onClick={onClose}>
            ✕ Cancel
          </button>
        </header>

        <div className="builder-settings">
          <div className="setting-group">
            <label htmlFor="army-name">Army Name</label>
            <input
              id="army-name"
              type="text"
              className="army-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter army name..."
              maxLength={50}
            />
          </div>

          <div className="setting-group">
            <label>Budget</label>
            <div className="budget-controls">
              <div className="budget-presets">
                {BUDGET_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    className={`preset-btn ${budget === preset.value ? 'active' : ''}`}
                    onClick={() => setBudget(preset.value)}
                    title={preset.description}
                  >
                    {preset.label} ({preset.value})
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={MIN_BUDGET}
                max={MAX_BUDGET}
                step={BUDGET_STEP}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="budget-slider"
              />
              <span className="budget-display">{budget} pts</span>
            </div>
          </div>

          <div className="setting-group">
            <label>Board Size (for slot limits)</label>
            <div className="board-size-options">
              {(['8x8', '10x8', '10x10'] as BoardSize[]).map((size) => (
                <button
                  key={size}
                  className={`size-btn ${boardSize === size ? 'active' : ''}`}
                  onClick={() => setBoardSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="builder-stats">
          <div className="stat budget-stat">
            <span className={budgetRemaining < 0 ? 'over-budget' : ''}>{budgetRemaining}</span>
            <span className="stat-label">/ {budget} pts remaining</span>
          </div>
          <div className="stat">
            <span>{draft.slotsUsed.pawn}</span>
            <span className="stat-label">/ {slotLimits.pawn} pawn slots</span>
          </div>
          <div className="stat">
            <span>{draft.slotsUsed.piece}</span>
            <span className="stat-label">/ {slotLimits.piece} piece slots</span>
          </div>
          <div className="stat">
            <span>{draft.slotsUsed.royalty}</span>
            <span className="stat-label">/ {slotLimits.royalty} royalty slots</span>
          </div>
        </div>

        <div className="builder-content">
          <div className="available-pieces">
            <h3>Available Pieces <span className="hint">(right-click for info)</span></h3>
            <div className="tier-container">
              {piecesByTier.pawn.length > 0 && (
                <TierSection
                  title="Pawns"
                  pieces={piecesByTier.pawn}
                  draft={draft}
                  budget={budget}
                  boardSize={boardSize}
                  onAddPiece={handleAdd}
                  onRightClick={handleRightClick}
                />
              )}
              {piecesByTier.piece.length > 0 && (
                <TierSection
                  title="Pieces"
                  pieces={piecesByTier.piece}
                  draft={draft}
                  budget={budget}
                  boardSize={boardSize}
                  onAddPiece={handleAdd}
                  onRightClick={handleRightClick}
                />
              )}
              {piecesByTier.royalty.length > 0 && (
                <TierSection
                  title="Royalty"
                  pieces={piecesByTier.royalty}
                  draft={draft}
                  budget={budget}
                  boardSize={boardSize}
                  onAddPiece={handleAdd}
                  onRightClick={handleRightClick}
                />
              )}
            </div>
          </div>

          <div className="your-army">
            <h3>Your Army ({totalPieces} pieces)</h3>
            <div className="army-list">
              {!hasKingReplacer(draft) && (
                <div className="army-piece mandatory">
                  <span className="piece-symbol">{PIECE_BY_ID['king']?.symbol || '♔'}</span>
                  <span className="piece-name">King</span>
                  <span className="piece-cost">(free)</span>
                </div>
              )}
              {draft.selections.map((selection) => {
                const pieceType = PIECE_BY_ID[selection.pieceTypeId];
                if (!pieceType) return null;
                return (
                  <div key={selection.pieceTypeId} className="army-piece">
                    <span className="piece-symbol">{pieceType.symbol}</span>
                    <span className="piece-name">
                      {pieceType.name}
                      {selection.count > 1 && ` x${selection.count}`}
                    </span>
                    <span className="piece-cost">{pieceType.cost * selection.count} pts</span>
                    <button
                      className="remove-btn"
                      onClick={() => handleRemove(selection.pieceTypeId)}
                      title="Remove one"
                    >
                      −
                    </button>
                  </div>
                );
              })}
              {draft.selections.length === 0 && (
                <div className="army-empty">Add pieces from the left panel</div>
              )}
            </div>
          </div>
        </div>

        <div className="builder-footer">
          {error && <p className="save-error">{error}</p>}
          <div className="footer-actions">
            <button className="cancel-btn-lg" onClick={onClose}>
              Cancel
            </button>
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={saving || budgetRemaining < 0}
            >
              {saving ? 'Saving...' : editingArmy ? 'Save Changes' : 'Save Army'}
            </button>
          </div>
        </div>
      </div>

      {pieceInfo && (
        <PieceInfoPopup
          pieceType={pieceInfo.pieceType}
          color="white"
          x={pieceInfo.x}
          y={pieceInfo.y}
          onClose={() => setPieceInfo(null)}
        />
      )}
    </div>
  );
}

interface TierSectionProps {
  title: string;
  pieces: PieceType[];
  draft: PlayerDraft;
  budget: number;
  boardSize: BoardSize;
  onAddPiece: (pieceType: PieceType) => void;
  onRightClick: (piece: PieceType, e: React.MouseEvent) => void;
}

function TierSection({ title, pieces, draft, budget, boardSize, onAddPiece, onRightClick }: TierSectionProps) {
  return (
    <div className={`tier-section tier-${title.toLowerCase()}`}>
      <h4>{title}</h4>
      <div className="piece-list">
        {pieces.map((piece) => {
          const canAdd = canAddPiece(draft, piece, budget, boardSize);
          const countInDraft = getPieceCountInDraft(draft, piece.id);
          return (
            <button
              key={piece.id}
              className={`piece-btn ${!canAdd ? 'disabled' : ''}`}
              onClick={() => canAdd && onAddPiece(piece)}
              onContextMenu={(e) => onRightClick(piece, e)}
              disabled={!canAdd}
              title={`${piece.name} (${piece.cost} pts)${piece.description ? '\n' + piece.description : ''}`}
            >
              <span className="piece-symbol">{piece.symbol}</span>
              <span className="piece-name">{piece.name}</span>
              <span className="piece-cost">{piece.cost}</span>
              {countInDraft > 0 && <span className="piece-count">x{countInDraft}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function groupByTier(pieces: PieceType[]): Record<PieceTier, PieceType[]> {
  const sortByCost = (a: PieceType, b: PieceType) => a.cost - b.cost;
  return {
    pawn: pieces.filter((p) => p.tier === 'pawn').sort(sortByCost),
    piece: pieces.filter((p) => p.tier === 'piece').sort(sortByCost),
    royalty: pieces.filter((p) => p.tier === 'royalty').sort(sortByCost),
    other: pieces.filter((p) => p.tier === 'other').sort(sortByCost),
  };
}

/**
 * Online Draft UI Component
 * Simultaneous blind draft with timer and reveal
 */

import { useState, useMemo } from 'react';
import type {
  PieceType,
  PlayerColor,
  BoardSize,
  DraftPick,
} from '@hyper-fairy-chess/shared';
import type { PlayerDraft } from '../game/rules/draft';
import {
  createEmptyDraft,
  canAddPiece,
  getSlotLimits,
  getPieceCountInDraft,
  getDraftPieceCount,
  hasKingReplacer,
} from '../game/rules/draft';
import { PIECE_BY_ID, ALL_PIECES } from '../game/pieces/pieceDefinitions';
import { PieceInfoPopup } from './PieceInfoPopup';
import './OnlineDraftUI.css';

interface PieceInfoState {
  pieceType: PieceType;
  x: number;
  y: number;
}

interface OnlineDraftUIProps {
  playerColor: PlayerColor;
  budget: number;
  boardSize: BoardSize;
  timeRemaining: number | null;
  opponentReady: boolean;
  draftRevealed: boolean;
  whiteDraft: DraftPick[] | null;
  blackDraft: DraftPick[] | null;
  onSubmitDraft: (draft: DraftPick[]) => void;
}

export function OnlineDraftUI({
  playerColor,
  budget,
  boardSize,
  timeRemaining,
  opponentReady,
  draftRevealed,
  whiteDraft,
  blackDraft,
  onSubmitDraft,
}: OnlineDraftUIProps) {
  const [draft, setDraft] = useState<PlayerDraft>(createEmptyDraft());
  const [isLocked, setIsLocked] = useState(false);
  const [pieceInfo, setPieceInfo] = useState<PieceInfoState | null>(null);

  const slotLimits = getSlotLimits(boardSize);
  const budgetRemaining = budget - draft.budgetSpent;
  const totalPieces = getDraftPieceCount(draft);

  const piecesByTier = useMemo(() => ({
    pawn: ALL_PIECES.filter((p: PieceType) => p.tier === 'pawn'),
    piece: ALL_PIECES.filter((p: PieceType) => p.tier === 'piece'),
    royalty: ALL_PIECES.filter((p: PieceType) => p.tier === 'royalty'),
  }), []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddPiece = (pieceType: PieceType) => {
    if (isLocked) return;

    setDraft(current => {
      const existing = current.selections.find(s => s.pieceTypeId === pieceType.id);
      const tier = pieceType.tier;
      const newSlotsUsed = { ...current.slotsUsed };
      if (tier === 'pawn' || tier === 'piece' || tier === 'royalty') {
        newSlotsUsed[tier] = current.slotsUsed[tier] + 1;
      }

      return {
        ...current,
        budgetSpent: current.budgetSpent + pieceType.cost,
        slotsUsed: newSlotsUsed,
        selections: existing
          ? current.selections.map(s =>
              s.pieceTypeId === pieceType.id
                ? { ...s, count: s.count + 1 }
                : s
            )
          : [...current.selections, { pieceTypeId: pieceType.id, count: 1 }],
      };
    });
  };

  const handleRemovePiece = (pieceTypeId: string) => {
    if (isLocked) return;

    const pieceType = PIECE_BY_ID[pieceTypeId];
    if (!pieceType) return;

    setDraft(current => {
      const existing = current.selections.find(s => s.pieceTypeId === pieceTypeId);
      if (!existing) return current;

      const tier = pieceType.tier;
      const newSlotsUsed = { ...current.slotsUsed };
      if (tier === 'pawn' || tier === 'piece' || tier === 'royalty') {
        newSlotsUsed[tier] = current.slotsUsed[tier] - 1;
      }

      return {
        ...current,
        budgetSpent: current.budgetSpent - pieceType.cost,
        slotsUsed: newSlotsUsed,
        selections: existing.count > 1
          ? current.selections.map(s =>
              s.pieceTypeId === pieceTypeId
                ? { ...s, count: s.count - 1 }
                : s
            )
          : current.selections.filter(s => s.pieceTypeId !== pieceTypeId),
      };
    });
  };

  const handleLockIn = () => {
    if (isLocked) return;

    // Convert PlayerDraft to DraftPick[]
    const draftPicks: DraftPick[] = draft.selections.map(s => ({
      pieceTypeId: s.pieceTypeId,
      count: s.count,
    }));

    setIsLocked(true);
    onSubmitDraft(draftPicks);
  };

  const handlePieceRightClick = (piece: PieceType, e: React.MouseEvent) => {
    e.preventDefault();
    setPieceInfo({ pieceType: piece, x: e.clientX, y: e.clientY });
  };

  // If draft is revealed, show both armies
  if (draftRevealed && whiteDraft && blackDraft) {
    return (
      <div className="online-draft-reveal">
        <h2>Draft Revealed!</h2>
        <div className="reveal-armies">
          <DraftRevealArmy
            title="White's Army"
            draft={whiteDraft}
            isYou={playerColor === 'white'}
          />
          <DraftRevealArmy
            title="Black's Army"
            draft={blackDraft}
            isYou={playerColor === 'black'}
          />
        </div>
        <p className="transition-notice">Placement begins shortly...</p>
      </div>
    );
  }

  return (
    <div className="online-draft-ui">
      {/* Header with timer and status */}
      <div className="draft-header-online">
        <h2 className={`draft-title ${playerColor}`}>
          {playerColor === 'white' ? 'White' : 'Black'}'s Draft
        </h2>

        <div className="draft-status-row">
          {timeRemaining !== null && (
            <div className={`timer ${timeRemaining <= 30 ? 'warning' : ''}`}>
              {formatTime(timeRemaining)}
            </div>
          )}

          <div className="opponent-status">
            {opponentReady ? (
              <span className="ready">Opponent locked in</span>
            ) : (
              <span className="waiting">Opponent drafting...</span>
            )}
          </div>
        </div>

        <div className="draft-stats">
          <div className="stat budget-stat">
            <span className="stat-value">{budgetRemaining}</span>
            <span className="stat-label">/ {budget} pts</span>
          </div>
          <div className="stat">
            <span className="stat-value">{draft.slotsUsed.pawn}</span>
            <span className="stat-label">/ {slotLimits.pawn} pawns</span>
          </div>
          <div className="stat">
            <span className="stat-value">{draft.slotsUsed.piece}</span>
            <span className="stat-label">/ {slotLimits.piece} pieces</span>
          </div>
          <div className="stat">
            <span className="stat-value">{draft.slotsUsed.royalty}</span>
            <span className="stat-label">/ {slotLimits.royalty} royalty</span>
          </div>
        </div>
      </div>

      <div className="draft-content">
        {/* Available pieces */}
        <div className="available-pieces">
          <h3>Available Pieces</h3>

          {piecesByTier.pawn.length > 0 && (
            <TierSection
              title="Pawns"
              pieces={piecesByTier.pawn}
              draft={draft}
              budget={budget}
              boardSize={boardSize}
              isLocked={isLocked}
              onAddPiece={handleAddPiece}
              onRightClick={handlePieceRightClick}
            />
          )}

          {piecesByTier.piece.length > 0 && (
            <TierSection
              title="Pieces"
              pieces={piecesByTier.piece}
              draft={draft}
              budget={budget}
              boardSize={boardSize}
              isLocked={isLocked}
              onAddPiece={handleAddPiece}
              onRightClick={handlePieceRightClick}
            />
          )}

          {piecesByTier.royalty.length > 0 && (
            <TierSection
              title="Royalty"
              pieces={piecesByTier.royalty}
              draft={draft}
              budget={budget}
              boardSize={boardSize}
              isLocked={isLocked}
              onAddPiece={handleAddPiece}
              onRightClick={handlePieceRightClick}
            />
          )}
        </div>

        {/* Your army */}
        <div className="your-army">
          <h3>Your Army ({totalPieces} pieces)</h3>
          <div className="army-list">
            {!hasKingReplacer(draft) && (
              <div className="army-piece mandatory">
                <span className="piece-symbol">{PIECE_BY_ID['king']?.symbol || '♔'}</span>
                <span className="piece-name">King</span>
                <span className="piece-info">(free)</span>
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
                  <span className="piece-cost">
                    {pieceType.cost * selection.count} pts
                  </span>
                  {!isLocked && (
                    <button
                      className="remove-btn"
                      onClick={() => handleRemovePiece(selection.pieceTypeId)}
                      title="Remove one"
                    >
                      −
                    </button>
                  )}
                </div>
              );
            })}

            {draft.selections.length === 0 && (
              <div className="army-empty">
                Add pieces from the left panel
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with lock in button */}
      <div className="draft-footer">
        <button
          className={`lock-in-btn ${isLocked ? 'locked' : ''}`}
          onClick={handleLockIn}
          disabled={isLocked}
        >
          {isLocked ? 'Draft Locked In ✓' : 'Lock In Draft'}
        </button>
      </div>

      {pieceInfo && (
        <PieceInfoPopup
          pieceType={pieceInfo.pieceType}
          color={playerColor}
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
  isLocked: boolean;
  onAddPiece: (pieceType: PieceType) => void;
  onRightClick: (piece: PieceType, e: React.MouseEvent) => void;
}

function TierSection({
  title,
  pieces,
  draft,
  budget,
  boardSize,
  isLocked,
  onAddPiece,
  onRightClick,
}: TierSectionProps) {
  return (
    <div className="tier-section">
      <h4>{title}</h4>
      <div className="piece-list">
        {pieces.map((piece) => {
          const canAdd = !isLocked && canAddPiece(draft, piece, budget, boardSize);
          const countInDraft = getPieceCountInDraft(draft, piece.id);

          return (
            <button
              key={piece.id}
              className={`piece-btn ${!canAdd ? 'disabled' : ''}`}
              onClick={() => canAdd && onAddPiece(piece)}
              onContextMenu={(e) => onRightClick(piece, e)}
              disabled={!canAdd}
              title={`${piece.name} (${piece.cost} pts)`}
            >
              <span className="piece-symbol">{piece.symbol}</span>
              <span className="piece-name">{piece.name}</span>
              <span className="piece-cost">{piece.cost}</span>
              {countInDraft > 0 && (
                <span className="piece-count">x{countInDraft}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DraftRevealArmyProps {
  title: string;
  draft: DraftPick[];
  isYou: boolean;
}

function DraftRevealArmy({ title, draft, isYou }: DraftRevealArmyProps) {
  return (
    <div className={`reveal-army ${isYou ? 'you' : ''}`}>
      <h3>{title} {isYou && <span className="you-badge">(You)</span>}</h3>
      <div className="reveal-piece-list">
        {/* Always show King */}
        <div className="reveal-piece">
          <span className="piece-symbol">♔</span>
          <span className="piece-name">King</span>
        </div>

        {draft.map((pick) => {
          const pieceType = PIECE_BY_ID[pick.pieceTypeId];
          if (!pieceType) return null;

          return (
            <div key={pick.pieceTypeId} className="reveal-piece">
              <span className="piece-symbol">{pieceType.symbol}</span>
              <span className="piece-name">
                {pieceType.name}
                {pick.count > 1 && ` x${pick.count}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

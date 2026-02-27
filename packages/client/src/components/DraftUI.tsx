/**
 * Draft UI - piece selection interface for drafting
 */

import { useState } from 'react';
import type { PieceType, PlayerColor, BoardSize, PieceTier } from '../game/types';
import type { PlayerDraft } from '../game/rules/draft';
import {
  canAddPiece,
  getSlotLimits,
  getPieceCountInDraft,
  getDraftPieceCount,
  hasKingReplacer,
} from '../game/rules/draft';
import { PIECE_BY_ID } from '../game/pieces/pieceDefinitions';
import { PieceInfoPopup } from './PieceInfoPopup';
import './DraftUI.css';

interface PieceInfoState {
  pieceType: PieceType;
  x: number;
  y: number;
}

interface DraftUIProps {
  availablePieces: PieceType[];
  currentDraft: PlayerDraft;
  budget: number;
  boardSize: BoardSize;
  playerColor: PlayerColor;
  onAddPiece: (pieceType: PieceType) => void;
  onRemovePiece: (pieceTypeId: string) => void;
  onConfirmDraft: () => void;
}

export function DraftUI({
  availablePieces,
  currentDraft,
  budget,
  boardSize,
  playerColor,
  onAddPiece,
  onRemovePiece,
  onConfirmDraft,
}: DraftUIProps) {
  const [pieceInfo, setPieceInfo] = useState<PieceInfoState | null>(null);

  const slotLimits = getSlotLimits(boardSize);
  const budgetRemaining = budget - currentDraft.budgetSpent;
  const totalPieces = getDraftPieceCount(currentDraft);

  // Group available pieces by tier
  const piecesByTier = groupByTier(availablePieces);

  const handlePieceRightClick = (piece: PieceType, e: React.MouseEvent) => {
    e.preventDefault();
    setPieceInfo({ pieceType: piece, x: e.clientX, y: e.clientY });
  };

  return (
    <div className="draft-ui">
      <div className="draft-header">
        <h2 className={`draft-title ${playerColor}`}>
          {playerColor === 'white' ? 'White' : 'Black'}'s Draft
        </h2>
        <div className="draft-stats">
          <div className="stat budget-stat">
            <span className="stat-value">{budgetRemaining}</span>
            <span className="stat-label">/ {budget} pts</span>
          </div>
          <div className="stat">
            <span className="stat-value">{currentDraft.slotsUsed.pawn}</span>
            <span className="stat-label">/ {slotLimits.pawn} pawns</span>
          </div>
          <div className="stat">
            <span className="stat-value">{currentDraft.slotsUsed.piece}</span>
            <span className="stat-label">/ {slotLimits.piece} pieces</span>
          </div>
          <div className="stat">
            <span className="stat-value">{currentDraft.slotsUsed.royalty}</span>
            <span className="stat-label">/ {slotLimits.royalty} royalty</span>
          </div>
        </div>
      </div>

      <div className="draft-content">
        <div className="available-pieces">
          <h3>Available Pieces</h3>
          <div className="tier-container">
            {piecesByTier.pawn.length > 0 && (
              <TierSection
                title="Pawns"
                pieces={piecesByTier.pawn}
                draft={currentDraft}
                budget={budget}
                boardSize={boardSize}
                onAddPiece={onAddPiece}
                onRightClick={handlePieceRightClick}
              />
            )}

            {piecesByTier.piece.length > 0 && (
              <TierSection
                title="Pieces"
                pieces={piecesByTier.piece}
                draft={currentDraft}
                budget={budget}
                boardSize={boardSize}
                onAddPiece={onAddPiece}
                onRightClick={handlePieceRightClick}
              />
            )}

            {piecesByTier.royalty.length > 0 && (
              <TierSection
                title="Royalty"
                pieces={piecesByTier.royalty}
                draft={currentDraft}
                budget={budget}
                boardSize={boardSize}
                onAddPiece={onAddPiece}
                onRightClick={handlePieceRightClick}
              />
            )}
          </div>
        </div>

        <div className="your-army">
          <h3>Your Army ({totalPieces} pieces)</h3>
          <div className="army-list">
            {/* Show mandatory King only if no king-replacing piece is selected */}
            {!hasKingReplacer(currentDraft) && (
              <div className="army-piece mandatory">
                <span className="piece-symbol">{PIECE_BY_ID['king']?.symbol || '♔'}</span>
                <span className="piece-name">King</span>
                <span className="piece-info">(free)</span>
              </div>
            )}

            {/* Drafted pieces */}
            {currentDraft.selections.map((selection) => {
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
                  <button
                    className="remove-btn"
                    onClick={() => onRemovePiece(selection.pieceTypeId)}
                    title="Remove one"
                  >
                    −
                  </button>
                </div>
              );
            })}

            {currentDraft.selections.length === 0 && (
              <div className="army-empty">
                Add pieces from the left panel
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="draft-footer">
        <button
          className="confirm-btn"
          onClick={onConfirmDraft}
        >
          Confirm Draft
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
  onAddPiece: (pieceType: PieceType) => void;
  onRightClick: (piece: PieceType, e: React.MouseEvent) => void;
}

function TierSection({
  title,
  pieces,
  draft,
  budget,
  boardSize,
  onAddPiece,
  onRightClick,
}: TierSectionProps) {
  const tierClass = title.toLowerCase();
  return (
    <div className={`tier-section tier-${tierClass}`}>
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

function groupByTier(pieces: PieceType[]): Record<PieceTier, PieceType[]> {
  return {
    pawn: pieces.filter((p) => p.tier === 'pawn'),
    piece: pieces.filter((p) => p.tier === 'piece'),
    royalty: pieces.filter((p) => p.tier === 'royalty'),
    other: pieces.filter((p) => p.tier === 'other'),
  };
}

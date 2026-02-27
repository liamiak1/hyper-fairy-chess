/**
 * PieceInfoPopup - right-click popup showing piece details
 */

import type { PieceType, PlayerColor } from '../game/types';
import './PieceInfoPopup.css';

interface PieceInfoPopupProps {
  pieceType: PieceType;
  color?: PlayerColor;
  x: number;
  y: number;
  onClose: () => void;
}

export function PieceInfoPopup({
  pieceType,
  color = 'white',
  x,
  y,
  onClose,
}: PieceInfoPopupProps) {
  // Collect traits
  const traits: { label: string; type: 'positive' | 'negative' | 'special' }[] = [];

  if (pieceType.isRoyal) {
    traits.push({ label: 'Royal', type: 'special' });
  }
  if (pieceType.canCastle) {
    traits.push({ label: 'Can Castle', type: 'positive' });
  }
  if (pieceType.canFreeze) {
    traits.push({ label: 'Freezes', type: 'special' });
  }
  if (!pieceType.canBeCaptured) {
    traits.push({ label: 'Uncapturable', type: 'special' });
  }
  if (!pieceType.canBeJumpedOver) {
    traits.push({ label: 'Blocks Jumps', type: 'special' });
  }
  if (pieceType.captureType === 'none') {
    traits.push({ label: 'Cannot Capture', type: 'negative' });
  }
  if (pieceType.victoryPoints < 0) {
    traits.push({ label: 'Negative VP', type: 'negative' });
  }

  // Adjust position to stay on screen
  const adjustedX = Math.min(x, window.innerWidth - 320);
  const adjustedY = Math.min(y + 10, window.innerHeight - 200);

  return (
    <>
      {/* Backdrop to close on click outside */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
        }}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      <div
        className="piece-info-popup"
        style={{
          left: adjustedX,
          top: adjustedY,
        }}
      >
        <div className="piece-info-header">
          <span className={`piece-info-symbol ${color}`}>{pieceType.symbol}</span>
          <div className="piece-info-title">
            <h4 className="piece-info-name">{pieceType.name}</h4>
            <span className="piece-info-tier">{pieceType.tier}</span>
          </div>
        </div>

        <div className="piece-info-stats">
          <div className="piece-info-stat">
            <span className="piece-info-stat-value">{pieceType.cost}</span>
            <span className="piece-info-stat-label">cost</span>
          </div>
          <div className="piece-info-stat">
            <span className="piece-info-stat-value">{pieceType.victoryPoints}</span>
            <span className="piece-info-stat-label">VP</span>
          </div>
        </div>

        {pieceType.description && (
          <p className="piece-info-description">{pieceType.description}</p>
        )}

        {traits.length > 0 && (
          <div className="piece-info-traits">
            {traits.map((trait) => (
              <span key={trait.label} className={`piece-info-trait ${trait.type}`}>
                {trait.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Promotion dialog - allows user to select promotion piece
 */

import type { PieceType, PlayerColor } from '../game/types';
import './PromotionDialog.css';

interface PromotionDialogProps {
  options: PieceType[];
  color: PlayerColor;
  onSelect: (pieceTypeId: string) => void;
  onCancel: () => void;
}

export function PromotionDialog({
  options,
  color,
  onSelect,
  onCancel,
}: PromotionDialogProps) {
  return (
    <div className="promotion-overlay" onClick={onCancel}>
      <div className="promotion-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Choose promotion piece</h3>
        <div className="promotion-options">
          {options.map((pieceType) => (
            <button
              key={pieceType.id}
              className={`promotion-option ${color}`}
              onClick={() => onSelect(pieceType.id)}
              title={pieceType.name}
            >
              <span className="piece-symbol">{pieceType.symbol}</span>
              <span className="piece-name">{pieceType.name}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-secondary cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

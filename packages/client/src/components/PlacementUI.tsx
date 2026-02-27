/**
 * Placement UI - piece selection panel for placement phase
 */

import type { PieceInstance, PlayerColor, PieceTier } from '../game/types';
import { PIECE_BY_ID } from '../game/pieces/pieceDefinitions';
import './PlacementUI.css';

interface PlacementUIProps {
  piecesToPlace: PieceInstance[];
  selectedPiece: PieceInstance | null;
  onSelectPiece: (piece: PieceInstance) => void;
  currentPlacer: PlayerColor;
  whitePiecesRemaining: number;
  blackPiecesRemaining: number;
}

export function PlacementUI({
  piecesToPlace,
  selectedPiece,
  onSelectPiece,
  currentPlacer,
  whitePiecesRemaining,
  blackPiecesRemaining,
}: PlacementUIProps) {
  // Group pieces by tier
  const piecesByTier = groupPiecesByTier(piecesToPlace);

  return (
    <div className="placement-ui">
      <div className="placement-header">
        <h3>Placement Phase</h3>
        <div className={`placer-indicator ${currentPlacer}`}>
          {currentPlacer === 'white' ? 'White' : 'Black'}'s turn to place
        </div>
      </div>

      <div className="pieces-remaining">
        <span className="white-remaining">White: {whitePiecesRemaining}</span>
        <span className="black-remaining">Black: {blackPiecesRemaining}</span>
      </div>

      <div className="placement-instructions">
        Select a piece, then click on the board to place it
      </div>

      <div className="pieces-to-place">
        {/* Royalty tier */}
        {piecesByTier.royalty.length > 0 && (
          <div className="tier-group">
            <h4>Royalty</h4>
            <div className="piece-list">
              {piecesByTier.royalty.map((piece) => (
                <PieceButton
                  key={piece.id}
                  piece={piece}
                  isSelected={selectedPiece?.id === piece.id}
                  onClick={() => onSelectPiece(piece)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pieces tier */}
        {piecesByTier.piece.length > 0 && (
          <div className="tier-group">
            <h4>Pieces</h4>
            <div className="piece-list">
              {piecesByTier.piece.map((piece) => (
                <PieceButton
                  key={piece.id}
                  piece={piece}
                  isSelected={selectedPiece?.id === piece.id}
                  onClick={() => onSelectPiece(piece)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pawns tier */}
        {piecesByTier.pawn.length > 0 && (
          <div className="tier-group">
            <h4>Pawns</h4>
            <div className="piece-list">
              {piecesByTier.pawn.map((piece) => (
                <PieceButton
                  key={piece.id}
                  piece={piece}
                  isSelected={selectedPiece?.id === piece.id}
                  onClick={() => onSelectPiece(piece)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PieceButtonProps {
  piece: PieceInstance;
  isSelected: boolean;
  onClick: () => void;
}

function PieceButton({ piece, isSelected, onClick }: PieceButtonProps) {
  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return null;

  return (
    <button
      className={`piece-button ${piece.owner} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      title={`${pieceType.name}${pieceType.description ? '\n' + pieceType.description : ''}`}
    >
      <span className="piece-symbol">{pieceType.symbol}</span>
    </button>
  );
}

function groupPiecesByTier(pieces: PieceInstance[]): Record<PieceTier, PieceInstance[]> {
  const groups: Record<PieceTier, PieceInstance[]> = {
    royalty: [],
    piece: [],
    pawn: [],
    other: [],
  };

  for (const piece of pieces) {
    const pieceType = PIECE_BY_ID[piece.typeId];
    if (pieceType) {
      groups[pieceType.tier].push(piece);
    }
  }

  return groups;
}

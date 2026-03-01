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
  playerColor?: PlayerColor;
  whitePiecesRemaining: number;
  blackPiecesRemaining: number;
}

export function PlacementUI({
  piecesToPlace,
  selectedPiece,
  onSelectPiece,
  currentPlacer,
  playerColor,
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
          {playerColor
            ? (currentPlacer === playerColor ? 'Your' : "Opponent's")
            : (currentPlacer === 'white' ? "White's" : "Black's")} turn to place
        </div>
      </div>

      <div className="pieces-remaining">
        <span className="white-remaining">White: {whitePiecesRemaining}</span>
        <span className="black-remaining">Black: {blackPiecesRemaining}</span>
      </div>

      <div className="placement-instructions">
        Select a piece, then click on the board to place it
      </div>

      {/* Your pieces */}
      <div className="pieces-section your-pieces">
        <h4 className="section-title">Your Pieces</h4>
        <div className="pieces-to-place">
          <PieceTierGroup
            tier="Royalty"
            pieces={piecesByTier.royalty}
            selectedPiece={selectedPiece}
            onSelectPiece={onSelectPiece}
            isInteractive={true}
          />
          <PieceTierGroup
            tier="Pieces"
            pieces={piecesByTier.piece}
            selectedPiece={selectedPiece}
            onSelectPiece={onSelectPiece}
            isInteractive={true}
          />
          <PieceTierGroup
            tier="Pawns"
            pieces={piecesByTier.pawn}
            selectedPiece={selectedPiece}
            onSelectPiece={onSelectPiece}
            isInteractive={true}
          />
        </div>
      </div>
    </div>
  );
}

interface PieceTierGroupProps {
  tier: string;
  pieces: PieceInstance[];
  selectedPiece: PieceInstance | null;
  onSelectPiece: (piece: PieceInstance) => void;
  isInteractive: boolean;
}

function PieceTierGroup({ tier, pieces, selectedPiece, onSelectPiece, isInteractive }: PieceTierGroupProps) {
  if (pieces.length === 0) return null;

  return (
    <div className="tier-group">
      <h4>{tier}</h4>
      <div className="piece-list">
        {pieces.map((piece) => (
          <PieceButton
            key={piece.id}
            piece={piece}
            isSelected={selectedPiece?.id === piece.id}
            onClick={() => isInteractive && onSelectPiece(piece)}
            isInteractive={isInteractive}
          />
        ))}
      </div>
    </div>
  );
}

interface PieceButtonProps {
  piece: PieceInstance;
  isSelected: boolean;
  onClick: () => void;
  isInteractive?: boolean;
}

function PieceButton({ piece, isSelected, onClick, isInteractive = true }: PieceButtonProps) {
  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return null;

  return (
    <button
      className={`piece-button ${piece.owner} ${isSelected ? 'selected' : ''} ${!isInteractive ? 'non-interactive' : ''}`}
      onClick={onClick}
      disabled={!isInteractive}
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

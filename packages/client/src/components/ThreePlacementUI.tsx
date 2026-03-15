/**
 * Placement sidebar for 3-player mode.
 */

import type { ThreePiece, Section } from '@hyper-fairy-chess/shared';
import { PIECE_BY_ID } from '@hyper-fairy-chess/shared';
import type { ThreePlacementState } from '@hyper-fairy-chess/shared';
import './PlacementUI.css';

interface ThreePlacementUIProps {
  placementState: ThreePlacementState;
  selectedPiece: ThreePiece | null;
  onSelectPiece: (piece: ThreePiece) => void;
}

export function ThreePlacementUI({
  placementState,
  selectedPiece,
  onSelectPiece,
}: ThreePlacementUIProps) {
  const placer = placementState.currentPlacer;
  const piecesToPlace = getPiecesForPlacer(placementState, placer);

  const colorName = { white: 'White', red: 'Red', black: 'Black' }[placer];

  return (
    <div className="placement-ui">
      <div className="placement-header">
        <h3>Placement Phase</h3>
        <div className={`placer-indicator ${placer}`}>{colorName}'s turn to place</div>
      </div>

      <div className="pieces-remaining">
        <span className="white-remaining">White: {placementState.whitePiecesToPlace.length}</span>
        <span className="red-remaining">Red: {placementState.redPiecesToPlace.length}</span>
        <span className="black-remaining">Black: {placementState.blackPiecesToPlace.length}</span>
      </div>

      <div className="placement-instructions">
        Select a piece below, then click a highlighted square on the board.
      </div>

      <div className="pieces-section your-pieces">
        <h4 className="section-title">Your Pieces</h4>
        <div className="piece-list" style={{ gridTemplateColumns: 'repeat(4, 54px)', gap: '8px' }}>
          {piecesToPlace.map((piece) => {
            const pt = PIECE_BY_ID[piece.typeId];
            const isSelected = selectedPiece?.id === piece.id;
            return (
              <button
                key={piece.id}
                className={`piece-button ${isSelected ? 'selected' : ''} ${placer}`}
                onClick={() => onSelectPiece(piece)}
                title={pt?.name ?? piece.typeId}
                style={{ width: 54, height: 54 }}
              >
                <span className="piece-symbol">{pt?.symbol ?? '?'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getPiecesForPlacer(ps: ThreePlacementState, section: Section): ThreePiece[] {
  switch (section) {
    case 'white': return ps.whitePiecesToPlace;
    case 'red': return ps.redPiecesToPlace;
    case 'black': return ps.blackPiecesToPlace;
  }
}

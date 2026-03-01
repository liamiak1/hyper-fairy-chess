/**
 * Opponent Pieces Panel - shows opponent's remaining pieces during placement
 */

import type { PieceInstance, PlayerColor, PieceTier } from '../game/types';
import { PIECE_BY_ID } from '../game/pieces/pieceDefinitions';
import './OpponentPiecesPanel.css';

interface OpponentPiecesPanelProps {
  pieces: PieceInstance[];
  opponentColor: PlayerColor;
  piecesRemaining: number;
}

export function OpponentPiecesPanel({
  pieces,
  opponentColor,
  piecesRemaining,
}: OpponentPiecesPanelProps) {
  const piecesByTier = groupPiecesByTier(pieces);

  return (
    <div className={`opponent-pieces-panel ${opponentColor}`}>
      <div className="panel-header">
        <h4>Opponent's Pieces</h4>
        <span className="pieces-count">{piecesRemaining} remaining</span>
      </div>

      <div className="pieces-grid">
        {piecesByTier.royalty.length > 0 && (
          <TierGroup tier="Royalty" pieces={piecesByTier.royalty} />
        )}
        {piecesByTier.piece.length > 0 && (
          <TierGroup tier="Pieces" pieces={piecesByTier.piece} />
        )}
        {piecesByTier.pawn.length > 0 && (
          <TierGroup tier="Pawns" pieces={piecesByTier.pawn} />
        )}
      </div>

      {pieces.length === 0 && (
        <div className="all-placed">All pieces placed</div>
      )}
    </div>
  );
}

interface TierGroupProps {
  tier: string;
  pieces: PieceInstance[];
}

function TierGroup({ tier, pieces }: TierGroupProps) {
  return (
    <div className="tier-group">
      <div className="tier-label">{tier}</div>
      <div className="piece-list">
        {pieces.map((piece) => {
          const pieceType = PIECE_BY_ID[piece.typeId];
          if (!pieceType) return null;
          return (
            <div
              key={piece.id}
              className={`piece-chip ${piece.owner}`}
              title={pieceType.name}
            >
              {pieceType.symbol}
            </div>
          );
        })}
      </div>
    </div>
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

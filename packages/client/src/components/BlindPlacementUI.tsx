/**
 * Blind Placement UI - simultaneous hidden placement phase
 */

import { useState } from 'react';
import type { PieceInstance, PlayerColor, Position, BoardSize, PieceTier } from '../game/types';
import { BOARD_CONFIGS } from '../game/types';
import { PIECE_BY_ID } from '../game/pieces/pieceDefinitions';
import { getPlacementZones, getValidPlacementSquares } from '../game/rules/placement';
import { Board } from './Board';
import './BlindPlacementUI.css';

interface BlindPlacementUIProps {
  playerColor: PlayerColor;
  piecesToPlace: PieceInstance[];
  myPlacedPieces: Array<{ pieceId: string; typeId: string; position: Position }>;
  opponentArmy: PieceInstance[]; // Opponent's drafted pieces (for display)
  boardSize: BoardSize;
  myReady: boolean;
  opponentReady: boolean;
  onPlacePiece: (pieceId: string, position: Position) => void;
  onUnplacePiece: (pieceId: string) => void;
  onReady: () => void;
  onCancelReady: () => void;
  onPieceRightClick?: (pieceTypeId: string, color: PlayerColor, x: number, y: number) => void;
  roomCode: string;
}

export function BlindPlacementUI({
  playerColor,
  piecesToPlace,
  myPlacedPieces,
  opponentArmy,
  boardSize,
  myReady,
  opponentReady,
  onPlacePiece,
  onUnplacePiece,
  onReady,
  onCancelReady,
  onPieceRightClick,
  roomCode,
}: BlindPlacementUIProps) {
  const [selectedPiece, setSelectedPiece] = useState<PieceInstance | null>(null);

  const boardConfig = BOARD_CONFIGS[boardSize];

  // Build the board pieces from my placed pieces (only my pieces are visible)
  // The typeId is now sent directly from the server, no parsing needed
  const boardPieces: PieceInstance[] = myPlacedPieces.map(({ pieceId, typeId, position }) => {
    return {
      id: pieceId,
      typeId,
      owner: playerColor,
      position,
      hasMoved: false,
      isFrozen: false,
    };
  });

  // Calculate valid placement squares
  let validPlacementSquares: Position[] = [];
  if (selectedPiece && !myReady) {
    try {
      const zones = getPlacementZones(boardSize, playerColor);
      const positionMap = new Map<string, string>();
      for (const piece of boardPieces) {
        if (piece.position) {
          positionMap.set(`${piece.position.file}${piece.position.rank}`, piece.id);
        }
      }
      const board = {
        pieces: boardPieces,
        positionMap,
        dimensions: { files: boardConfig.files, ranks: boardConfig.ranks },
      };
      validPlacementSquares = getValidPlacementSquares(
        board,
        selectedPiece,
        zones,
        { ranks: boardConfig.ranks }
      );
    } catch (err) {
      console.error('Error calculating placement squares:', err);
    }
  }

  const handleSquareClick = (position: Position) => {
    if (myReady || !selectedPiece) return;

    // Check if clicking on a placed piece to unplace it
    const clickedPiece = myPlacedPieces.find(
      p => {
        const piecePos = boardPieces.find(bp => bp.id === p.pieceId)?.position;
        return piecePos && piecePos.file === position.file && piecePos.rank === position.rank;
      }
    );

    if (clickedPiece) {
      onUnplacePiece(clickedPiece.pieceId);
      return;
    }

    // Check if valid placement
    const isValid = validPlacementSquares.some(
      sq => sq.file === position.file && sq.rank === position.rank
    );
    if (isValid) {
      onPlacePiece(selectedPiece.id, position);
      setSelectedPiece(null);
    }
  };

  const allPiecesPlaced = piecesToPlace.length === 0;

  // Group pieces by tier
  const piecesByTier = groupPiecesByTier(piecesToPlace);
  const opponentPiecesByTier = groupPiecesByTier(opponentArmy);

  return (
    <div className="blind-placement-container">
      <div className="blind-placement-header">
        <h2>Blind Placement</h2>
        <div className="room-info">Room: {roomCode}</div>
      </div>

      <div className="blind-placement-status">
        {myReady && !opponentReady && (
          <div className="waiting-banner">
            Waiting for opponent to finish placing...
          </div>
        )}
        {!myReady && opponentReady && (
          <div className="opponent-ready-banner">
            Opponent is ready!
          </div>
        )}
      </div>

      <div className="blind-placement-main">
        {/* Left Panel - Opponent's Army */}
        <div className="opponent-army-panel">
          <h3>Opponent's Army</h3>
          <p className="panel-subtitle">
            {opponentArmy.length} pieces drafted
          </p>
          <div className="army-pieces">
            <ArmyTierGroup tier="Royalty" pieces={opponentPiecesByTier.royalty} />
            <ArmyTierGroup tier="Pieces" pieces={opponentPiecesByTier.piece} />
            <ArmyTierGroup tier="Pawns" pieces={opponentPiecesByTier.pawn} />
          </div>
          <div className="opponent-status">
            <span className={`ready-indicator ${opponentReady ? 'ready' : 'placing'}`}>
              {opponentReady ? 'Ready' : 'Placing...'}
            </span>
          </div>
        </div>

        {/* Center - Board */}
        <div className="board-wrapper">
          <Board
            size={boardSize}
            pieces={boardPieces}
            selectedSquare={null}
            validMoves={[]}
            onSquareClick={handleSquareClick}
            lastMove={null}
            validPlacementSquares={validPlacementSquares}
            isPlacementMode={true}
            specialCaptureTargets={[]}
            currentTurn={playerColor}
            onPieceRightClick={onPieceRightClick}
            flipped={playerColor === 'black'}
          />
        </div>

        {/* Right Panel - My Pieces */}
        <div className="my-pieces-panel">
          <h3>My Pieces</h3>

          {!myReady ? (
            <>
              <p className="panel-subtitle">
                {piecesToPlace.length} remaining to place
              </p>

              <div className="pieces-to-place">
                <PieceTierGroup
                  tier="Royalty"
                  pieces={piecesByTier.royalty}
                  selectedPiece={selectedPiece}
                  onSelectPiece={setSelectedPiece}
                />
                <PieceTierGroup
                  tier="Pieces"
                  pieces={piecesByTier.piece}
                  selectedPiece={selectedPiece}
                  onSelectPiece={setSelectedPiece}
                />
                <PieceTierGroup
                  tier="Pawns"
                  pieces={piecesByTier.pawn}
                  selectedPiece={selectedPiece}
                  onSelectPiece={setSelectedPiece}
                />
              </div>

              {myPlacedPieces.length > 0 && (
                <div className="placed-pieces-section">
                  <h4>Placed ({myPlacedPieces.length})</h4>
                  <div className="placed-piece-list">
                    {myPlacedPieces.map(({ pieceId }) => {
                      const typeId = pieceId.split('-')[1];
                      const pieceType = PIECE_BY_ID[typeId];
                      return (
                        <button
                          key={pieceId}
                          className="placed-piece-item"
                          onClick={() => onUnplacePiece(pieceId)}
                          title={`Click to unplace ${pieceType?.name || typeId}`}
                        >
                          <span className="piece-symbol">{pieceType?.symbol || '?'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                className="btn-ready"
                onClick={onReady}
                disabled={!allPiecesPlaced}
              >
                {allPiecesPlaced ? 'Ready!' : `Place ${piecesToPlace.length} more`}
              </button>
            </>
          ) : (
            <>
              <p className="panel-subtitle">
                All pieces placed!
              </p>
              <div className="ready-status">
                <span className="ready-badge">Ready</span>
              </div>
              <button
                className="btn-cancel-ready"
                onClick={onCancelReady}
              >
                Cancel (make changes)
              </button>
            </>
          )}
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
}

function PieceTierGroup({ tier, pieces, selectedPiece, onSelectPiece }: PieceTierGroupProps) {
  if (pieces.length === 0) return null;

  return (
    <div className="tier-group">
      <h4>{tier}</h4>
      <div className="piece-list">
        {pieces.map((piece) => {
          const pieceType = PIECE_BY_ID[piece.typeId];
          if (!pieceType) return null;
          return (
            <button
              key={piece.id}
              className={`piece-button ${piece.owner} ${selectedPiece?.id === piece.id ? 'selected' : ''}`}
              onClick={() => onSelectPiece(piece)}
              title={pieceType.name}
            >
              <span className="piece-symbol">{pieceType.symbol}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ArmyTierGroupProps {
  tier: string;
  pieces: PieceInstance[];
}

function ArmyTierGroup({ tier, pieces }: ArmyTierGroupProps) {
  if (pieces.length === 0) return null;

  // Group by piece type and count
  const pieceCounts: Record<string, { symbol: string; count: number }> = {};
  for (const piece of pieces) {
    const pieceType = PIECE_BY_ID[piece.typeId];
    if (pieceType) {
      if (!pieceCounts[piece.typeId]) {
        pieceCounts[piece.typeId] = { symbol: pieceType.symbol, count: 0 };
      }
      pieceCounts[piece.typeId].count++;
    }
  }

  return (
    <div className="army-tier-group">
      <h4>{tier}</h4>
      <div className="army-piece-list">
        {Object.entries(pieceCounts).map(([typeId, { symbol, count }]) => (
          <span key={typeId} className="army-piece">
            <span className="army-piece-symbol">{symbol}</span>
            {count > 1 && <span className="army-piece-count">x{count}</span>}
          </span>
        ))}
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

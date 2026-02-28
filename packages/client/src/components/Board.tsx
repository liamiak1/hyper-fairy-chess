/**
 * Chess board component
 */

import type { BoardSize, Position, PieceInstance, Move, PlayerColor } from '../game/types';
import { BOARD_CONFIGS, positionToString } from '../game/types';
import { PIECE_BY_ID } from '../game/pieces/pieceDefinitions';
import './Board.css';

interface SpecialCaptureTarget {
  position: Position;
  movePosition: Position; // The move that causes this capture
}

interface BoardProps {
  size: BoardSize;
  pieces: PieceInstance[];
  selectedSquare: Position | null;
  validMoves: Position[];
  onSquareClick: (position: Position) => void;
  lastMove?: Move | null;
  validPlacementSquares?: Position[];
  isPlacementMode?: boolean;
  specialCaptureTargets?: SpecialCaptureTarget[];
  hoveredMove?: Position | null;
  onSquareHover?: (position: Position | null) => void;
  currentTurn?: PlayerColor;
  onPieceRightClick?: (pieceTypeId: string, color: PlayerColor, x: number, y: number) => void;
  flipped?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const;

export function Board({
  size,
  pieces,
  selectedSquare,
  validMoves,
  onSquareClick,
  lastMove,
  validPlacementSquares = [],
  isPlacementMode: _isPlacementMode = false,
  specialCaptureTargets = [],
  hoveredMove = null,
  onSquareHover,
  currentTurn,
  onPieceRightClick,
  flipped = false,
}: BoardProps) {
  const config = BOARD_CONFIGS[size];
  const baseFiles = FILES.slice(0, config.files);
  const baseRanks = Array.from({ length: config.ranks }, (_, i) => config.ranks - i);

  // Flip board for black player (reverse both files and ranks)
  const files = flipped ? [...baseFiles].reverse() : baseFiles;
  const ranks = flipped ? [...baseRanks].reverse() : baseRanks;

  // Create position -> piece lookup
  const pieceMap = new Map<string, PieceInstance>();
  for (const piece of pieces) {
    if (piece.position) {
      pieceMap.set(positionToString(piece.position), piece);
    }
  }

  // Create valid moves set for quick lookup
  const validMoveSet = new Set(validMoves.map(positionToString));

  // Get selected piece's owner for determining swap vs capture
  const selectedPiece = selectedSquare ? pieceMap.get(positionToString(selectedSquare)) : null;
  const selectedPieceOwner = selectedPiece?.owner;

  // Create valid placement squares set for quick lookup
  const validPlacementSet = new Set(validPlacementSquares.map(positionToString));

  // Create special capture targets set for quick lookup (only for hovered move)
  const hoveredMoveKey = hoveredMove ? positionToString(hoveredMove) : null;
  const specialCaptureSet = new Set(
    specialCaptureTargets
      .filter((t) => positionToString(t.movePosition) === hoveredMoveKey)
      .map((t) => positionToString(t.position))
  );

  // Last move squares
  const lastMoveFromKey = lastMove ? positionToString(lastMove.from) : null;
  const lastMoveToKey = lastMove ? positionToString(lastMove.to) : null;

  const isLightSquare = (fileIndex: number, rank: number): boolean => {
    return (fileIndex + rank) % 2 === 1;
  };

  const turnClass = currentTurn ? `${currentTurn}-turn` : '';

  return (
    <div className={`board-container ${turnClass}`}>
      <div
        className="board"
        style={{
          gridTemplateColumns: `repeat(${config.files}, 1fr)`,
          gridTemplateRows: `repeat(${config.ranks}, 1fr)`,
        }}
      >
        {ranks.map((rank) =>
          files.map((file, fileIndex) => {
            const position: Position = { file, rank: rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 };
            const posKey = positionToString(position);
            const piece = pieceMap.get(posKey);
            const pieceType = piece ? PIECE_BY_ID[piece.typeId] : null;

            const isSelected =
              selectedSquare &&
              selectedSquare.file === file &&
              selectedSquare.rank === rank;
            const isValidMove = validMoveSet.has(posKey);
            const isLastMoveSquare = posKey === lastMoveFromKey || posKey === lastMoveToKey;
            const isValidPlacement = validPlacementSet.has(posKey);
            const isSpecialCaptureTarget = specialCaptureSet.has(posKey);

            // Determine if this is a capturable piece (valid move target with enemy piece)
            // or a swap target (valid move target with friendly piece)
            const isCapture = isValidMove && piece !== undefined && piece.owner !== selectedPieceOwner;
            const isSwap = isValidMove && piece !== undefined && piece.owner === selectedPieceOwner;

            return (
              <div
                key={posKey}
                className={`square ${isLightSquare(fileIndex, rank) ? 'light' : 'dark'} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isLastMoveSquare ? 'last-move' : ''} ${isValidPlacement ? 'valid-placement' : ''} ${isCapture ? 'capturable' : ''} ${isSwap ? 'swap-target' : ''} ${isSpecialCaptureTarget ? 'special-capture-target' : ''}`}
                onClick={() => onSquareClick(position)}
                onMouseEnter={() => isValidMove && onSquareHover?.(position)}
                onMouseLeave={() => isValidMove && onSquareHover?.(null)}
                onContextMenu={(e) => {
                  if (piece && onPieceRightClick) {
                    e.preventDefault();
                    onPieceRightClick(piece.typeId, piece.owner, e.clientX, e.clientY);
                  }
                }}
              >
                {piece && pieceType && (
                  <div
                    className={`piece ${piece.owner} ${piece.isFrozen ? 'frozen' : ''} ${isCapture ? 'piece-capturable' : ''} ${isSwap ? 'piece-swap' : ''} ${isSpecialCaptureTarget ? 'piece-special-capture' : ''}`}
                    title={`${pieceType.name} (${piece.owner})`}
                  >
                    {pieceType.symbol}
                  </div>
                )}
                {isValidMove && !piece && <div className="move-indicator" />}
                {isValidPlacement && !piece && <div className="placement-indicator" />}
              </div>
            );
          })
        )}
      </div>

      {/* File labels */}
      <div
        className="file-labels"
        style={{ gridTemplateColumns: `repeat(${config.files}, 1fr)` }}
      >
        {files.map((file) => (
          <div key={file} className="label">
            {file}
          </div>
        ))}
      </div>

      {/* Rank labels */}
      <div
        className="rank-labels"
        style={{ gridTemplateRows: `repeat(${config.ranks}, 1fr)` }}
      >
        {ranks.map((rank) => (
          <div key={rank} className="label">
            {rank}
          </div>
        ))}
      </div>
    </div>
  );
}


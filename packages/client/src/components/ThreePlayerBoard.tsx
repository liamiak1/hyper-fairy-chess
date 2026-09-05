/**
 * Board for the folded 3-player game.
 *
 * The board is three 8x4 sections joined at the centre, and that join cannot be
 * drawn faithfully on a flat page: each section's inner rank folds onto halves
 * of BOTH its neighbours, so no flat arrangement puts every pair of joined
 * squares next to each other.
 *
 * Rather than pick a pretty layout that quietly lies about which squares touch,
 * the three sections are drawn as three plain grids and the join is labelled:
 * under each inner rank, a band says which section that half folds into. The
 * highlighting does the rest — select a piece and its legal moves light up
 * across all three grids, wherever they land.
 */

import type { Position, PieceInstance, Move, PlayerColor } from '@hyper-fairy-chess/shared';
import { positionToString, PIECE_BY_ID, THREE_PLAYER_SEATS } from '@hyper-fairy-chess/shared';
import './ThreePlayerBoard.css';

interface SpecialCaptureTarget {
  position: Position;
  movePosition: Position;
}

interface ThreePlayerBoardProps {
  pieces: PieceInstance[];
  selectedSquare: Position | null;
  validMoves: Position[];
  onSquareClick: (position: Position) => void;
  lastMove?: Move | null;
  validPlacementSquares?: Position[];
  specialCaptureTargets?: SpecialCaptureTarget[];
  hoveredMove?: Position | null;
  onSquareHover?: (position: Position | null) => void;
  currentTurn?: PlayerColor;
  onPieceRightClick?: (pieceTypeId: string, color: PlayerColor, x: number, y: number) => void;
  isViewingEnemy?: boolean;
}

const SECTION_LABEL: Record<PlayerColor, string> = {
  white: 'White',
  black: 'Black',
  red: 'Red',
  blue: 'Blue',
};

/** Files a..x, eight per section. */
function fileOf(section: number, local: number): string {
  return String.fromCharCode(97 + section * 8 + local);
}

/**
 * Which section each half of an inner rank folds into.
 * Right half (local 4-7) joins the next section round; left half the previous.
 */
function foldTargets(section: number): { left: PlayerColor; right: PlayerColor } {
  return {
    left: THREE_PLAYER_SEATS[(section + 2) % 3],
    right: THREE_PLAYER_SEATS[(section + 1) % 3],
  };
}

export function ThreePlayerBoard({
  pieces,
  selectedSquare,
  validMoves,
  onSquareClick,
  lastMove,
  validPlacementSquares = [],
  specialCaptureTargets = [],
  hoveredMove = null,
  onSquareHover,
  currentTurn,
  onPieceRightClick,
  isViewingEnemy = false,
}: ThreePlayerBoardProps) {
  const pieceMap = new Map<string, PieceInstance>();
  for (const piece of pieces) {
    if (piece.position) pieceMap.set(positionToString(piece.position), piece);
  }

  const validMoveSet = new Set(validMoves.map(positionToString));
  const validPlacementSet = new Set(validPlacementSquares.map(positionToString));

  const selectedPiece = selectedSquare
    ? pieceMap.get(positionToString(selectedSquare))
    : null;
  const selectedPieceOwner = selectedPiece?.owner;

  const hoveredMoveKey = hoveredMove ? positionToString(hoveredMove) : null;
  const specialCaptureSet = new Set(
    specialCaptureTargets
      .filter((t) => positionToString(t.movePosition) === hoveredMoveKey)
      .map((t) => positionToString(t.position))
  );

  const lastMoveFromKey = lastMove ? positionToString(lastMove.from) : null;
  const lastMoveToKey = lastMove ? positionToString(lastMove.to) : null;

  const renderSection = (section: number) => {
    const owner: PlayerColor = THREE_PLAYER_SEATS[section];
    const folds = foldTargets(section);

    // Rank 4 (the inner rank, at the fold) is drawn nearest the join, so ranks
    // run 1 at the far edge down to 4 at the near edge.
    const ranks = [1, 2, 3, 4];

    return (
      <div className={`tp-section tp-section-${owner}`} key={owner}>
        <div className="tp-section-header">
          <span className={`tp-owner tp-owner-${owner}`}>{SECTION_LABEL[owner]}</span>
          <span className="tp-section-files">
            files {fileOf(section, 0)}–{fileOf(section, 7)}
          </span>
        </div>

        <div className="tp-grid">
          {ranks.map((rank) =>
            Array.from({ length: 8 }, (_, local) => {
              const file = fileOf(section, local);
              const position = { file, rank } as unknown as Position;
              const posKey = `${file}${rank}`;

              const piece = pieceMap.get(posKey);
              const pieceType = piece ? PIECE_BY_ID[piece.typeId] : null;

              const isSelected =
                selectedSquare != null &&
                selectedSquare.file === file &&
                selectedSquare.rank === rank;
              const isValidMove = validMoveSet.has(posKey);
              const isValidPlacement = validPlacementSet.has(posKey);
              const isLastMoveSquare =
                posKey === lastMoveFromKey || posKey === lastMoveToKey;
              const isSpecialCaptureTarget = specialCaptureSet.has(posKey);

              const isCapture =
                isValidMove && piece !== undefined && piece.owner !== selectedPieceOwner;
              const isSwap =
                isValidMove && piece !== undefined && piece.owner === selectedPieceOwner;

              const classes = [
                'tp-square',
                (local + rank) % 2 === 1 ? 'light' : 'dark',
                rank === 4 ? 'inner-rank' : '',
                isSelected ? 'selected' : '',
                isValidMove ? 'valid-move' : '',
                isValidPlacement ? 'valid-placement' : '',
                isLastMoveSquare ? 'last-move' : '',
                isCapture ? 'capturable' : '',
                isSwap ? 'swap-target' : '',
                isSpecialCaptureTarget ? 'special-capture-target' : '',
                isViewingEnemy && isValidMove ? 'viewing-enemy' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={posKey}
                  className={classes}
                  title={posKey}
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
                  <span className="tp-coord">{posKey}</span>
                  {piece && pieceType && (
                    <div
                      className={`tp-piece ${piece.owner} ${piece.isFrozen ? 'frozen' : ''}`}
                      title={`${pieceType.name} (${piece.owner})`}
                    >
                      {pieceType.symbol}
                    </div>
                  )}
                  {isValidMove && !piece && <div className="tp-move-dot" />}
                  {isValidPlacement && !piece && <div className="tp-place-dot" />}
                </div>
              );
            })
          )}
        </div>

        {/* Which section each half of the inner rank folds into */}
        <div className="tp-fold-band">
          <div className={`tp-fold tp-fold-${folds.left}`}>
            ↑ folds into {SECTION_LABEL[folds.left]}
          </div>
          <div className={`tp-fold tp-fold-${folds.right}`}>
            ↑ folds into {SECTION_LABEL[folds.right]}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`tp-board ${currentTurn ? `${currentTurn}-turn` : ''}`}>
      <p className="tp-explainer">
        Three 8×4 sections joined at the centre. Pawns advance towards rank 4,
        cross the join into an opponent&rsquo;s section, and promote on their
        rank 1. The join cannot be drawn flat, so each half of an inner rank is
        labelled with the section it folds into.
      </p>
      {[0, 1, 2].map(renderSection)}
    </div>
  );
}

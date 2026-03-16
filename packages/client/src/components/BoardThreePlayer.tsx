/**
 * SVG board for 3-player GreenChess.
 *
 * Three 8×4 sections fan out as annular trapezoids from a central hub.
 * srank=4 = seam (inner edge), srank=1 = back rank (outer edge).
 * White = bottom (30°–150°), Black = upper-right (150°–270°), Red = upper-left (270°–30°).
 */

import type {
  ThreeGameState,
  ThreePos,
  ThreePiece,
  Section,
} from '@hyper-fairy-chess/shared';
import { threeposKey, threeposEqual, PIECE_BY_ID } from '@hyper-fairy-chess/shared';
import {
  CX,
  CY,
  INNER_R,
  computeCellCorners,
  cellCentroid,
  cornersToPoints,
} from '../layouts/threePlayerLayout';
import './BoardThreePlayer.css';

interface BoardThreePlayerProps {
  state: ThreeGameState;
  selectedPos: ThreePos | null;
  validMoves: ThreePos[];
  validPlacementSquares: ThreePos[];
  isPlacementMode: boolean;
  onSquareClick: (pos: ThreePos) => void;
  onPieceRightClick?: (piece: ThreePiece, x: number, y: number) => void;
}

function getPieceSymbol(typeId: string): string {
  const pt = PIECE_BY_ID[typeId];
  return pt?.symbol ?? '?';
}

function getPieceColor(owner: Section): string {
  switch (owner) {
    case 'white': return '#f5f5f5';
    case 'red': return '#e74c3c';
    case 'black': return '#2c3e50';
  }
}

function getPieceStroke(owner: Section): string {
  switch (owner) {
    case 'white': return '#333';
    case 'red': return '#7b1212';
    case 'black': return '#aaa';
  }
}

interface SectionGridProps {
  section: Section;
  state: ThreeGameState;
  selectedPos: ThreePos | null;
  validMoves: ThreePos[];
  validPlacementSquares: ThreePos[];
  onSquareClick: (pos: ThreePos) => void;
  onPieceRightClick?: (piece: ThreePiece, x: number, y: number) => void;
}

function SectionGrid({
  section,
  state,
  selectedPos,
  validMoves,
  validPlacementSquares,
  onSquareClick,
  onPieceRightClick,
}: SectionGridProps) {
  const cells: React.ReactElement[] = [];

  for (let srank = 1; srank <= 4; srank++) {
    for (let sfile = 1; sfile <= 8; sfile++) {
      const pos: ThreePos = {
        section,
        sfile: sfile as ThreePos['sfile'],
        srank: srank as ThreePos['srank'],
      };
      const key = threeposKey(pos);

      const corners = computeCellCorners(pos);
      const [cx, cy] = cellCentroid(corners);
      const points = cornersToPoints(corners);

      const isLight = (sfile + srank) % 2 === 0;
      const isSelected = selectedPos !== null && threeposEqual(pos, selectedPos);
      const isValidMove = validMoves.some((m) => threeposEqual(m, pos));
      const isValidPlacement = validPlacementSquares.some((m) => threeposEqual(m, pos));
      const piece = state.board.positionMap.get(key) ?? null;
      const isCapture = isValidMove && piece !== null && piece.owner !== state.board.currentTurn;

      let squareClass = `three-square ${section} ${isLight ? 'light' : 'dark'}`;
      if (isSelected) squareClass += ' selected';
      if (isValidMove && !isCapture) squareClass += ' valid-move';
      if (isCapture) squareClass += ' valid-capture';
      if (isValidPlacement) squareClass += ' valid-placement';

      // Approximate cell "radius" for sizing dots/text: midpoint arc length / 2
      const midR = INNER_R + (4.5 - srank) * 65;
      const approxSize = Math.min(midR * (Math.PI / 12), 50);
      const fontSize = Math.max(approxSize * 0.9, 12);
      const dotR = Math.max(approxSize * 0.18, 5);

      cells.push(
        <g key={key} onClick={() => onSquareClick(pos)} style={{ cursor: 'pointer' }}>
          <polygon
            points={points}
            className={squareClass}
          />
          {(isValidMove || isValidPlacement) && !piece && (
            <circle
              cx={cx}
              cy={cy}
              r={dotR}
              className="move-dot"
            />
          )}
          {piece && (
            <text
              x={cx}
              y={cy + fontSize * 0.35}
              textAnchor="middle"
              fontSize={fontSize}
              className={`piece-symbol piece-${piece.owner}`}
              fill={getPieceColor(piece.owner)}
              stroke={getPieceStroke(piece.owner)}
              strokeWidth="1"
              paintOrder="stroke"
              style={{ userSelect: 'none' }}
              onContextMenu={
                onPieceRightClick
                  ? (e) => {
                      e.preventDefault();
                      onPieceRightClick(piece, e.clientX, e.clientY);
                    }
                  : undefined
              }
            >
              {getPieceSymbol(piece.typeId)}
            </text>
          )}
        </g>,
      );
    }
  }

  return <g>{cells}</g>;
}

export function BoardThreePlayer({
  state,
  selectedPos,
  validMoves,
  validPlacementSquares,
  isPlacementMode: _isPlacementMode,
  onSquareClick,
  onPieceRightClick,
}: BoardThreePlayerProps) {
  const sectionProps = (section: Section) => ({
    section,
    state,
    selectedPos,
    validMoves,
    validPlacementSquares,
    onSquareClick,
    onPieceRightClick,
  });

  return (
    <div className="board-three-player">
      <svg
        viewBox="0 0 700 660"
        width="700"
        height="660"
        className="three-board-svg"
      >
        {/* Center hub */}
        <circle cx={CX} cy={CY} r={INNER_R} fill="#c8a87a" stroke="#b08060" strokeWidth="1" />

        <SectionGrid {...sectionProps('white')} />
        <SectionGrid {...sectionProps('black')} />
        <SectionGrid {...sectionProps('red')} />
      </svg>
    </div>
  );
}

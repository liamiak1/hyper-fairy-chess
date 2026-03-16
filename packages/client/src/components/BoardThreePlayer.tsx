/**
 * SVG board for 3-player GreenChess.
 *
 * Three 8×4 sections arranged around a central equilateral triangle.
 * Each section's rank-4 edge forms one side of the triangle.
 * White = bottom, Red = upper-left, Black = upper-right.
 */

import type {
  ThreeGameState,
  ThreePos,
  ThreePiece,
  Section,
} from '@hyper-fairy-chess/shared';
import { threeposKey, threeposEqual, PIECE_BY_ID } from '@hyper-fairy-chess/shared';
import './BoardThreePlayer.css';

const SQUARE_SIZE = 44;
const SECTION_W = 8 * SQUARE_SIZE; // 352
const SECTION_H = 4 * SQUARE_SIZE; // 176
// Height of equilateral triangle with side = SECTION_W
const TRI_HEIGHT = Math.round(SECTION_W * Math.sqrt(3) / 2); // 305

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

/**
 * Renders a single 8×4 section as an SVG <g>.
 * Section local coords: sfile 1..8 left→right, srank 1..4 bottom→top.
 * rank-4 (seam) is at y=0; rank-1 (back rank) is at y=SECTION_H.
 * The <g> transform applied by the parent will rotate/translate into position.
 */
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
  const squares: React.ReactElement[] = [];

  for (let srank = 1; srank <= 4; srank++) {
    for (let sfile = 1; sfile <= 8; sfile++) {
      const pos: ThreePos = { section, sfile: sfile as ThreePos['sfile'], srank: srank as ThreePos['srank'] };
      const key = threeposKey(pos);

      // rank-4 (seam) at y=0 (top), rank-1 at y=SECTION_H (bottom)
      const x = (sfile - 1) * SQUARE_SIZE;
      const y = (4 - srank) * SQUARE_SIZE;

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

      squares.push(
        <g key={key} onClick={() => onSquareClick(pos)}>
          <rect
            x={x}
            y={y}
            width={SQUARE_SIZE}
            height={SQUARE_SIZE}
            className={squareClass}
          />
          {(isValidMove || isValidPlacement) && !piece && (
            <circle
              cx={x + SQUARE_SIZE / 2}
              cy={y + SQUARE_SIZE / 2}
              r={SQUARE_SIZE * 0.15}
              className="move-dot"
            />
          )}
          {piece && (
            <text
              x={x + SQUARE_SIZE / 2}
              y={y + SQUARE_SIZE / 2 + SQUARE_SIZE * 0.25}
              textAnchor="middle"
              fontSize={SQUARE_SIZE * 0.62}
              className={`piece-symbol piece-${piece.owner}`}
              fill={getPieceColor(piece.owner)}
              stroke={getPieceStroke(piece.owner)}
              strokeWidth="1"
              paintOrder="stroke"
              style={{ cursor: 'pointer', userSelect: 'none' }}
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

  return <g>{squares}</g>;
}

/**
 * Three-section board layout using equilateral triangle geometry.
 *
 * Canvas: 700×640, center at cx=350.
 * cy_seam = y-coordinate of the bottom side of the central triangle (White's rank-4 row).
 *
 * Triangle vertices:
 *   Bottom-left  (BL): (cx - SECTION_W/2, cy_seam) = (174, 430)
 *   Bottom-right (BR): (cx + SECTION_W/2, cy_seam) = (526, 430)
 *   Top          (T):  (cx, cy_seam - TRI_HEIGHT)  = (350, 125)
 *
 * Section transforms (SVG: "A B" = first apply B then A):
 *   White:  translate(174, 430)          — rank-4 at top, rank-1 extends down
 *   Red:    translate(350, 125) rotate(120)  — rank-4 edge = left side of triangle
 *   Black:  translate(526, 430) rotate(-120) — rank-4 edge = right side of triangle
 *
 * Seam adjacency check:
 *   White sfile=1 (top-left corner of section, at BL vertex) connects to Red sfile=8 (bottom-right after rotation, also at BL vertex) ✓
 *   White sfile=8 (top-right, at BR vertex) connects to Black sfile=1 (at BR vertex) ✓
 *   Red sfile=1 (at T vertex) connects to Black sfile=8 (also at T vertex) ✓
 */
export function BoardThreePlayer({
  state,
  selectedPos,
  validMoves,
  validPlacementSquares,
  isPlacementMode: _isPlacementMode,
  onSquareClick,
  onPieceRightClick,
}: BoardThreePlayerProps) {
  const cx = 350;
  const cy_seam = 430;

  // Triangle vertices
  const bx = cx - SECTION_W / 2; // 174 (bottom-left x)
  const tx = cx;                  // 350 (top x)
  const brx = cx + SECTION_W / 2; // 526 (bottom-right x)
  const ty = cy_seam - TRI_HEIGHT; // 125 (top y)

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
        viewBox="0 0 700 640"
        width="700"
        height="640"
        className="three-board-svg"
      >
        {/* Center triangle fill — covers the gap between sections */}
        <polygon
          points={`${bx},${cy_seam} ${brx},${cy_seam} ${tx},${ty}`}
          fill="#1a1a2e"
          stroke="#555"
          strokeWidth="1"
        />

        {/* White section: bottom. translate(bx, cy_seam) — rank-4 at top touching triangle base */}
        <g transform={`translate(${bx}, ${cy_seam})`}>
          <SectionGrid {...sectionProps('white')} />
        </g>

        {/* Red section: upper-left. translate(top-vertex) rotate(120°) */}
        <g transform={`translate(${tx}, ${ty}) rotate(120)`}>
          <SectionGrid {...sectionProps('red')} />
        </g>

        {/* Black section: upper-right. translate(bottom-right vertex) rotate(-120°) */}
        <g transform={`translate(${brx}, ${cy_seam}) rotate(-120)`}>
          <SectionGrid {...sectionProps('black')} />
        </g>

        {/* Section labels */}
        <text x={cx} y={cy_seam + SECTION_H + 22} textAnchor="middle" className="section-label white-label">WHITE</text>
        <text x={bx - 20} y={(cy_seam + ty) / 2} textAnchor="middle" className="section-label red-label">RED</text>
        <text x={brx + 20} y={(cy_seam + ty) / 2} textAnchor="middle" className="section-label black-label">BLACK</text>
      </svg>
    </div>
  );
}

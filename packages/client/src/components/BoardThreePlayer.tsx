/**
 * SVG board for 3-player GreenChess.
 *
 * Three 4×8 sections arranged around a triangular center.
 * White = bottom (rank 1 at bottom), Red = upper-left, Black = upper-right.
 *
 * Each square is SQUARE_SIZE px. Sections are oriented so rank-8 faces center.
 */

import type {
  ThreeGameState,
  ThreePos,
  ThreePiece,
  Section,
} from '@hyper-fairy-chess/shared';
import { threeposKey, threeposEqual, PIECE_BY_ID } from '@hyper-fairy-chess/shared';
import './BoardThreePlayer.css';

const SQUARE_SIZE = 52;
const SECTION_W = 4 * SQUARE_SIZE; // 208
const SECTION_H = 8 * SQUARE_SIZE; // 416

interface BoardThreePlayerProps {
  state: ThreeGameState;
  selectedPos: ThreePos | null;
  validMoves: ThreePos[];
  validPlacementSquares: ThreePos[];
  isPlacementMode: boolean;
  onSquareClick: (pos: ThreePos) => void;
  onPieceRightClick?: (piece: ThreePiece, x: number, y: number) => void;
}

// Piece symbols by typeId — fall back to PIECE_BY_ID symbol
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
 * Renders a single 4×8 section as an SVG <g>.
 * The section is always rendered with sfile 1..4 left→right and srank 1..8 bottom→top.
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

  for (let srank = 1; srank <= 8; srank++) {
    for (let sfile = 1; sfile <= 4; sfile++) {
      const pos: ThreePos = { section, sfile: sfile as ThreePos['sfile'], srank: srank as ThreePos['srank'] };
      const key = threeposKey(pos);

      // x = (sfile-1)*SQUARE_SIZE, y = (8-srank)*SQUARE_SIZE (rank 1 at bottom)
      const x = (sfile - 1) * SQUARE_SIZE;
      const y = (8 - srank) * SQUARE_SIZE;

      // Checkerboard: light when (sfile + srank) % 2 === 0
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
                      // We can't get SVG-to-screen coords easily here; pass 0,0 and let parent handle
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
 * The three sections are positioned so their rank-8 edges meet at the triangular center.
 *
 * White: bottom center. Rendered normally (rank 1 at bottom, rank 8 at top).
 * Red: upper-left. The section is rotated 120° around the center point.
 * Black: upper-right. Rotated -120°.
 *
 * SVG canvas: 700×640. Center of board ~(350, 300).
 *
 * White section: rank-8 top edge at y=centerY - SECTION_H + some offset.
 * We place the section so rank-8 is at the top, touching center.
 *
 * Layout math:
 *   White section: origin at (350 - SECTION_W/2, 300) with rank-8 at top (y=300) and rank-1 at y=300+SECTION_H
 *   Red section: rotated 120° around center (350, 300)
 *   Black section: rotated -120° around center (350, 300)
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
  // Center of board in SVG coords
  const cx = 350;
  const cy = 310;

  // White section: rank-8 row at top, rank-1 at bottom
  // Position so rank-8 (y=0 in section coords) is at cy, rank-1 (y=SECTION_H) is below
  const whiteX = cx - SECTION_W / 2;
  const whiteY = cy;

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
        {/* White section: at bottom, rank-8 at top facing center */}
        <g transform={`translate(${whiteX}, ${whiteY})`}>
          <SectionGrid {...sectionProps('white')} />
        </g>

        {/* Red section: upper-left — rotate the white section 120° around center */}
        <g transform={`rotate(120, ${cx}, ${cy}) translate(${whiteX}, ${whiteY})`}>
          <SectionGrid {...sectionProps('red')} />
        </g>

        {/* Black section: upper-right — rotate -120° around center */}
        <g transform={`rotate(-120, ${cx}, ${cy}) translate(${whiteX}, ${whiteY})`}>
          <SectionGrid {...sectionProps('black')} />
        </g>

        {/* Center triangle fill */}
        <polygon
          points={getCenterTrianglePoints(cx, cy, whiteX, whiteY)}
          fill="#1a1a2e"
          stroke="#444"
          strokeWidth="1"
        />

        {/* Section labels */}
        <text x={cx} y={cy + SECTION_H + 24} textAnchor="middle" className="section-label white-label">WHITE</text>
      </svg>
    </div>
  );
}

/**
 * Compute the three corner points of the center triangle.
 * The triangle connects rank-8 midpoints of each section.
 */
function getCenterTrianglePoints(cx: number, cy: number, _sectionX: number, _sectionY: number): string {
  // The rank-8 row top edge midpoints:
  // White: midpoint of rank-8 top edge = (cx, cy)
  // Red: rotate (cx, cy) by 120° around (cx, cy) = same point... that's the center.
  // Actually the inner corners of rank-8 of each section all converge at the center.
  // The triangle is formed by the 3 inner corners of the seam edges.
  //
  // White section seam: from (whiteX, cy) to (whiteX + SECTION_W, cy) — left and right corners
  // But those left/right corners are where other sections start.
  //
  // The center triangle is the gap between sections.
  // White rank-8 top edge: y=cy, x from whiteX to whiteX+SECTION_W
  // Left corner of white rank-8: (cx - SECTION_W/2, cy)
  // Right corner of white rank-8: (cx + SECTION_W/2, cy)
  //
  // Red section (rotated 120°): its equivalent corners are at
  //   rotate(120°, cx, cy) applied to white left/right corners
  //
  // The center triangle corners = left corner of white, rotate 120°, rotate 240°

  // Midpoint of white top edge = (cx, cy) — this is the center apex of white section
  // The triangle uses the 3 apex points of each section, which are all at the center
  // Actually the "gap" is a triangle formed by the three inner corners where sections don't meet.
  // Simpler: just fill the overlap region as a triangle from the 3 rank-8 midpoints.
  // Each section's rank-8 midpoint (top edge center of rank-8):
  const wMid = { x: cx, y: cy + SQUARE_SIZE / 2 }; // slightly below to show rank-8

  // Rotate wMid by ±120°
  const r1 = rotatePoint(wMid, cx, cy, 120);
  const r2 = rotatePoint(wMid, cx, cy, -120);

  return `${wMid.x},${wMid.y} ${r1.x},${r1.y} ${r2.x},${r2.y}`;
}

function rotatePoint(p: { x: number; y: number }, cx: number, cy: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Annular trapezoid layout for 3-player GreenChess.
 *
 * Three 8×4 sections fan out from a central hub in 120° arcs.
 * srank=4 (seam) is innermost (small cells near hub).
 * srank=1 (back rank) is outermost (wide cells at edge).
 */
import type { ThreePos, Section } from '@hyper-fairy-chess/shared';
import type { CellLayout } from './CellLayout';

export const CX = 350;
export const CY = 330;
export const INNER_R = 50;
export const RANK_DEPTH = 65;

/** Section starting angle in SVG degrees (clockwise from right). */
const SECTION_START: Record<Section, number> = {
  white: 30,
  black: 150,
  red: 270,
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Returns the 4 corners of a trapezoidal cell in absolute SVG coordinates.
 * Order: inner-left, inner-right, outer-right, outer-left.
 */
export function computeCellCorners(pos: ThreePos): [number, number][] {
  const { section, sfile, srank } = pos;
  const start = SECTION_START[section];
  const leftAngle = toRad(start + (sfile - 1) * 15);
  const rightAngle = toRad(start + sfile * 15);

  // srank=4 is innermost (closest to center hub)
  const innerDist = INNER_R + (4 - srank) * RANK_DEPTH;
  const outerDist = INNER_R + (5 - srank) * RANK_DEPTH;

  return [
    [CX + innerDist * Math.cos(leftAngle), CY + innerDist * Math.sin(leftAngle)],
    [CX + innerDist * Math.cos(rightAngle), CY + innerDist * Math.sin(rightAngle)],
    [CX + outerDist * Math.cos(rightAngle), CY + outerDist * Math.sin(rightAngle)],
    [CX + outerDist * Math.cos(leftAngle), CY + outerDist * Math.sin(leftAngle)],
  ];
}

export function cellCentroid(corners: [number, number][]): [number, number] {
  const cx = corners.reduce((sum, c) => sum + c[0], 0) / corners.length;
  const cy = corners.reduce((sum, c) => sum + c[1], 0) / corners.length;
  return [cx, cy];
}

export function cornersToPoints(corners: [number, number][]): string {
  return corners.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

export type ThreePlayerLayout = CellLayout<ThreePos>;

export function createThreePlayerLayout(): ThreePlayerLayout {
  return {
    canvasWidth: 700,
    canvasHeight: 660,
    getCellPolygon(pos: ThreePos): [number, number][] {
      return computeCellCorners(pos);
    },
    getCellCenter(pos: ThreePos): [number, number] {
      return cellCentroid(computeCellCorners(pos));
    },
  };
}

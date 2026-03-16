/**
 * Generic interface for exotic board cell layouts.
 * Each layout maps a position type to absolute SVG coordinates.
 */
export interface CellLayout<TPos> {
  getCellPolygon(pos: TPos): [number, number][];
  getCellCenter(pos: TPos): [number, number];
  canvasWidth: number;
  canvasHeight: number;
}

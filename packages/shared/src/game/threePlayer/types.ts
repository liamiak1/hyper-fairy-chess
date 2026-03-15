/**
 * Types for 3-player GreenChess mode
 */

export type Section = 'white' | 'red' | 'black';
export type SFile = 1 | 2 | 3 | 4;
export type SRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface ThreePos {
  section: Section;
  sfile: SFile;
  srank: SRank;
}

export interface ThreePiece {
  id: string;
  owner: Section;
  typeId: string;
  position: ThreePos;
  hasMoved: boolean;
}

export interface ThreeBoardState {
  pieces: ThreePiece[];
  currentTurn: Section;
  activePlayers: Section[];
  positionMap: Map<string, ThreePiece>;
}

export type ThreeGamePhase = 'setup' | 'draft' | 'placement' | 'play' | 'ended';

export interface ThreeGameState {
  board: ThreeBoardState;
  phase: ThreeGamePhase;
  pointBudget: number;
  halfmoveClock: number;
  turnNumber: number;
  result: ThreeGameResult | null;
  enPassantTarget: ThreePos | null;
}

export interface ThreeGameResult {
  winner: Section | null;
  reason: 'checkmate' | 'stalemate' | 'resignation';
}

export function threeposKey(pos: ThreePos): string {
  return `${pos.section}:${pos.sfile}:${pos.srank}`;
}

export function threeposEqual(a: ThreePos, b: ThreePos): boolean {
  return a.section === b.section && a.sfile === b.sfile && a.srank === b.srank;
}

/** The three sections in turn order */
export const THREE_SECTIONS: Section[] = ['white', 'red', 'black'];

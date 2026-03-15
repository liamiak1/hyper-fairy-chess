/**
 * Placement phase logic for 3-player GreenChess.
 *
 * Each section has a 4×2 placement zone:
 *   - srank 1 (back rank): royalty at sfile 2-3, regular pieces at sfile 1 and 4
 *   - srank 2 (pawn rank): pawns, and herald edge squares at sfile 1 and 4
 */

import type { ThreePos, Section, SFile, SRank, ThreePiece, ThreeGameState } from './types';
import { threeposKey } from './types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import type { PieceTier } from '../types';

export interface ThreePlacementZone {
  position: ThreePos;
  allowedTiers: PieceTier[];
}

/** Get the placement zone for a section (srank 1-2, sfile 1-4). */
export function getThreePlacementZones(section: Section): ThreePos[] {
  const zones: ThreePos[] = [];
  for (const srank of [1, 2] as SRank[]) {
    for (const sfile of [1, 2, 3, 4] as SFile[]) {
      zones.push({ section, sfile, srank });
    }
  }
  return zones;
}

/** Royalty must go on srank 1, sfile 2 or 3 (center 2 of 4). */
export function getRoyaltySquares(section: Section): ThreePos[] {
  return [
    { section, sfile: 2, srank: 1 },
    { section, sfile: 3, srank: 1 },
  ];
}

/** Herald can only go on srank 2, sfile 1 or 4 (edge files of pawn rank). */
export function getHeraldSquares(section: Section): ThreePos[] {
  return [
    { section, sfile: 1, srank: 2 },
    { section, sfile: 4, srank: 2 },
  ];
}

/**
 * Check if a piece can be placed at the given position.
 */
export function isValidThreePlacement(
  piece: ThreePiece,
  target: ThreePos,
  state: ThreeGameState,
): boolean {
  // Must be in own section
  if (target.section !== piece.owner) return false;

  // Must be within placement zone (srank 1-2)
  if (target.srank > 2) return false;

  // Must not be occupied
  if (state.board.positionMap.has(threeposKey(target))) return false;

  const pt = PIECE_BY_ID[piece.typeId];
  if (!pt) return false;

  const isHerald = piece.typeId === 'herald';
  const isRoyalty = pt.tier === 'royalty';
  const isPawn = pt.tier === 'pawn';

  // Herald: must go on edge files of pawn rank
  if (isHerald) {
    return target.srank === 2 && (target.sfile === 1 || target.sfile === 4);
  }

  // Royalty: must go on center files of back rank
  if (isRoyalty) {
    return target.srank === 1 && (target.sfile === 2 || target.sfile === 3);
  }

  // Pawns: must go on srank 2
  if (isPawn) {
    return target.srank === 2;
  }

  // Pieces: must go on srank 1
  return target.srank === 1;
}

/**
 * Get valid placement squares for a piece given the current state.
 */
export function getValidThreePlacementSquares(
  piece: ThreePiece,
  state: ThreeGameState,
): ThreePos[] {
  return getThreePlacementZones(piece.owner).filter((pos) =>
    isValidThreePlacement(piece, pos, state),
  );
}

export interface ThreePlacementState {
  whitePiecesToPlace: ThreePiece[];
  redPiecesToPlace: ThreePiece[];
  blackPiecesToPlace: ThreePiece[];
  currentPlacer: Section;
  selectedPieceId: string | null;
}

/** Get remaining (unplaced) pieces for a section. */
export function getUnplacedPieces(
  placementState: ThreePlacementState,
  section: Section,
): ThreePiece[] {
  switch (section) {
    case 'white': return placementState.whitePiecesToPlace;
    case 'red': return placementState.redPiecesToPlace;
    case 'black': return placementState.blackPiecesToPlace;
  }
}

/** Returns true if all pieces for all sections have been placed. */
export function isThreePlacementComplete(
  placementState: ThreePlacementState,
): boolean {
  return (
    placementState.whitePiecesToPlace.length === 0 &&
    placementState.redPiecesToPlace.length === 0 &&
    placementState.blackPiecesToPlace.length === 0
  );
}

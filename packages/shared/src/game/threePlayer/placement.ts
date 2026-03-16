/**
 * Placement phase logic for 3-player circular GreenChess.
 *
 * Each section has a 4×4 placement zone (middle 4 files × 4 ranks):
 *   - srank 1–2 (outer 2 rings): pawn-type pieces, files 3–6
 *   - srank 3 (next-to-outer piece ring): royalty at files 4–5, other pieces at files 3 & 6
 *   - srank 4 (inner piece ring): other pieces at files 3–6
 *
 * Total per player: 8 pawns + 2 royalty + 6 pieces = 16 pieces.
 * Files 1–2 and 7–8 are open territory (no starting pieces).
 */

import type { ThreePos, Section, SFile, SRank, ThreePiece, ThreeGameState } from './types';
import { threeposKey } from './types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import type { PieceTier } from '../types';

export interface ThreePlacementZone {
  position: ThreePos;
  allowedTiers: PieceTier[];
}

/** The middle 4 files used for piece placement. */
const PIECE_FILES: SFile[] = [3, 4, 5, 6];

/** Get all valid placement squares for a section (srank 1–4, sfile 3–6). */
export function getThreePlacementZones(section: Section): ThreePos[] {
  const zones: ThreePos[] = [];
  for (const srank of [1, 2, 3, 4] as SRank[]) {
    for (const sfile of PIECE_FILES) {
      zones.push({ section, sfile, srank });
    }
  }
  return zones;
}

/** Royalty goes on srank=3, files 4–5 (next-to-outer piece ring, center). */
export function getRoyaltySquares(section: Section): ThreePos[] {
  return [
    { section, sfile: 4, srank: 3 },
    { section, sfile: 5, srank: 3 },
  ];
}

/**
 * Check if a piece can be placed at the given position.
 *
 * Rules:
 *   - Must be in own section, sfile 3–6
 *   - Pawns: srank 1 or 2
 *   - Royalty: srank 3, sfile 4 or 5
 *   - Other pieces: srank 3 (sfile 3 or 6 only) or srank 4
 */
export function isValidThreePlacement(
  piece: ThreePiece,
  target: ThreePos,
  state: ThreeGameState,
): boolean {
  // Must be own section
  if (target.section !== piece.owner) return false;

  // Must be in middle 4 files
  if (target.sfile < 3 || target.sfile > 6) return false;

  // Must not be occupied
  if (state.board.positionMap.has(threeposKey(target))) return false;

  const pt = PIECE_BY_ID[piece.typeId];
  if (!pt) return false;

  const isRoyalty = pt.tier === 'royalty';
  const isPawn = pt.tier === 'pawn';

  if (isPawn) {
    return target.srank === 1 || target.srank === 2;
  }

  if (isRoyalty) {
    return target.srank === 3 && (target.sfile === 4 || target.sfile === 5);
  }

  // Other pieces: srank=3 outer flanks (files 3 or 6) or srank=4 (any of 3–6)
  if (target.srank === 3) {
    return target.sfile === 3 || target.sfile === 6;
  }
  if (target.srank === 4) {
    return true; // files 3–6 already checked above
  }

  return false;
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

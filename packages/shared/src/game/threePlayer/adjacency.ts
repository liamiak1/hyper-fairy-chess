/**
 * Seam adjacency and cross-seam movement for 3-player GreenChess board.
 *
 * Board: 3 sections (white, red, black), each 4×8.
 * srank=1 is the home/back rank; srank=8 is the inner seam edge.
 *
 * The three sections form a cycle: White → Red → Black → White (forward direction).
 *
 * Seam crossing formula (moving forward from srank=8):
 *   W(f,8) → R(5-f, 8)   [W-R seam, following cycle]
 *   R(f,8) → B(5-f, 8)   [R-B seam]
 *   B(f,8) → W(5-f, 8)   [B-W seam]
 *
 * Direction remapping when crossing any seam: (dr, df) → (−dr, −df)
 * (forward enters the new section at its seam and continues inward with negated direction)
 *
 * Each seam square also has a SECONDARY neighbor (the "other" adjacent section):
 *   W(f,8): primary = R(5-f,8), secondary = B(5-f,8)
 *   R(f,8): primary = B(5-f,8), secondary = W(5-f,8)
 *   B(f,8): primary = W(5-f,8), secondary = R(5-f,8)
 * Used for bishop branching at seam squares.
 */

import type { ThreePos, Section, SFile } from './types';

function nextSection(s: Section): Section {
  switch (s) {
    case 'white': return 'red';
    case 'red': return 'black';
    case 'black': return 'white';
  }
}

function prevSection(s: Section): Section {
  switch (s) {
    case 'white': return 'black';
    case 'red': return 'white';
    case 'black': return 'red';
  }
}

function mirrorFile(f: SFile): SFile {
  return (9 - f) as SFile;
}

export function isSeamSquare(pos: ThreePos): boolean {
  return pos.srank === 4;
}

/**
 * Primary seam neighbor: the square you reach by stepping forward through the seam.
 * Follows the W→R→B→W cycle.
 * Returns null for non-seam squares.
 */
export function seamNeighbor(pos: ThreePos): ThreePos | null {
  if (!isSeamSquare(pos)) return null;
  return {
    section: nextSection(pos.section),
    sfile: mirrorFile(pos.sfile),
    srank: 4,
  };
}

/**
 * Secondary seam neighbor: the other adjacent section's seam square.
 * W(f,8): secondary = B(5-f,8); R(f,8): secondary = W(5-f,8); B(f,8): secondary = R(5-f,8)
 */
export function secondarySeamNeighbor(pos: ThreePos): ThreePos | null {
  if (!isSeamSquare(pos)) return null;
  return {
    section: prevSection(pos.section),
    sfile: mirrorFile(pos.sfile),
    srank: 4,
  };
}

/**
 * Both seam neighbors of a seam square (primary + secondary).
 */
export function getAllSeamNeighbors(pos: ThreePos): ThreePos[] {
  if (!isSeamSquare(pos)) return [];
  return [seamNeighbor(pos)!, secondarySeamNeighbor(pos)!];
}

/**
 * Step one square from pos in direction (dsrank, dsfile).
 *
 * For seam crossing (at srank=8, stepping forward i.e. dsrank > 0):
 *   - Find primary seam neighbor N (srank=8 in next section)
 *   - Continue ONE step from N using negated direction (-dsrank, -dsfile)
 *   - Return the resulting position and updated direction
 *   (The seam neighbor square itself is not the landing square; the piece crosses through it)
 *
 * Returns null if the destination is off-board.
 */
export function stepInDirection(
  pos: ThreePos,
  dsrank: number,
  dsfile: number,
): { pos: ThreePos; newDsrank: number; newDsfile: number } | null {
  const newSrank = pos.srank + dsrank;
  const newSfile = pos.sfile + dsfile;

  // Normal step within the section
  if (newSrank >= 1 && newSrank <= 4 && newSfile >= 1 && newSfile <= 8) {
    return {
      pos: { section: pos.section, sfile: newSfile as SFile, srank: newSrank as ThreePos['srank'] },
      newDsrank: dsrank,
      newDsfile: dsfile,
    };
  }

  // Seam crossing: stepping forward (dsrank > 0) from srank=4
  if (dsrank > 0 && pos.srank === 4) {
    const neighbor: ThreePos = {
      section: nextSection(pos.section),
      sfile: mirrorFile(pos.sfile),
      srank: 4,
    };
    // Direction negates in the new section (avoid -0)
    const nd = dsrank === 0 ? 0 : -dsrank;
    const nf = dsfile === 0 ? 0 : -dsfile;
    const continuedSrank = neighbor.srank + nd;
    const continuedSfile = neighbor.sfile + nf;
    if (continuedSrank >= 1 && continuedSrank <= 4 && continuedSfile >= 1 && continuedSfile <= 8) {
      return {
        pos: {
          section: neighbor.section,
          sfile: continuedSfile as SFile,
          srank: continuedSrank as ThreePos['srank'],
        },
        newDsrank: nd,
        newDsfile: nf,
      };
    }
    return null;
  }

  // Off-board (srank < 1, or sfile out of range without seam crossing)
  return null;
}

/**
 * Circular adjacency for 3-player GreenChess.
 *
 * Board: 3 sections (white, black, red), each 8 files × 4 ranks.
 * srank=1 = outer/back rank, srank=4 = inner edge.
 *
 * Sections connect at their file edges (angular boundaries), NOT at srank=4.
 * Clockwise order: White → Black → Red → White.
 *
 *   White sfile=8 ↔ Black sfile=1  (same srank)
 *   Black sfile=8 ↔ Red  sfile=1  (same srank)
 *   Red   sfile=8 ↔ White sfile=1  (same srank)
 *
 * Direction is preserved unchanged when crossing file-edge boundaries.
 * Radial movement (srank) is bounded: srank < 1 or srank > 4 = off-board.
 */

import type { ThreePos, Section, SFile, SRank } from './types';

/** Clockwise next section: White → Black → Red → White. */
function nextSection(s: Section): Section {
  switch (s) {
    case 'white': return 'black';
    case 'black': return 'red';
    case 'red': return 'white';
  }
}

/** Counterclockwise previous section: White → Red → Black → White. */
function prevSection(s: Section): Section {
  switch (s) {
    case 'white': return 'red';
    case 'red': return 'black';
    case 'black': return 'white';
  }
}

/**
 * Step one square from pos in direction (dsrank, dsfile).
 *
 * File-edge crossings wrap into the adjacent section at the same srank.
 * Direction (dsrank, dsfile) is returned unchanged — no negation.
 * Returns null if the destination srank is out of range (< 1 or > 4).
 */
export function stepInDirection(
  pos: ThreePos,
  dsrank: number,
  dsfile: number,
): { pos: ThreePos; newDsrank: number; newDsfile: number } | null {
  const newSrank = pos.srank + dsrank;

  // Radial bounds check
  if (newSrank < 1 || newSrank > 4) return null;

  let newSfile = pos.sfile + dsfile;
  let section = pos.section;

  // File-edge crossing (angular boundary between sections)
  if (newSfile > 8) {
    section = nextSection(pos.section);
    newSfile -= 8; // unit step: 9 → 1
  } else if (newSfile < 1) {
    section = prevSection(pos.section);
    newSfile += 8; // unit step: 0 → 8
  }

  return {
    pos: {
      section,
      sfile: newSfile as SFile,
      srank: newSrank as SRank,
    },
    newDsrank: dsrank,
    newDsfile: dsfile,
  };
}

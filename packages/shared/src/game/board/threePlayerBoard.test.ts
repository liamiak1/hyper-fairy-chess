/**
 * The full engine running on the folded 3-player board.
 *
 * The previous 3-player attempt had its own cut-down move generator, and 34 of
 * the 57 pieces had no moves at all on it. The point of the topology
 * abstraction is that there is now only one move generator, so every piece
 * works on every board. That claim is what this file checks.
 */

import { describe, it, expect } from 'vitest';
import type { BoardState, PieceInstance, PlayerColor, Position, File, Rank } from '../types';
import { positionToString } from '../types';
import { ALL_PIECES, PIECE_BY_ID } from '../pieces/pieceDefinitions';
import { createPositionMap } from './boardUtils';
import { generatePseudoLegalMoves } from './moveGeneration';
import { sectionOf } from './topology';

function sq(s: string): Position {
  return { file: s[0] as File, rank: Number(s.slice(1)) as Rank };
}

let n = 0;
function piece(typeId: string, owner: PlayerColor, square: string): PieceInstance {
  return {
    id: `${owner}-${typeId}-${++n}`,
    typeId,
    owner,
    position: sq(square),
    hasMoved: false,
    isFrozen: false,
  };
}

function board(pieces: PieceInstance[]): BoardState {
  return {
    dimensions: { files: 24, ranks: 4 },
    pieces,
    positionMap: createPositionMap(pieces),
    boardSize: '3player',
    activePlayers: ['white', 'black', 'red'],
  } as BoardState;
}

function movesOf(b: BoardState, p: PieceInstance): string[] {
  return generatePseudoLegalMoves(b, p, null).map(positionToString).sort();
}

// =============================================================================
// The headline claim
// =============================================================================

describe('every piece works on the 3-player board', () => {
  it('gives all 57 piece types at least one move from the middle of the board', () => {
    // The old 3-player engine left 34 of these completely immobile.
    const immobile: string[] = [];

    for (const type of ALL_PIECES) {
      // A lone piece near the centre of white's section, with an enemy nearby
      // so that capture-only pieces have something to do.
      const subject = piece(type.id, 'white', 'd2');
      const b = board([
        subject,
        piece('pawn', 'black', 'd3'),
        piece('pawn', 'black', 'e3'),
        piece('pawn', 'black', 'c3'),
        piece('king', 'white', 'a1'),
        piece('king', 'black', 'i1'),
      ]);

      if (generatePseudoLegalMoves(b, subject, null).length === 0) {
        immobile.push(`${type.name} (${type.id})`);
      }
    }

    expect(immobile, `pieces with no moves: ${immobile.join(', ')}`).toEqual([]);
  });

  it('specifically revives the pieces the old engine could not move', () => {
    // A sample of the 34: leapers with unusual offsets, and pieces whose
    // movement is expressed as a special rule.
    const previouslyBroken = [
      'grasshopper', 'nightrider', 'cannon', 'mao', 'vao', 'lance',
      'gold-general', 'silver-general', 'shogi-pawn', 'herald', 'checker',
    ];

    for (const id of previouslyBroken) {
      expect(PIECE_BY_ID[id], `${id} should exist`).toBeDefined();

      const subject = piece(id, 'white', 'd2');
      const b = board([
        subject,
        piece('pawn', 'black', 'd3'),
        piece('pawn', 'black', 'e3'),
        piece('pawn', 'black', 'c3'),
        piece('king', 'white', 'a1'),
        piece('king', 'black', 'i1'),
      ]);

      expect(
        generatePseudoLegalMoves(b, subject, null).length,
        `${id} has no moves`
      ).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Movement through the fold
// =============================================================================

describe('sliding pieces cross the centre', () => {
  it('gives a rook the same 7-square reach it has on a normal board', () => {
    const rook = piece('rook', 'white', 'e1');
    const b = board([rook, piece('king', 'white', 'a1')]);
    const moves = movesOf(b, rook);

    // Straight up the e-file, through the fold, down black's l-file
    expect(moves).toContain('e2');
    expect(moves).toContain('e4');
    expect(moves).toContain('l4'); // across the seam
    expect(moves).toContain('l1'); // black's back rank
  });

  it('lets a rook reach into an opponent territory', () => {
    const rook = piece('rook', 'white', 'e1');
    const b = board([rook, piece('king', 'white', 'a1')]);

    const reached = new Set(
      generatePseudoLegalMoves(b, rook, null).map(m => sectionOf(m))
    );
    expect(reached.has(1)).toBe(true); // black's section
  });

  it('is blocked by a piece sitting on the far side of the fold', () => {
    const rook = piece('rook', 'white', 'e1');
    const b = board([
      rook,
      piece('king', 'white', 'a1'),
      piece('pawn', 'white', 'l4'), // own piece just across the seam
    ]);
    const moves = movesOf(b, rook);

    expect(moves).toContain('e4');
    expect(moves).not.toContain('l4'); // own piece, cannot land
    expect(moves).not.toContain('l3'); // and cannot pass it
  });

  it('captures across the fold', () => {
    const rook = piece('rook', 'white', 'e1');
    const b = board([
      rook,
      piece('king', 'white', 'a1'),
      piece('pawn', 'black', 'l4'),
    ]);
    const moves = movesOf(b, rook);

    expect(moves).toContain('l4'); // capture
    expect(moves).not.toContain('l3'); // but not beyond
  });

  it('does not let a queen wrap around the outside of the board', () => {
    // h and i are the touching edges of two sections, but that edge is the rim
    // of the board, not a join: sliding sideways off h stops there.
    // Block the h-file so the only way to reach black's section would be
    // sideways off the edge of white's — which must not exist.
    const queen = piece('queen', 'white', 'h2');
    const b = board([
      queen,
      piece('king', 'white', 'a1'),
      piece('pawn', 'white', 'h3'), // blocks the route up through the fold
      piece('pawn', 'white', 'g3'),
      piece('pawn', 'white', 'g1'),
    ]);
    const moves = movesOf(b, queen);

    expect(moves).toContain('g2'); // inwards along its own rank is fine
    expect(moves.filter(m => m.startsWith('i'))).toEqual([]);
  });

  it('still reaches the neighbouring section through the fold', () => {
    // Not around the outside, but up the h-file and across the seam: h4
    // joins i4, so black's section is reachable the legitimate way.
    const queen = piece('queen', 'white', 'h2');
    const b = board([queen, piece('king', 'white', 'a1')]);
    const moves = movesOf(b, queen);

    expect(moves).toContain('h4');
    expect(moves).toContain('i4');
  });

  it('never returns a slide to the square it started on', () => {
    for (const id of ['rook', 'bishop', 'queen']) {
      for (const from of ['a1', 'd2', 'e4', 'h4', 'a4']) {
        const p = piece(id, 'white', from);
        const b = board([p]);
        expect(movesOf(b, p)).not.toContain(from);
      }
    }
  });
});

// =============================================================================
// Sanity properties across the whole board
// =============================================================================

describe('board-wide sanity', () => {
  const everySquare: string[] = [];
  for (let fi = 0; fi < 24; fi++) {
    for (let rank = 1; rank <= 4; rank++) {
      everySquare.push(String.fromCharCode(97 + fi) + rank);
    }
  }

  it('only ever generates moves to real squares', () => {
    for (const id of ['queen', 'knight', 'rook', 'bishop', 'grasshopper', 'nightrider']) {
      for (const from of everySquare) {
        const p = piece(id, 'white', from);
        const b = board([p]);
        for (const m of movesOf(b, p)) {
          expect(everySquare, `${id} on ${from} -> ${m}`).toContain(m);
        }
      }
    }
  });

  it('gives a queen moves from every square on the board', () => {
    for (const from of everySquare) {
      const p = piece('queen', 'white', from);
      const b = board([p]);
      expect(movesOf(b, p).length, `queen stuck on ${from}`).toBeGreaterThan(0);
    }
  });

  it('never lets a slide produce a duplicate square', () => {
    for (const from of everySquare) {
      const p = piece('queen', 'white', from);
      const b = board([p]);
      const moves = generatePseudoLegalMoves(b, p, null).map(positionToString);
      expect(new Set(moves).size, `duplicates from ${from}`).toBe(moves.length);
    }
  });
});

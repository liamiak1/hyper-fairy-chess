/**
 * Tests for special-movement pieces:
 * Gold General, Silver General, Mao, Lance, Vao,
 * Cannon, Grasshopper, Nightrider, Long Leaper
 */

import { describe, it, expect } from 'vitest';
import type { BoardState, Position, PieceInstance, BoardDimensions } from '../types';
import { generatePseudoLegalMoves } from './moveGeneration';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import { isPawnType, getPromotionOptionsForPiece } from '../rules/promotion';
import type { GameState } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createBoard(
  pieces: PieceInstance[],
  dimensions: BoardDimensions = { files: 8, ranks: 8 }
): BoardState {
  const positionMap = new Map<string, string>();
  for (const piece of pieces) {
    if (piece.position) {
      positionMap.set(`${piece.position.file}${piece.position.rank}`, piece.id);
    }
  }
  return { dimensions, pieces, positionMap };
}

function piece(
  id: string,
  typeId: string,
  owner: 'white' | 'black',
  file: string,
  rank: number
): PieceInstance {
  return { id, typeId, owner, position: { file, rank } as Position, hasMoved: false, isFrozen: false };
}

function hasMove(moves: Position[], file: string, rank: number): boolean {
  return moves.some((m) => m.file === file && m.rank === rank);
}

function moveCount(moves: Position[]): number {
  return moves.length;
}

// ---------------------------------------------------------------------------
// Gold General
// ---------------------------------------------------------------------------

describe('Gold General', () => {
  it('white gold general moves orthogonally and diagonally forward (6 directions)', () => {
    const gg = piece('gg', 'gold-general', 'white', 'd', 4);
    const board = createBoard([gg]);
    const moves = generatePseudoLegalMoves(board, gg, null);

    // Orthogonal
    expect(hasMove(moves, 'd', 5)).toBe(true); // N (forward)
    expect(hasMove(moves, 'd', 3)).toBe(true); // S (backward)
    expect(hasMove(moves, 'c', 4)).toBe(true); // W
    expect(hasMove(moves, 'e', 4)).toBe(true); // E
    // Forward diagonals only
    expect(hasMove(moves, 'c', 5)).toBe(true); // NW
    expect(hasMove(moves, 'e', 5)).toBe(true); // NE
    // Backward diagonals forbidden
    expect(hasMove(moves, 'c', 3)).toBe(false); // SW
    expect(hasMove(moves, 'e', 3)).toBe(false); // SE
    expect(moveCount(moves)).toBe(6);
  });

  it('black gold general forward diagonals are southward', () => {
    const gg = piece('gg', 'gold-general', 'black', 'd', 5);
    const board = createBoard([gg]);
    const moves = generatePseudoLegalMoves(board, gg, null);

    expect(hasMove(moves, 'd', 4)).toBe(true); // S (forward for black)
    expect(hasMove(moves, 'd', 6)).toBe(true); // N (backward for black)
    expect(hasMove(moves, 'c', 4)).toBe(true); // SW (forward-left)
    expect(hasMove(moves, 'e', 4)).toBe(true); // SE (forward-right)
    // Backward diagonals forbidden
    expect(hasMove(moves, 'c', 6)).toBe(false); // NW
    expect(hasMove(moves, 'e', 6)).toBe(false); // NE
  });

  it('gold general cannot move to friendly-occupied square', () => {
    const gg = piece('gg', 'gold-general', 'white', 'd', 4);
    const friendly = piece('fp', 'pawn', 'white', 'd', 5);
    const board = createBoard([gg, friendly]);
    const moves = generatePseudoLegalMoves(board, gg, null);

    expect(hasMove(moves, 'd', 5)).toBe(false);
  });

  it('gold general can capture enemy on any of its 6 squares', () => {
    const gg = piece('gg', 'gold-general', 'white', 'd', 4);
    const enemy = piece('ep', 'pawn', 'black', 'e', 5); // NE
    const board = createBoard([gg, enemy]);
    const moves = generatePseudoLegalMoves(board, gg, null);

    expect(hasMove(moves, 'e', 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Silver General
// ---------------------------------------------------------------------------

describe('Silver General', () => {
  it('white silver general moves all 4 diagonals plus straight forward', () => {
    const sg = piece('sg', 'silver-general', 'white', 'd', 4);
    const board = createBoard([sg]);
    const moves = generatePseudoLegalMoves(board, sg, null);

    expect(hasMove(moves, 'd', 5)).toBe(true); // N (forward)
    expect(hasMove(moves, 'c', 5)).toBe(true); // NW
    expect(hasMove(moves, 'e', 5)).toBe(true); // NE
    expect(hasMove(moves, 'c', 3)).toBe(true); // SW
    expect(hasMove(moves, 'e', 3)).toBe(true); // SE
    // Forbidden: orthogonal backward and sideways
    expect(hasMove(moves, 'd', 3)).toBe(false); // S
    expect(hasMove(moves, 'c', 4)).toBe(false); // W
    expect(hasMove(moves, 'e', 4)).toBe(false); // E
    expect(moveCount(moves)).toBe(5);
  });

  it('black silver general forward is southward', () => {
    const sg = piece('sg', 'silver-general', 'black', 'd', 5);
    const board = createBoard([sg]);
    const moves = generatePseudoLegalMoves(board, sg, null);

    expect(hasMove(moves, 'd', 4)).toBe(true); // S (forward)
    expect(hasMove(moves, 'c', 6)).toBe(true); // NW diagonal
    expect(hasMove(moves, 'e', 6)).toBe(true); // NE diagonal
    expect(hasMove(moves, 'c', 4)).toBe(true); // SW diagonal
    expect(hasMove(moves, 'e', 4)).toBe(true); // SE diagonal
    // Forbidden
    expect(hasMove(moves, 'd', 6)).toBe(false); // N (backward for black)
    expect(hasMove(moves, 'c', 5)).toBe(false); // W
    expect(hasMove(moves, 'e', 5)).toBe(false); // E
  });

  it('silver general is recognised as pawn type for promotion', () => {
    const sg = PIECE_BY_ID['silver-general'];
    expect(sg).toBeDefined();
    expect(isPawnType(sg!)).toBe(true);
  });

  it('silver general promotes to Promoted Silver', () => {
    const sg = PIECE_BY_ID['silver-general']!;
    const fakeState = { board: { pieces: [] } } as unknown as GameState;
    const options = getPromotionOptionsForPiece(sg, fakeState);
    expect(options.length).toBe(1);
    expect(options[0].id).toBe('promoted-silver');
  });
});

// ---------------------------------------------------------------------------
// Mao (blockable knight)
// ---------------------------------------------------------------------------

describe('Mao', () => {
  it('reaches all 8 knight squares when paths are clear', () => {
    const mao = piece('mao', 'mao', 'white', 'd', 4);
    const board = createBoard([mao]);
    const moves = generatePseudoLegalMoves(board, mao, null);

    // All standard knight destinations
    expect(hasMove(moves, 'e', 6)).toBe(true);
    expect(hasMove(moves, 'c', 6)).toBe(true);
    expect(hasMove(moves, 'e', 2)).toBe(true);
    expect(hasMove(moves, 'c', 2)).toBe(true);
    expect(hasMove(moves, 'f', 5)).toBe(true);
    expect(hasMove(moves, 'f', 3)).toBe(true);
    expect(hasMove(moves, 'b', 5)).toBe(true);
    expect(hasMove(moves, 'b', 3)).toBe(true);
    expect(moveCount(moves)).toBe(8);
  });

  it('blocked when orthogonal step square is occupied (friendly)', () => {
    const mao = piece('mao', 'mao', 'white', 'd', 4);
    const blocker = piece('fp', 'pawn', 'white', 'd', 5); // blocks N step
    const board = createBoard([mao, blocker]);
    const moves = generatePseudoLegalMoves(board, mao, null);

    // N step (d5) occupied → c6 and e6 unreachable
    expect(hasMove(moves, 'e', 6)).toBe(false);
    expect(hasMove(moves, 'c', 6)).toBe(false);
    // Other directions still work
    expect(hasMove(moves, 'f', 5)).toBe(true);
    expect(hasMove(moves, 'b', 5)).toBe(true);
  });

  it('blocked when orthogonal step square is occupied (enemy)', () => {
    const mao = piece('mao', 'mao', 'white', 'd', 4);
    const blocker = piece('ep', 'pawn', 'black', 'e', 4); // blocks E step
    const board = createBoard([mao, blocker]);
    const moves = generatePseudoLegalMoves(board, mao, null);

    // E step (e4) occupied → f5 and f3 unreachable
    expect(hasMove(moves, 'f', 5)).toBe(false);
    expect(hasMove(moves, 'f', 3)).toBe(false);
    // North step clear → e6, c6 still reachable
    expect(hasMove(moves, 'e', 6)).toBe(true);
    expect(hasMove(moves, 'c', 6)).toBe(true);
  });

  it('can capture enemy on landing square when path is clear', () => {
    const mao = piece('mao', 'mao', 'white', 'd', 4);
    const enemy = piece('ep', 'pawn', 'black', 'e', 6); // NNE landing
    const board = createBoard([mao, enemy]);
    const moves = generatePseudoLegalMoves(board, mao, null);

    expect(hasMove(moves, 'e', 6)).toBe(true);
  });

  it('cannot land on friendly piece', () => {
    const mao = piece('mao', 'mao', 'white', 'd', 4);
    const friendly = piece('fp', 'pawn', 'white', 'e', 6);
    const board = createBoard([mao, friendly]);
    const moves = generatePseudoLegalMoves(board, mao, null);

    expect(hasMove(moves, 'e', 6)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Lance
// ---------------------------------------------------------------------------

describe('Lance', () => {
  it('white lance slides forward (northward) any number of squares', () => {
    const lance = piece('l', 'lance', 'white', 'd', 1);
    const board = createBoard([lance]);
    const moves = generatePseudoLegalMoves(board, lance, null);

    expect(hasMove(moves, 'd', 2)).toBe(true);
    expect(hasMove(moves, 'd', 5)).toBe(true);
    expect(hasMove(moves, 'd', 8)).toBe(true);
    // Cannot move sideways or backward
    expect(hasMove(moves, 'c', 1)).toBe(false);
    expect(hasMove(moves, 'e', 1)).toBe(false);
  });

  it('black lance slides forward (southward)', () => {
    const lance = piece('l', 'lance', 'black', 'd', 8);
    const board = createBoard([lance]);
    const moves = generatePseudoLegalMoves(board, lance, null);

    expect(hasMove(moves, 'd', 7)).toBe(true);
    expect(hasMove(moves, 'd', 1)).toBe(true);
    expect(hasMove(moves, 'd', 8)).toBe(false); // can't stay
  });

  it('lance is blocked by friendly piece', () => {
    const lance = piece('l', 'lance', 'white', 'd', 1);
    const blocker = piece('fp', 'pawn', 'white', 'd', 4);
    const board = createBoard([lance, blocker]);
    const moves = generatePseudoLegalMoves(board, lance, null);

    expect(hasMove(moves, 'd', 2)).toBe(true);
    expect(hasMove(moves, 'd', 3)).toBe(true);
    expect(hasMove(moves, 'd', 4)).toBe(false); // blocked
    expect(hasMove(moves, 'd', 5)).toBe(false); // beyond block
  });

  it('lance can capture enemy and stops there', () => {
    const lance = piece('l', 'lance', 'white', 'd', 1);
    const enemy = piece('ep', 'pawn', 'black', 'd', 5);
    const board = createBoard([lance, enemy]);
    const moves = generatePseudoLegalMoves(board, lance, null);

    expect(hasMove(moves, 'd', 5)).toBe(true);
    expect(hasMove(moves, 'd', 6)).toBe(false); // cannot pass through
  });

  it('lance is recognised as pawn type for promotion', () => {
    const lance = PIECE_BY_ID['lance'];
    expect(lance).toBeDefined();
    expect(isPawnType(lance!)).toBe(true);
  });

  it('lance promotes to Promoted Lance', () => {
    const lance = PIECE_BY_ID['lance']!;
    const fakeState = { board: { pieces: [] } } as unknown as GameState;
    const options = getPromotionOptionsForPiece(lance, fakeState);
    expect(options.length).toBe(1);
    expect(options[0].id).toBe('promoted-lance');
  });
});

// ---------------------------------------------------------------------------
// Vao (diagonal cannon)
// ---------------------------------------------------------------------------

describe('Vao', () => {
  it('slides diagonally to empty squares before any piece', () => {
    const vao = piece('v', 'vao', 'white', 'd', 1);
    const board = createBoard([vao]);
    const moves = generatePseudoLegalMoves(board, vao, null);

    // NE diagonal: e2, f3, g4, h5
    expect(hasMove(moves, 'e', 2)).toBe(true);
    expect(hasMove(moves, 'f', 3)).toBe(true);
    expect(hasMove(moves, 'h', 5)).toBe(true);
    // NW diagonal: c2, b3, a4
    expect(hasMove(moves, 'c', 2)).toBe(true);
    expect(hasMove(moves, 'a', 4)).toBe(true);
  });

  it('cannot move to an occupied square directly', () => {
    const vao = piece('v', 'vao', 'white', 'd', 4);
    const blocker = piece('ep', 'pawn', 'black', 'e', 5); // NE, acts as screen
    const board = createBoard([vao, blocker]);
    const moves = generatePseudoLegalMoves(board, vao, null);

    expect(hasMove(moves, 'e', 5)).toBe(false); // can't land on screen piece
  });

  it('captures by hopping over one piece diagonally', () => {
    const vao = piece('v', 'vao', 'white', 'd', 4);
    const screen = piece('fp', 'pawn', 'white', 'e', 5); // friendly screen NE
    const target = piece('ep', 'pawn', 'black', 'f', 6); // enemy beyond screen
    const board = createBoard([vao, screen, target]);
    const moves = generatePseudoLegalMoves(board, vao, null);

    expect(hasMove(moves, 'f', 6)).toBe(true);  // capture beyond screen
    expect(hasMove(moves, 'e', 5)).toBe(false); // cannot land on screen
  });

  it('screen piece can be an enemy (still not captured)', () => {
    const vao = piece('v', 'vao', 'white', 'd', 4);
    const screen = piece('e1', 'pawn', 'black', 'e', 5); // enemy as screen
    const target = piece('e2', 'pawn', 'black', 'f', 6); // second enemy to capture
    const board = createBoard([vao, screen, target]);
    const moves = generatePseudoLegalMoves(board, vao, null);

    expect(hasMove(moves, 'f', 6)).toBe(true);
    expect(hasMove(moves, 'e', 5)).toBe(false); // screen not captured
  });

  it('cannot capture if piece after screen is friendly', () => {
    const vao = piece('v', 'vao', 'white', 'd', 4);
    const screen = piece('e1', 'pawn', 'black', 'e', 5);
    const friendly = piece('fp', 'pawn', 'white', 'f', 6); // friendly beyond screen
    const board = createBoard([vao, screen, friendly]);
    const moves = generatePseudoLegalMoves(board, vao, null);

    expect(hasMove(moves, 'f', 6)).toBe(false);
  });

  it('cannot capture when two pieces are adjacent (no room to screen + capture)', () => {
    const vao = piece('v', 'vao', 'white', 'd', 4);
    const p1 = piece('e1', 'pawn', 'black', 'e', 5); // screen
    const p2 = piece('e2', 'pawn', 'black', 'f', 6); // would-be target
    const p3 = piece('e3', 'pawn', 'black', 'g', 7); // third piece blocks beyond
    const board = createBoard([vao, p1, p2, p3]);
    const moves = generatePseudoLegalMoves(board, vao, null);

    // Can capture f6 (over screen at e5), but g7 is now another piece after that capture
    // so can only reach f6
    expect(hasMove(moves, 'f', 6)).toBe(true);
    expect(hasMove(moves, 'g', 7)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cannon
// ---------------------------------------------------------------------------

describe('Cannon', () => {
  it('slides orthogonally to empty squares before any piece', () => {
    const cannon = piece('c', 'cannon', 'white', 'd', 1);
    const board = createBoard([cannon]);
    const moves = generatePseudoLegalMoves(board, cannon, null);

    // North
    expect(hasMove(moves, 'd', 4)).toBe(true);
    expect(hasMove(moves, 'd', 8)).toBe(true);
    // East
    expect(hasMove(moves, 'e', 1)).toBe(true);
    expect(hasMove(moves, 'h', 1)).toBe(true);
    // Diagonal — cannon does not slide diagonally
    expect(hasMove(moves, 'e', 2)).toBe(false);
  });

  it('cannot land on the screen piece itself', () => {
    const cannon = piece('c', 'cannon', 'white', 'd', 1);
    const screen = piece('fp', 'pawn', 'white', 'd', 5);
    const board = createBoard([cannon, screen]);
    const moves = generatePseudoLegalMoves(board, cannon, null);

    expect(hasMove(moves, 'd', 5)).toBe(false);
  });

  it('captures by hopping over one piece orthogonally', () => {
    const cannon = piece('c', 'cannon', 'white', 'd', 1);
    const screen = piece('fp', 'pawn', 'white', 'd', 4);
    const target = piece('ep', 'pawn', 'black', 'd', 7);
    const board = createBoard([cannon, screen, target]);
    const moves = generatePseudoLegalMoves(board, cannon, null);

    expect(hasMove(moves, 'd', 7)).toBe(true);
    expect(hasMove(moves, 'd', 8)).toBe(false); // cannot pass beyond capture
  });

  it('cannot capture past a second blocking piece', () => {
    const cannon = piece('c', 'cannon', 'white', 'd', 1);
    const screen = piece('fp', 'pawn', 'white', 'd', 4);
    const blocker = piece('fp2', 'pawn', 'white', 'd', 6);
    const target = piece('ep', 'pawn', 'black', 'd', 7);
    const board = createBoard([cannon, screen, blocker, target]);
    const moves = generatePseudoLegalMoves(board, cannon, null);

    // blocker at d6 stops the capture of d7
    expect(hasMove(moves, 'd', 7)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Grasshopper
// ---------------------------------------------------------------------------

describe('Grasshopper', () => {
  it('has no moves on an empty board (needs a hurdle)', () => {
    const gh = piece('g', 'grasshopper', 'white', 'd', 4);
    const board = createBoard([gh]);
    const moves = generatePseudoLegalMoves(board, gh, null);

    expect(moveCount(moves)).toBe(0);
  });

  it('hops over one piece and lands on the square immediately beyond', () => {
    const gh = piece('g', 'grasshopper', 'white', 'd', 4);
    const hurdle = piece('fp', 'pawn', 'white', 'd', 6); // friendly hurdle N
    const board = createBoard([gh, hurdle]);
    const moves = generatePseudoLegalMoves(board, gh, null);

    expect(hasMove(moves, 'd', 7)).toBe(true);
    expect(hasMove(moves, 'd', 5)).toBe(false); // skipped over
    expect(hasMove(moves, 'd', 6)).toBe(false); // the hurdle itself
  });

  it('can capture enemy on landing square', () => {
    const gh = piece('g', 'grasshopper', 'white', 'd', 4);
    const hurdle = piece('fp', 'pawn', 'white', 'd', 5);
    const enemy = piece('ep', 'pawn', 'black', 'd', 6);
    const board = createBoard([gh, hurdle, enemy]);
    const moves = generatePseudoLegalMoves(board, gh, null);

    expect(hasMove(moves, 'd', 6)).toBe(true);
  });

  it('cannot land on a friendly piece', () => {
    const gh = piece('g', 'grasshopper', 'white', 'd', 4);
    const hurdle = piece('fp', 'pawn', 'white', 'd', 5);
    const blocker = piece('fp2', 'pawn', 'white', 'd', 6);
    const board = createBoard([gh, hurdle, blocker]);
    const moves = generatePseudoLegalMoves(board, gh, null);

    expect(hasMove(moves, 'd', 6)).toBe(false);
  });

  it('hops in all 8 directions when hurdles are present', () => {
    const gh = piece('g', 'grasshopper', 'white', 'd', 4);
    // Place hurdles in all 8 directions 1 square away
    const pieces = [
      gh,
      piece('h1', 'pawn', 'black', 'd', 5), // N
      piece('h2', 'pawn', 'black', 'd', 3), // S
      piece('h3', 'pawn', 'black', 'c', 4), // W
      piece('h4', 'pawn', 'black', 'e', 4), // E
      piece('h5', 'pawn', 'black', 'c', 5), // NW
      piece('h6', 'pawn', 'black', 'e', 5), // NE
      piece('h7', 'pawn', 'black', 'c', 3), // SW
      piece('h8', 'pawn', 'black', 'e', 3), // SE
    ];
    const board = createBoard(pieces);
    const moves = generatePseudoLegalMoves(board, gh, null);

    // Landing squares 2 away in each direction (if on board)
    expect(hasMove(moves, 'd', 6)).toBe(true); // N
    expect(hasMove(moves, 'd', 2)).toBe(true); // S
    expect(hasMove(moves, 'b', 4)).toBe(true); // W
    expect(hasMove(moves, 'f', 4)).toBe(true); // E
    expect(hasMove(moves, 'b', 6)).toBe(true); // NW
    expect(hasMove(moves, 'f', 6)).toBe(true); // NE
    expect(hasMove(moves, 'b', 2)).toBe(true); // SW
    expect(hasMove(moves, 'f', 2)).toBe(true); // SE
  });

  it('cannot hop when landing square is off the board', () => {
    const gh = piece('g', 'grasshopper', 'white', 'd', 7);
    const hurdle = piece('fp', 'pawn', 'white', 'd', 8); // hurdle at last rank N
    const board = createBoard([gh, hurdle]);
    const moves = generatePseudoLegalMoves(board, gh, null);

    // Landing would be rank 9 — off board
    expect(hasMove(moves, 'd', 9)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Nightrider
// ---------------------------------------------------------------------------

describe('Nightrider', () => {
  it('extends knight moves repeatedly in same direction', () => {
    const nr = piece('nr', 'nightrider', 'white', 'a', 1);
    const board = createBoard([nr]);
    const moves = generatePseudoLegalMoves(board, nr, null);

    // NNE direction (dx=1, dy=2): b3, c5, d7
    expect(hasMove(moves, 'b', 3)).toBe(true);
    expect(hasMove(moves, 'c', 5)).toBe(true);
    expect(hasMove(moves, 'd', 7)).toBe(true);
    // ENE direction (dx=2, dy=1): c2, e3, g4
    expect(hasMove(moves, 'c', 2)).toBe(true);
    expect(hasMove(moves, 'e', 3)).toBe(true);
    expect(hasMove(moves, 'g', 4)).toBe(true);
  });

  it('stops at friendly piece (cannot move through or to it)', () => {
    const nr = piece('nr', 'nightrider', 'white', 'a', 1);
    const blocker = piece('fp', 'pawn', 'white', 'b', 3); // first NNE step
    const board = createBoard([nr, blocker]);
    const moves = generatePseudoLegalMoves(board, nr, null);

    expect(hasMove(moves, 'b', 3)).toBe(false); // blocked
    expect(hasMove(moves, 'c', 5)).toBe(false); // beyond block
    expect(hasMove(moves, 'd', 7)).toBe(false); // beyond block
  });

  it('captures enemy and stops, cannot continue past it', () => {
    const nr = piece('nr', 'nightrider', 'white', 'a', 1);
    const enemy = piece('ep', 'pawn', 'black', 'b', 3);
    const board = createBoard([nr, enemy]);
    const moves = generatePseudoLegalMoves(board, nr, null);

    expect(hasMove(moves, 'b', 3)).toBe(true);  // can capture
    expect(hasMove(moves, 'c', 5)).toBe(false); // cannot continue
  });
});

// ---------------------------------------------------------------------------
// Long Leaper
// ---------------------------------------------------------------------------

describe('Long Leaper', () => {
  it('slides like a queen on an empty board (non-capturing)', () => {
    const ll = piece('ll', 'long-leaper', 'white', 'd', 4);
    const board = createBoard([ll]);
    const moves = generatePseudoLegalMoves(board, ll, null);

    // Slides in all directions
    expect(hasMove(moves, 'd', 8)).toBe(true); // N
    expect(hasMove(moves, 'h', 4)).toBe(true); // E
    expect(hasMove(moves, 'h', 8)).toBe(true); // NE diagonal
  });

  it('jumps over an enemy and lands beyond it', () => {
    const ll = piece('ll', 'long-leaper', 'white', 'd', 1);
    const enemy = piece('ep', 'pawn', 'black', 'd', 4);
    const board = createBoard([ll, enemy]);
    const moves = generatePseudoLegalMoves(board, ll, null);

    // d2, d3 reachable by sliding before the enemy
    expect(hasMove(moves, 'd', 2)).toBe(true);
    expect(hasMove(moves, 'd', 3)).toBe(true);
    // d5 reachable by jumping over enemy at d4
    expect(hasMove(moves, 'd', 5)).toBe(true);
    // d4 itself — not a landing square
    expect(hasMove(moves, 'd', 4)).toBe(false);
  });

  it('can chain multiple captures in one move in the same direction', () => {
    const ll = piece('ll', 'long-leaper', 'white', 'd', 1);
    const enemy1 = piece('e1', 'pawn', 'black', 'd', 3);
    const enemy2 = piece('e2', 'pawn', 'black', 'd', 5);
    const board = createBoard([ll, enemy1, enemy2]);
    const moves = generatePseudoLegalMoves(board, ll, null);

    // Jump over e1 → land d4; then jump over e2 → land d6
    expect(hasMove(moves, 'd', 4)).toBe(true);
    expect(hasMove(moves, 'd', 6)).toBe(true);
  });

  it('blocked by friendly piece (cannot jump over friendly)', () => {
    const ll = piece('ll', 'long-leaper', 'white', 'd', 1);
    const friendly = piece('fp', 'pawn', 'white', 'd', 4);
    const board = createBoard([ll, friendly]);
    const moves = generatePseudoLegalMoves(board, ll, null);

    expect(hasMove(moves, 'd', 2)).toBe(true);
    expect(hasMove(moves, 'd', 3)).toBe(true);
    expect(hasMove(moves, 'd', 4)).toBe(false);
    expect(hasMove(moves, 'd', 5)).toBe(false); // blocked beyond
  });

  it('cannot jump when landing square is occupied', () => {
    const ll = piece('ll', 'long-leaper', 'white', 'd', 1);
    const enemy = piece('e1', 'pawn', 'black', 'd', 4);
    const blocker = piece('fp', 'pawn', 'white', 'd', 5); // occupies landing
    const board = createBoard([ll, enemy, blocker]);
    const moves = generatePseudoLegalMoves(board, ll, null);

    expect(hasMove(moves, 'd', 5)).toBe(false); // can't land on friendly
  });
});

// ---------------------------------------------------------------------------
// Shogi promotion flags
// ---------------------------------------------------------------------------

describe('Shogi promotion pieces', () => {
  it('tokin has promotionOnly flag', () => {
    expect(PIECE_BY_ID['tokin']?.promotionOnly).toBe(true);
  });

  it('promoted-silver has promotionOnly flag', () => {
    expect(PIECE_BY_ID['promoted-silver']?.promotionOnly).toBe(true);
  });

  it('promoted-lance has promotionOnly flag', () => {
    expect(PIECE_BY_ID['promoted-lance']?.promotionOnly).toBe(true);
  });

  it('shogi-pawn is a pawn type', () => {
    const sp = PIECE_BY_ID['shogi-pawn'];
    expect(sp).toBeDefined();
    expect(isPawnType(sp!)).toBe(true);
  });

  it('shogi-pawn promotes to tokin', () => {
    const sp = PIECE_BY_ID['shogi-pawn']!;
    const fakeState = { board: { pieces: [] } } as unknown as GameState;
    const options = getPromotionOptionsForPiece(sp, fakeState);
    expect(options.length).toBe(1);
    expect(options[0].id).toBe('tokin');
  });

  it('tokin moves like a Gold General', () => {
    const tokin = piece('t', 'tokin', 'white', 'd', 4);
    const board = createBoard([tokin]);
    const moves = generatePseudoLegalMoves(board, tokin, null);

    // Same 6 squares as Gold General
    expect(hasMove(moves, 'd', 5)).toBe(true); // N
    expect(hasMove(moves, 'd', 3)).toBe(true); // S
    expect(hasMove(moves, 'c', 4)).toBe(true); // W
    expect(hasMove(moves, 'e', 4)).toBe(true); // E
    expect(hasMove(moves, 'c', 5)).toBe(true); // NW (forward diagonal)
    expect(hasMove(moves, 'e', 5)).toBe(true); // NE (forward diagonal)
    expect(hasMove(moves, 'c', 3)).toBe(false); // SW forbidden
    expect(hasMove(moves, 'e', 3)).toBe(false); // SE forbidden
    expect(moveCount(moves)).toBe(6);
  });
});

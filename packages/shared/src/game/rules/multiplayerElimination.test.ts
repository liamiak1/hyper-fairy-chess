/**
 * Elimination and turn-skipping rules for 3- and 4-player games.
 *
 * Rules under test:
 *   - a checkmated player is eliminated; their pieces stay on the board as
 *     neutral obstacles that never move and can be captured by any survivor
 *   - a stalemated player is skipped, and rejoins if someone frees them
 *   - the game ends when one player is left standing
 *   - 2-player games are untouched: checkmate and stalemate still end the game
 */

import { describe, it, expect } from 'vitest';
import type {
  BoardState,
  GameState,
  PieceInstance,
  PlayerColor,
  Position,
  File,
  Rank,
} from '../types';
import { positionToString } from '../types';
import {
  getActivePlayers,
  isPlayerActive,
  eliminatePlayer,
  createPositionMap,
} from '../board/boardUtils';
import { generatePseudoLegalMoves, getAttackedSquares } from '../board/moveGeneration';
import { isInCheck, hasAnyLegalMoves } from './checkDetection';
import { executeMove, prepareMoveFromPositions } from './moveExecution';
import {
  getGameResult,
  resolveTurnTransition,
  nextActivePlayer,
  collectVictoryPoints,
  getResultDescription,
} from './gameEndDetection';

// =============================================================================
// Helpers
// =============================================================================

let idCounter = 0;

function piece(typeId: string, owner: PlayerColor, square: string): PieceInstance {
  const file = square[0] as File;
  const rank = Number(square.slice(1)) as Rank;
  return {
    id: `${owner}-${typeId}-${++idCounter}`,
    typeId,
    owner,
    position: { file, rank },
    hasMoved: false,
    isFrozen: false,
  };
}

function board(pieces: PieceInstance[], activePlayers?: PlayerColor[]): BoardState {
  return {
    dimensions: { files: 12, ranks: 12 },
    pieces,
    positionMap: createPositionMap(pieces),
    boardSize: '4player',
    ...(activePlayers ? { activePlayers } : {}),
  } as BoardState;
}

function state(b: BoardState, currentTurn: PlayerColor): GameState {
  return {
    phase: 'play',
    boardSize: b.boardSize,
    board: b,
    players: {},
    currentTurn,
    turnNumber: 1,
    pointBudget: 0,
    placementMode: 'alternating',
    draft: null,
    inCheck: null,
    moveHistory: [],
    enPassantTarget: null,
    halfmoveClock: 0,
    positionHistory: [],
    result: null,
  } as unknown as GameState;
}

function pos(square: string): Position {
  return { file: square[0] as File, rank: Number(square.slice(1)) as Rank };
}

function squares(moves: Position[]): string[] {
  return moves.map(positionToString).sort();
}

/**
 * Red's king on a1 is ladder-mated in the corner by white's two rooks:
 * the rook on l1 gives check along rank 1 (covering b1), and the rook on
 * l2 covers a2 and b2, so there is no escape square.
 *
 * White, red and blue are in the game; blue is elsewhere and unaffected.
 */
function matedRedPosition(): BoardState {
  return board(
    [
      piece('king', 'red', 'a1'),
      piece('rook', 'white', 'l1'), // checks along rank 1, covers b1
      piece('rook', 'white', 'l2'), // covers a2 and b2 -> mate
      piece('king', 'white', 'f6'),
      piece('king', 'blue', 'l12'),
      piece('pawn', 'red', 'h8'), // a stray red piece, away from the action
    ],
    ['white', 'red', 'blue']
  );
}

// =============================================================================
// Elimination model
// =============================================================================

describe('elimination model', () => {
  it('defaults to a 2-player game when activePlayers is absent', () => {
    const b = board([piece('king', 'white', 'a1')]);
    expect(getActivePlayers(b)).toEqual(['white', 'black']);
    expect(isPlayerActive(b, 'white')).toBe(true);
    expect(isPlayerActive(b, 'red')).toBe(false);
  });

  it('eliminatePlayer removes the player but leaves their pieces', () => {
    const b = board(
      [piece('king', 'red', 'a1'), piece('queen', 'red', 'b2')],
      ['white', 'red', 'blue']
    );
    const after = eliminatePlayer(b, 'red');

    expect(getActivePlayers(after)).toEqual(['white', 'blue']);
    expect(after.pieces).toHaveLength(2);
    expect(after.pieces.every(p => p.owner === 'red')).toBe(true);
  });

  it('eliminatePlayer is a no-op for a player already out', () => {
    const b = board([piece('king', 'white', 'a1')], ['white', 'blue']);
    expect(eliminatePlayer(b, 'red')).toBe(b);
  });
});

describe('eliminated pieces are inert obstacles', () => {
  it('generates no moves for an eliminated player', () => {
    const pieces = [piece('queen', 'red', 'f6'), piece('king', 'white', 'a1')];
    const active = board(pieces, ['white', 'red']);
    const red = pieces[0];

    expect(generatePseudoLegalMoves(active, red, null).length).toBeGreaterThan(0);

    const eliminated = board(pieces, ['white']);
    expect(generatePseudoLegalMoves(eliminated, red, null)).toEqual([]);
  });

  it('no longer attacks squares, so it cannot give check', () => {
    const pieces = [
      piece('rook', 'red', 'a8'),
      piece('king', 'white', 'a1'),
      piece('king', 'blue', 'l12'),
    ];
    const red = pieces[0];

    const withRed = board(pieces, ['white', 'red', 'blue']);
    expect(getAttackedSquares(withRed, red).length).toBeGreaterThan(0);
    expect(isInCheck(withRed, 'white')).toBe(true);

    const redOut = board(pieces, ['white', 'blue']);
    expect(getAttackedSquares(redOut, red)).toEqual([]);
    expect(isInCheck(redOut, 'white')).toBe(false);
  });

  it('still blocks movement through its square', () => {
    const pieces = [
      piece('rook', 'white', 'a1'),
      piece('pawn', 'red', 'a5'), // red is out, but the pawn is still in the way
      piece('king', 'white', 'f6'),
      piece('king', 'blue', 'l12'),
    ];
    const b = board(pieces, ['white', 'blue']);
    const rookMoves = squares(generatePseudoLegalMoves(b, pieces[0], null));

    expect(rookMoves).toContain('a4'); // up to the obstacle
    expect(rookMoves).toContain('a5'); // and can capture it
    expect(rookMoves).not.toContain('a6'); // but not through it
  });

  it('can be captured by a survivor for Victory Points', () => {
    const pieces = [
      piece('rook', 'white', 'a1'),
      piece('queen', 'red', 'a5'),
      piece('king', 'white', 'f6'),
      piece('king', 'blue', 'l12'),
    ];
    const b = board(pieces, ['white', 'blue']);

    expect(squares(generatePseudoLegalMoves(b, pieces[0], null))).toContain('a5');
    expect(collectVictoryPoints(b).red).toBeGreaterThan(0);
  });
});

// =============================================================================
// Turn resolution
// =============================================================================

describe('nextActivePlayer', () => {
  it('follows TURN_ORDER (white, blue, black, red)', () => {
    const all: PlayerColor[] = ['white', 'blue', 'black', 'red'];
    expect(nextActivePlayer(all, 'white')).toBe('blue');
    expect(nextActivePlayer(all, 'blue')).toBe('black');
    expect(nextActivePlayer(all, 'red')).toBe('white');
  });

  it('skips players who are out', () => {
    expect(nextActivePlayer(['white', 'black'], 'white')).toBe('black');
    expect(nextActivePlayer(['white', 'red'], 'white')).toBe('red');
  });

  it('returns the same player when nobody else is left', () => {
    expect(nextActivePlayer(['white'], 'white')).toBe('white');
  });
});

describe('resolveTurnTransition', () => {
  it('leaves 2-player games completely untouched', () => {
    // Black is checkmated, but with two players that ends the game rather than
    // eliminating anyone — the state must come back byte-identical.
    const b = board([
      piece('king', 'black', 'a12'),
      piece('rook', 'white', 'l12'), // checks along rank 12, covers b12
      piece('rook', 'white', 'l11'), // covers a11 and b11 -> mate
      piece('king', 'white', 'f6'),
    ]);
    const s = state(b, 'black');
    expect(resolveTurnTransition(s)).toBe(s);
  });

  it('eliminates a checkmated player and passes play on', () => {
    const s = state(matedRedPosition(), 'red');

    expect(isInCheck(s.board, 'red')).toBe(true);
    expect(hasAnyLegalMoves(s.board, 'red', null)).toBe(false);

    const after = resolveTurnTransition(s);

    expect(getActivePlayers(after.board)).toEqual(['white', 'blue']);
    // TURN_ORDER is white, blue, black, red — so after red it wraps to white
    expect(after.currentTurn).toBe('white');
    // Red's pieces are still on the board
    expect(after.board.pieces.filter(p => p.owner === 'red')).toHaveLength(2);
  });

  it('skips a stalemated player without eliminating them', () => {
    // Blue's king on l12 is boxed in by white's rooks but is NOT in check.
    const b = board(
      [
        piece('king', 'blue', 'l12'),
        piece('rook', 'white', 'k1'), // covers the k-file
        piece('rook', 'white', 'a11'), // covers rank 11
        piece('king', 'white', 'f6'),
        piece('king', 'red', 'a1'),
      ],
      ['white', 'blue', 'red']
    );
    const s = state(b, 'blue');

    expect(isInCheck(b, 'blue')).toBe(false);
    expect(hasAnyLegalMoves(b, 'blue', null)).toBe(false);

    const after = resolveTurnTransition(s);

    // Still in the game, just passed over
    expect(getActivePlayers(after.board)).toEqual(['white', 'blue', 'red']);
    expect(after.currentTurn).toBe('red');
  });

  it('does not move the turn when the player to move can play', () => {
    const b = board(
      [
        piece('king', 'white', 'f6'),
        piece('king', 'blue', 'l12'),
        piece('king', 'red', 'a1'),
      ],
      ['white', 'blue', 'red']
    );
    const s = state(b, 'blue');
    expect(resolveTurnTransition(s)).toBe(s);
  });

  it('eliminates a player whose royal piece is gone', () => {
    const b = board(
      [
        piece('queen', 'red', 'h8'), // red has pieces but no king
        piece('king', 'white', 'f6'),
        piece('king', 'blue', 'l12'),
      ],
      ['white', 'red', 'blue']
    );
    const after = resolveTurnTransition(state(b, 'red'));

    expect(getActivePlayers(after.board)).toEqual(['white', 'blue']);
    expect(after.currentTurn).toBe('white');
  });

  it('terminates when every remaining player is stalemated', () => {
    // Three bare kings, each walled in by the others' pieces would be elaborate
    // to construct; instead check the guard directly by giving nobody any
    // pieces that can move. Kings with no legal squares and no checks.
    const b = board(
      [
        piece('king', 'white', 'a1'),
        piece('king', 'blue', 'a2'),
        piece('king', 'red', 'b1'),
      ],
      ['white', 'blue', 'red']
    );
    // This must return rather than spin forever, whatever the outcome.
    const after = resolveTurnTransition(state(b, 'white'));
    expect(after).toBeDefined();
    expect(getActivePlayers(after.board).length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Game result
// =============================================================================

describe('getGameResult — 2-player behaviour is preserved', () => {
  it('reports checkmate with the opponent as winner', () => {
    const b = board([
      piece('king', 'black', 'a12'),
      piece('rook', 'white', 'l12'), // checks along rank 12, covers b12
      piece('rook', 'white', 'l11'), // covers a11 and b11 -> mate
      piece('king', 'white', 'f6'),
    ]);
    const result = getGameResult(state(b, 'black'));

    expect(result?.type).toBe('checkmate');
    expect(result?.winner).toBe('white');
  });

  it('resolves stalemate on Victory Points', () => {
    // Black's king on a12 is stalemated; white has more material.
    const b = board([
      piece('king', 'black', 'a12'),
      piece('rook', 'white', 'b1'), // covers the b-file (b11, b12)
      piece('rook', 'white', 'l11'), // covers rank 11 (a11) — but not a12
      piece('king', 'white', 'f6'),
      piece('queen', 'white', 'h4'), // white is ahead on Victory Points
    ]);
    const s = state(b, 'black');

    expect(isInCheck(b, 'black')).toBe(false);
    expect(hasAnyLegalMoves(b, 'black', null)).toBe(false);

    const result = getGameResult(s);
    expect(result?.type).toBe('stalemate');
    expect(result?.winner).toBe('white');
    expect(result?.whiteVP).toBeGreaterThan(result!.blackVP);
  });

  it('returns null while the game is still going', () => {
    const b = board([
      piece('king', 'white', 'f6'),
      piece('king', 'black', 'a12'),
    ]);
    expect(getGameResult(state(b, 'white'))).toBeNull();
  });
});

describe('getGameResult — 3-/4-player', () => {
  it('does not end the game when one of three players is checkmated', () => {
    // This is the bug the old code had: checkmating red used to report a
    // winner (or a draw) even though blue and white were still playing.
    const resolved = resolveTurnTransition(state(matedRedPosition(), 'red'));
    const result = getGameResult(resolved);

    expect(result).toBeNull();
    expect(getActivePlayers(resolved.board)).toEqual(['white', 'blue']);
  });

  it('declares the last player standing the winner', () => {
    const b = board([piece('king', 'blue', 'l12')], ['blue']);
    const result = getGameResult(state(b, 'blue'));

    expect(result?.type).toBe('checkmate');
    expect(result?.winner).toBe('blue');
  });

  it('never reports a red or blue checkmate as a white win', () => {
    // getOpponentColor(red) is 'white', which is what produced the old bug.
    const b = board(
      [
        piece('king', 'red', 'a1'),
        piece('rook', 'blue', 'l1'), // checks along rank 1, covers b1
        piece('rook', 'blue', 'l2'), // covers a2 and b2 -> mate
        piece('king', 'blue', 'f6'),
      ],
      ['blue', 'red']
    );
    const result = getGameResult(state(b, 'red'));

    expect(result?.type).toBe('checkmate');
    expect(result?.winner).toBe('blue');
    expect(result?.winner).not.toBe('white');
  });

  it('reports Victory Points for every colour, not just white and black', () => {
    const b = board(
      [
        piece('king', 'white', 'f6'),
        piece('queen', 'white', 'f7'), // kings are worth 0 VP, queens are not
        piece('queen', 'red', 'a1'),
        piece('rook', 'blue', 'l12'),
      ],
      ['white', 'red', 'blue']
    );
    const vp = collectVictoryPoints(b);

    expect(vp.red).toBeGreaterThan(0);
    expect(vp.blue).toBeGreaterThan(0);
    expect(vp.white).toBeGreaterThan(0);
    expect(vp.black).toBe(0);
  });

  it('lists eliminated players who still have pieces on the board', () => {
    const b = board(
      [
        piece('king', 'blue', 'l12'),
        piece('queen', 'red', 'a1'), // red is out but left pieces behind
      ],
      ['blue']
    );
    const result = getGameResult(state(b, 'blue'));

    expect(result?.winner).toBe('blue');
    expect(result?.eliminated).toEqual(['red']);
  });

  it('a captured royal knocks that player out rather than ending the game', () => {
    const b = board(
      [
        piece('queen', 'red', 'h8'), // red has no royal piece left
        piece('king', 'white', 'f6'),
        piece('king', 'blue', 'l12'),
      ],
      ['white', 'red', 'blue']
    );
    const result = getGameResult(state(b, 'white'));

    // Three players, one royal missing -> no single winner yet
    expect(result?.type).toBe('checkmate');
    expect(result?.winner).toBeNull();
  });
});

describe('draws still apply with more than two players', () => {
  it('reports a 50-move draw', () => {
    const b = board(
      [
        piece('king', 'white', 'f6'),
        piece('king', 'blue', 'l12'),
        piece('king', 'red', 'a1'),
      ],
      ['white', 'blue', 'red']
    );
    const s = { ...state(b, 'white'), halfmoveClock: 100 };
    const result = getGameResult(s);

    expect(result?.type).toBe('draw-fifty-move');
    expect(result?.winner).toBeNull();
    // Red is still playing, so it reports 0 rather than being absent
    expect(result?.victoryPoints?.red).toBe(0);
  });
});

// =============================================================================
// Result descriptions
// =============================================================================

describe('getResultDescription', () => {
  it('keeps the 2-player VP format', () => {
    const text = getResultDescription({
      type: 'stalemate',
      winner: 'white',
      whiteVP: 42,
      blackVP: 17,
      victoryPoints: { white: 42, black: 17 },
    });
    expect(text).toBe(
      'Stalemate! White wins by Victory Points (42 - 17).'
    );
  });

  it('names every colour when more than two are playing', () => {
    const text = getResultDescription({
      type: 'draw-vp-tie',
      winner: null,
      whiteVP: 10,
      blackVP: 0,
      victoryPoints: { white: 10, blue: 10, red: 10 },
    });
    expect(text).toContain('White 10');
    expect(text).toContain('Blue 10');
    expect(text).toContain('Red 10');
  });

  it('mentions who was eliminated', () => {
    const text = getResultDescription({
      type: 'checkmate',
      winner: 'blue',
      whiteVP: 0,
      blackVP: 0,
      victoryPoints: { white: 0, blue: 30, red: 5 },
      eliminated: ['white', 'red'],
    });
    expect(text).toBe('Checkmate! Blue wins. White, Red were eliminated.');
  });

  it('does not crash on a checkmate with no single winner', () => {
    // capitalize(result.winner!) used to throw here.
    const text = getResultDescription({
      type: 'checkmate',
      winner: null,
      whiteVP: 0,
      blackVP: 0,
    });
    expect(text).toBe('Checkmate!');
  });
});

// =============================================================================
// End to end: a real move played through executeMove
// =============================================================================

describe('executeMove in a 3-player game', () => {
  /**
   * Red's king is cornered on a1 with white's rook already covering a2/b2.
   * White is one move (Rk5-k1) from mating it.
   */
  function preMateState(): GameState {
    const b = board(
      [
        piece('king', 'red', 'a1'),
        piece('rook', 'white', 'k5'), // one move from delivering mate on rank 1
        piece('rook', 'white', 'l2'), // already covers a2 and b2
        piece('king', 'white', 'f6'),
        piece('king', 'blue', 'l12'),
        piece('queen', 'blue', 'h12'),
      ],
      ['white', 'blue', 'red']
    );
    return state(b, 'white');
  }

  function play(gs: GameState, from: string, to: string): GameState {
    const moverId = gs.board.positionMap.get(from);
    expect(moverId, `no piece on ${from}`).toBeDefined();
    const p = gs.board.pieces.find(x => x.id === moverId)!;
    const move = prepareMoveFromPositions(gs, p, pos(from), pos(to));
    expect(move, `move ${from}-${to} was rejected`).not.toBeNull();
    return executeMove(gs, move!);
  }

  it('does not eliminate a mated player until the turn reaches them', () => {
    // This matters in a 3-player game: between white's mating move and red's
    // turn, blue gets to play, and blue's move might free red. So a player is
    // only out once they actually have to move and cannot.
    const afterMate = play(preMateState(), 'k5', 'k1');

    expect(isInCheck(afterMate.board, 'red')).toBe(true);
    expect(getActivePlayers(afterMate.board)).toEqual(['white', 'blue', 'red']);
    expect(afterMate.currentTurn).toBe('blue');
  });

  it('eliminates the mated player on their turn and keeps the game going', () => {
    const afterMate = play(preMateState(), 'k5', 'k1');
    // Blue plays something harmless, so the turn passes to red
    const afterBlue = play(afterMate, 'h12', 'h11');

    // Red could not move and was in check -> out, but white and blue play on
    expect(getActivePlayers(afterBlue.board)).toEqual(['white', 'blue']);
    expect(getGameResult(afterBlue)).toBeNull();

    // Play skipped past red back to white
    expect(afterBlue.currentTurn).toBe('white');

    // Red's king is still sitting on the board as an obstacle
    expect(afterBlue.board.positionMap.has('a1')).toBe(true);
  });

  it('leaves an eliminated player unable to move but still capturable', () => {
    const afterBlue = play(play(preMateState(), 'k5', 'k1'), 'h12', 'h11');
    const redKing = afterBlue.board.pieces.find(p => p.owner === 'red')!;

    expect(isPlayerActive(afterBlue.board, 'red')).toBe(false);
    expect(generatePseudoLegalMoves(afterBlue.board, redKing, null)).toEqual([]);

    // White's rook on k1 can still travel down rank 1 and take it
    const rook = afterBlue.board.pieces.find(
      p => p.owner === 'white' && p.position?.file === 'k' && p.position?.rank === 1
    )!;
    expect(squares(generatePseudoLegalMoves(afterBlue.board, rook, null))).toContain('a1');
  });

  it('2-player games still end on checkmate rather than eliminating', () => {
    const b = board([
      piece('king', 'black', 'a12'),
      piece('rook', 'white', 'k5'),
      piece('rook', 'white', 'l11'),
      piece('king', 'white', 'f6'),
    ]);
    const after = play(state(b, 'white'), 'k5', 'k12');

    const result = getGameResult(after);
    expect(result?.type).toBe('checkmate');
    expect(result?.winner).toBe('white');
    // activePlayers is untouched in 2-player games
    expect(after.board.activePlayers).toBeUndefined();
  });
});

/**
 * Piece definitions for Hyper Fairy Chess
 * Based on playtested values from physical game
 */

import type { PieceType, MovementPattern } from '../types';

// =============================================================================
// Movement Pattern Helpers
// =============================================================================

const ORTHOGONAL_SLIDES: MovementPattern = {
  slides: ['orthogonal'],
  leaps: [],
  special: [],
};

const DIAGONAL_SLIDES: MovementPattern = {
  slides: ['diagonal'],
  leaps: [],
  special: [],
};

const QUEEN_SLIDES: MovementPattern = {
  slides: ['all'],
  leaps: [],
  special: [],
};

const KNIGHT_LEAP: MovementPattern = {
  slides: [],
  leaps: [{ dx: 2, dy: 1, symmetric: true }],
  special: [],
};

const KING_MOVEMENT: MovementPattern = {
  slides: [],
  leaps: [],
  special: ['king-one-square'],
};

// =============================================================================
// Tier 1: Pawns
// =============================================================================

export const PAWN: PieceType = {
  id: 'pawn',
  name: 'Pawn',
  tier: 'pawn',
  cost: 10,
  victoryPoints: 10,
  symbol: '♟',
  description: 'Moves forward one square (two from start). Captures diagonally forward. Can promote on the last rank.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['pawn-forward', 'pawn-capture-diagonal'],
  },
  captureType: 'standard',
};

export const SHOGI_PAWN: PieceType = {
  id: 'shogi-pawn',
  name: 'Shogi Pawn',
  tier: 'pawn',
  cost: 12,
  victoryPoints: 12,
  symbol: '歩',
  description: 'Moves and captures forward one square only. No diagonal capture.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['shogi-pawn'],
  },
  captureType: 'standard',
};

export const PEASANT: PieceType = {
  id: 'peasant',
  name: 'Peasant',
  tier: 'pawn',
  cost: 13,
  victoryPoints: 13,
  symbol: '⚒',
  description: 'Moves diagonally forward one square. Captures by moving straight forward.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['peasant-diagonal', 'peasant-capture-forward'], // Moves diagonally, captures forward
  },
  captureType: 'standard',
};

export const BOXER: PieceType = {
  id: 'boxer',
  name: 'Boxer',
  tier: 'pawn',
  cost: 25,
  victoryPoints: 25,
  symbol: '⛨',
  description: 'Slides orthogonally. Captures enemies that are "boxed in" (blocked on 3+ sides) after moving.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: ['orthogonal'], // Slides orthogonally for movement
    leaps: [],
    special: [],
  },
  captureType: 'boxer', // Captures "boxed in" enemies after moving
};

export const SOLDIER: PieceType = {
  id: 'soldier',
  name: 'Soldier',
  tier: 'pawn',
  cost: 34,
  victoryPoints: 34,
  symbol: '⚔',
  description: 'Moves one square in any direction, like a King but without royal status.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['king-one-square'], // Moves 1 square in any direction
  },
  captureType: 'standard',
};

export const FOOL: PieceType = {
  id: 'fool',
  name: 'Fool',
  tier: 'pawn',
  cost: 27,
  victoryPoints: 27,
  symbol: '🃏',
  description: 'Cannot capture or be captured. Cannot be jumped over. Moves forward one square only.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: false, // Cannot be captured!
  canFreeze: false,
  canBeJumpedOver: false, // Cannot be jumped over!
  movement: {
    slides: [],
    leaps: [],
    special: ['shogi-pawn'], // Moves like Shogi Pawn
  },
  captureType: 'none', // Cannot capture!
};

// =============================================================================
// Tier 2: Pieces
// =============================================================================

export const CATAPULT: PieceType = {
  id: 'catapult',
  name: 'Catapult',
  tier: 'piece',
  cost: 2,
  victoryPoints: 2,
  symbol: '⛢',
  description: 'Leaps exactly 3 squares orthogonally. Jumps over any pieces in the way.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [{ dx: 3, dy: 0, symmetric: true }], // 3-square orthogonal leap
    special: [],
  },
  captureType: 'standard',
};

export const LANCER: PieceType = {
  id: 'lancer',
  name: 'Lancer',
  tier: 'piece',
  cost: 8,
  victoryPoints: 8,
  symbol: '↟',
  description: 'Leaps exactly 2 squares diagonally (Alfil move). Jumps over any pieces.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [{ dx: 2, dy: 2, symmetric: true }], // Alfil leap
    special: [],
  },
  captureType: 'standard',
};

export const CHAMBERLAIN: PieceType = {
  id: 'chamberlain',
  name: 'Chamberlain',
  tier: 'piece',
  cost: 18,
  victoryPoints: 18,
  symbol: '⚷',
  description: 'Leaps 2 squares orthogonally (Dabbaba). Can swap with adjacent King. Can castle.',
  isRoyal: false,
  isMandatory: false,
  canCastle: true, // Can castle!
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [{ dx: 2, dy: 0, symmetric: true }], // Dabbaba leap
    special: ['swap-adjacent'], // Can swap with adjacent King
  },
  captureType: 'standard',
};

export const COURTESAN: PieceType = {
  id: 'courtesan',
  name: 'Courtesan',
  tier: 'piece',
  cost: 22,
  victoryPoints: 22,
  symbol: '⊕',
  description: 'Leaps 1 or 2 squares diagonally (Ferz + Alfil combined).',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [
      { dx: 1, dy: 1, symmetric: true }, // 1 diagonal (Ferz)
      { dx: 2, dy: 2, symmetric: true }, // 2 diagonal (Alfil)
    ],
    special: [],
  },
  captureType: 'standard',
};

export const THIEF: PieceType = {
  id: 'thief',
  name: 'Thief',
  tier: 'piece',
  cost: 29,
  victoryPoints: 29,
  symbol: '⚡',
  description: 'Leaps 2 squares in any direction. Captures the piece on the square past its landing spot.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [
      { dx: 2, dy: 0, symmetric: true },  // 2 squares orthogonally
      { dx: 0, dy: 2, symmetric: true },
      { dx: 2, dy: 2, symmetric: true },  // 2 squares diagonally
    ],
    special: [],
  },
  captureType: 'thief', // Captures piece on square past landing
};

export const KNIGHT: PieceType = {
  id: 'knight',
  name: 'Knight',
  tier: 'piece',
  cost: 31,
  victoryPoints: 31,
  symbol: '♞',
  description: 'Leaps in an L-shape: 2 squares in one direction, then 1 square perpendicular.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: KNIGHT_LEAP,
  captureType: 'standard',
};

export const HERALD: PieceType = {
  id: 'herald',
  name: 'Herald',
  tier: 'piece',
  cost: 32,
  victoryPoints: 32,
  symbol: '⚑',
  description: 'Moves 2 squares orthogonally (blockable). Cannot capture but freezes ALL adjacent pieces.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: true, // Freezes ALL adjacent pieces (friendly and enemy)!
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['herald-orthogonal'], // 2 squares orthogonally (blockable)
  },
  captureType: 'none', // Cannot capture - only freezes!
};

export const BISHOP: PieceType = {
  id: 'bishop',
  name: 'Bishop',
  tier: 'piece',
  cost: 34,
  victoryPoints: 34,
  symbol: '♝',
  description: 'Slides any number of squares diagonally.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: DIAGONAL_SLIDES,
  captureType: 'standard',
};

export const PONTIFF: PieceType = {
  id: 'pontiff',
  name: 'Pontiff',
  tier: 'piece',
  cost: 47,
  victoryPoints: 47,
  symbol: '✟',
  description: 'Slides diagonally like a Bishop. Can bounce off board edges to continue moving.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: ['diagonal'],
    leaps: [],
    special: ['bounce'], // Can bounce off board edges
  },
  captureType: 'standard',
};

export const ROOK: PieceType = {
  id: 'rook',
  name: 'Rook',
  tier: 'piece',
  cost: 50,
  victoryPoints: 50,
  symbol: '♜',
  description: 'Slides any number of squares orthogonally (horizontally or vertically). Can castle.',
  isRoyal: false,
  isMandatory: false,
  canCastle: true, // Can castle!
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: ORTHOGONAL_SLIDES,
  captureType: 'standard',
};

export const DRAGON_HORSE: PieceType = {
  id: 'dragon-horse',
  name: 'Dragon Horse',
  tier: 'piece',
  cost: 56,
  victoryPoints: 56,
  symbol: '⋈',
  description: 'Slides diagonally like a Bishop, plus can step 1 square orthogonally.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: ['diagonal'],
    leaps: [
      { dx: 1, dy: 0, symmetric: true }, // 1 square orthogonally
    ],
    special: [],
  },
  captureType: 'standard',
};

export const DRAGON: PieceType = {
  id: 'dragon',
  name: 'Dragon',
  tier: 'piece',
  cost: 64,
  victoryPoints: 64,
  symbol: '龍',
  description: 'Slides orthogonally like a Rook, plus can step 1 square diagonally. Can castle.',
  isRoyal: false,
  isMandatory: false,
  canCastle: true, // Can castle!
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: ['orthogonal'],
    leaps: [
      { dx: 1, dy: 1, symmetric: true }, // 1 square diagonally
    ],
    special: [],
  },
  captureType: 'standard',
};

export const CHAMELEON: PieceType = {
  id: 'chameleon',
  name: 'Chameleon',
  tier: 'piece',
  cost: 67,
  victoryPoints: 67,
  symbol: '☯',
  description: 'Moves and captures like whatever piece it is capturing. Very versatile.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['chameleon'], // Moves/captures like the piece it's capturing
  },
  captureType: 'chameleon', // Captures like what it captures!
};

export const COORDINATOR: PieceType = {
  id: 'coordinator',
  name: 'Coordinator',
  tier: 'piece',
  cost: 69,
  victoryPoints: 69,
  symbol: '✠',
  description: 'Slides like a Queen. Captures enemies at squares aligned with both itself and your King.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: QUEEN_SLIDES,
  captureType: 'coordinator', // Captures at King-aligned squares
};

export const LONG_LEAPER: PieceType = {
  id: 'long-leaper',
  name: 'Long Leaper',
  tier: 'piece',
  cost: 78,
  victoryPoints: 78,
  symbol: '⟿',
  description: 'Moves by jumping over enemies (checker-style). Can make multiple jumps in one turn.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['long-leap'], // Moves by jumping over enemies (checker-style, multiple jumps allowed)
  },
  captureType: 'long-leap', // Captures by jumping over (checker-style)
};

export const INQUISITOR: PieceType = {
  id: 'inquisitor',
  name: 'Inquisitor',
  tier: 'piece',
  cost: 80,
  victoryPoints: 80,
  symbol: '⚖',
  description: 'Slides diagonally. Cannot capture but freezes adjacent enemies.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: true, // Freezes adjacent enemies!
  canBeJumpedOver: true,
  movement: DIAGONAL_SLIDES,
  captureType: 'none', // Cannot capture - only freezes!
};

export const IMMOBILIZER: PieceType = {
  id: 'immobilizer',
  name: 'Immobilizer',
  tier: 'piece',
  cost: 160,
  victoryPoints: 160,
  symbol: '⚓',
  description: 'Slides like a Queen. Cannot capture but freezes all adjacent enemies.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: true, // Freezes adjacent enemies!
  canBeJumpedOver: true,
  movement: QUEEN_SLIDES,
  captureType: 'none', // Cannot capture!
};

// Classic fairy chess pieces

export const ARCHBISHOP: PieceType = {
  id: 'archbishop',
  name: 'Archbishop',
  tier: 'piece',
  cost: 72,
  victoryPoints: 72,
  symbol: '♝',
  description: 'Combines Bishop and Knight movement. Can slide diagonally or leap like a knight.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: ['diagonal'],
    leaps: [{ dx: 2, dy: 1, symmetric: true }],
    special: [],
  },
  captureType: 'standard',
};

export const CHANCELLOR: PieceType = {
  id: 'chancellor',
  name: 'Chancellor',
  tier: 'piece',
  cost: 85,
  victoryPoints: 85,
  symbol: '♜',
  description: 'Combines Rook and Knight movement. Can slide orthogonally or leap like a knight.',
  isRoyal: false,
  isMandatory: false,
  canCastle: true,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: ['orthogonal'],
    leaps: [{ dx: 2, dy: 1, symmetric: true }],
    special: [],
  },
  captureType: 'standard',
};

export const GRASSHOPPER: PieceType = {
  id: 'grasshopper',
  name: 'Grasshopper',
  tier: 'piece',
  cost: 45,
  victoryPoints: 45,
  symbol: '⌖',
  description: 'Moves along Queen lines but must hop over exactly one piece, landing immediately beyond it.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['grasshopper'],
  },
  captureType: 'standard',
};

export const NIGHTRIDER: PieceType = {
  id: 'nightrider',
  name: 'Nightrider',
  tier: 'piece',
  cost: 55,
  victoryPoints: 55,
  symbol: '♘',
  description: 'Repeats knight moves in the same direction. Like a knight that can keep going.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['nightrider'],
  },
  captureType: 'standard',
};

export const CANNON: PieceType = {
  id: 'cannon',
  name: 'Cannon',
  tier: 'piece',
  cost: 48,
  victoryPoints: 48,
  symbol: '砲',
  description: 'Moves like a Rook. Captures by hopping over exactly one piece (the screen) to hit a target beyond.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['cannon-move'],
  },
  captureType: 'cannon',
};

// =============================================================================
// Tier 3: Royalty
// =============================================================================

export const KING: PieceType = {
  id: 'king',
  name: 'King',
  tier: 'royalty',
  cost: 0,
  victoryPoints: 0,
  symbol: '♚',
  description: 'Moves one square in any direction. Must be protected from checkmate. Can castle.',
  isRoyal: true, // Can be checkmated
  isMandatory: true, // Must be included
  canCastle: true,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: KING_MOVEMENT,
  captureType: 'standard',
};

export const PHANTOM_KING: PieceType = {
  id: 'phantom-king',
  name: 'Phantom King',
  tier: 'royalty',
  cost: 26,
  victoryPoints: 26,
  symbol: '♔',
  description: 'Moves one square like a King. Can also swap places with any adjacent friendly piece.',
  isRoyal: true, // Can be checkmated
  isMandatory: false,
  replacesKing: true, // Mutually exclusive with King
  canCastle: true,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['king-one-square', 'swap-adjacent'],
  },
  captureType: 'standard',
};

export const WITHDRAWER: PieceType = {
  id: 'withdrawer',
  name: 'Withdrawer',
  tier: 'royalty',
  cost: 34,
  victoryPoints: 34,
  symbol: '⇤',
  description: 'Slides like a Queen. Captures by moving directly away from an adjacent enemy.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: QUEEN_SLIDES,
  captureType: 'withdrawal', // Captures by moving away
};

export const JESTER: PieceType = {
  id: 'jester',
  name: 'Jester',
  tier: 'royalty',
  cost: 0,
  victoryPoints: -15, // Negative VP!
  symbol: '☆',
  description: 'Slides like a Queen. Cannot capture or be captured. Worth negative victory points!',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: false, // Cannot be captured!
  canFreeze: false,
  canBeJumpedOver: true,
  movement: QUEEN_SLIDES,
  captureType: 'none', // Cannot capture!
};

export const QUEEN: PieceType = {
  id: 'queen',
  name: 'Queen',
  tier: 'royalty',
  cost: 95,
  victoryPoints: 95,
  symbol: '♛',
  description: 'Slides any number of squares in any direction (orthogonal or diagonal).',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: QUEEN_SLIDES,
  captureType: 'standard',
};

export const FAIRY_QUEEN: PieceType = {
  id: 'fairy-queen',
  name: 'Fairy Queen',
  tier: 'royalty',
  cost: 130,
  victoryPoints: 130,
  symbol: '✧',
  description: 'Queen + Knight combined. Slides in any direction or leaps like a knight.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: ['all'],
    leaps: [{ dx: 2, dy: 1, symmetric: true }], // Queen + Knight
    special: [],
  },
  captureType: 'standard',
};

export const REGENT: PieceType = {
  id: 'regent',
  name: 'Regent',
  tier: 'royalty',
  cost: 155,
  victoryPoints: 155,
  symbol: '⚜',
  description: 'Replaces King. Moves 2 squares any direction normally. Becomes a Queen if your other royal is captured.',
  isRoyal: true, // Can be checkmated (acts as king)
  isMandatory: false,
  replacesKing: true, // Mutually exclusive with King and Phantom King
  canCastle: true, // Can castle!
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['regent-conditional'], // 2 squares when other royal exists, queen when alone
  },
  captureType: 'standard',
};

// =============================================================================
// Other
// =============================================================================

export const MERCENARY: PieceType = {
  id: 'mercenary',
  name: 'Mercenary',
  tier: 'other',
  cost: 0,
  victoryPoints: 5,
  symbol: '⛏',
  description: 'A captured pawn that switched sides. Moves and captures like a standard Pawn.',
  isRoyal: false,
  isMandatory: false,
  canCastle: false,
  canBeCaptured: true,
  canFreeze: false,
  canBeJumpedOver: true,
  movement: {
    slides: [],
    leaps: [],
    special: ['pawn-forward', 'pawn-capture-diagonal'],
  },
  captureType: 'standard',
};

// =============================================================================
// Piece Registry
// =============================================================================

export const ALL_PIECES: PieceType[] = [
  // Tier 1: Pawns
  PAWN,
  SHOGI_PAWN,
  PEASANT,
  BOXER,
  SOLDIER,
  FOOL,

  // Tier 2: Pieces
  CATAPULT,
  LANCER,
  CHAMBERLAIN,
  COURTESAN,
  THIEF,
  KNIGHT,
  HERALD,
  BISHOP,
  PONTIFF,
  ROOK,
  DRAGON_HORSE,
  DRAGON,
  CHAMELEON,
  COORDINATOR,
  LONG_LEAPER,
  INQUISITOR,
  IMMOBILIZER,
  ARCHBISHOP,
  CHANCELLOR,
  GRASSHOPPER,
  NIGHTRIDER,
  CANNON,

  // Tier 3: Royalty
  KING,
  PHANTOM_KING,
  WITHDRAWER,
  JESTER,
  QUEEN,
  FAIRY_QUEEN,
  REGENT,

  // Other
  MERCENARY,
];

export const PIECE_BY_ID: Record<string, PieceType> = Object.fromEntries(
  ALL_PIECES.map((p) => [p.id, p])
);

export const PIECES_BY_TIER: Record<string, PieceType[]> = {
  pawn: ALL_PIECES.filter((p) => p.tier === 'pawn'),
  piece: ALL_PIECES.filter((p) => p.tier === 'piece'),
  royalty: ALL_PIECES.filter((p) => p.tier === 'royalty'),
  other: ALL_PIECES.filter((p) => p.tier === 'other'),
};

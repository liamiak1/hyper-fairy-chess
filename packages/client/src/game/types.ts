/**
 * Core type definitions for Hyper Fairy Chess
 */

// =============================================================================
// Board & Position Types
// =============================================================================

export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Position {
  file: File;
  rank: Rank;
}

export interface BoardDimensions {
  files: number; // 8, 10, etc.
  ranks: number; // 8, 10, etc.
}

export type BoardSize = '8x8' | '10x8' | '10x10';

export const BOARD_CONFIGS: Record<BoardSize, BoardDimensions & { pawnSlots: number; pieceSlots: number; royaltySlots: number }> = {
  '8x8': { files: 8, ranks: 8, pawnSlots: 8, pieceSlots: 6, royaltySlots: 2 },
  '10x8': { files: 10, ranks: 8, pawnSlots: 10, pieceSlots: 8, royaltySlots: 2 },
  '10x10': { files: 10, ranks: 10, pawnSlots: 10, pieceSlots: 8, royaltySlots: 2 },
};

// =============================================================================
// Player & Color Types
// =============================================================================

export type PlayerColor = 'white' | 'black';

export interface Player {
  color: PlayerColor;
  budget: number;
  remainingBudget: number;
  victoryPoints: number;
}

// =============================================================================
// Piece Types
// =============================================================================

export type PieceTier = 'pawn' | 'piece' | 'royalty' | 'other';

export interface PieceType {
  id: string;
  name: string;
  tier: PieceTier;
  cost: number;
  victoryPoints: number;
  symbol: string; // Unicode or identifier for rendering
  description?: string; // Brief description of piece movement/capture for tooltips

  // Special characteristics
  isRoyal: boolean;        // Can be checkmated (King, Phantom King)
  isMandatory: boolean;    // Must be included (King)
  replacesKing?: boolean;  // Can be selected instead of King (Phantom King, Regent)
  canCastle: boolean;      // Can participate in castling
  canBeCaptured: boolean;  // Fool, Jester cannot be captured
  canFreeze: boolean;      // Immobilizer, Inquisitor, Herald
  canBeJumpedOver: boolean; // Fool cannot be jumped over

  // Movement definition
  movement: MovementPattern;

  // Special capture rules (for Chameleon, Coordinator, etc.)
  captureType: CaptureType;
}

export type CaptureType =
  | 'standard'           // Normal capture by displacement
  | 'withdrawal'         // Withdrawer: move away to capture
  | 'coordinator'        // Capture at King-aligned squares
  | 'boxer'              // Capture "boxed in" enemies (orthogonally adjacent with friendly on opposite side)
  | 'thief'              // Capture piece on square past where thief lands
  | 'long-leap'          // Jump over to capture (checker-style)
  | 'chameleon'          // Capture like the piece being captured
  | 'cannon'             // Hop over screen to capture
  | 'none';              // Immobilizer doesn't capture

// =============================================================================
// Movement Pattern Types
// =============================================================================

export interface MovementPattern {
  // Sliding moves (can move multiple squares in a direction)
  slides: SlideDirection[];

  // Leap moves (jump to specific offset)
  leaps: LeapOffset[];

  // Special movement rules
  special: SpecialMovement[];
}

export type SlideDirection =
  | 'orthogonal'  // Rook-like
  | 'diagonal'    // Bishop-like
  | 'all';        // Queen-like (both)

export interface LeapOffset {
  dx: number;  // File offset
  dy: number;  // Rank offset
  // If symmetric, also allows (-dx, dy), (dx, -dy), (-dx, -dy), (dy, dx), etc.
  symmetric: boolean;
}

export type SpecialMovement =
  | 'pawn-forward'         // Pawn: forward 1 (2 from start)
  | 'pawn-capture-diagonal' // Pawn: capture diagonally forward
  | 'shogi-pawn'           // Forward only, capture forward
  | 'berolina'             // Inverse pawn
  | 'peasant-diagonal'     // Peasant: move diagonally forward (2 on first move)
  | 'peasant-capture-forward' // Peasant: capture forward only
  | 'regent-conditional'   // Regent: 2 squares when other royal exists, queen when alone
  | 'herald-orthogonal'    // Herald: 2 squares orthogonally (blockable)
  | 'king-one-square'      // King: 1 square any direction
  | 'knight-rider'         // Extended knight moves in a line
  | 'grasshopper'          // Must hop over exactly one piece
  | 'cannon-move'          // Slides freely, captures by hopping
  | 'bounce'               // Pontiff: can bounce off edges
  | 'swap-adjacent'        // Phantom King, Chamberlain
  | 'nightrider'           // Repeating knight moves
  | 'long-leap'            // Long Leaper: jump over enemies to capture (multiple in one line)
  | 'chameleon';           // Chameleon: moves/captures like whatever it's capturing

// =============================================================================
// Game Piece Instance (on the board)
// =============================================================================

export interface PieceInstance {
  id: string;              // Unique instance ID
  typeId: string;          // Reference to PieceType.id
  owner: PlayerColor;
  position: Position | null; // null if captured
  hasMoved: boolean;       // For castling, pawn double-move
  isFrozen: boolean;       // Adjacent to enemy freezer
}

// =============================================================================
// Board State
// =============================================================================

export interface BoardState {
  dimensions: BoardDimensions;
  pieces: PieceInstance[];

  // Quick lookup: position string -> piece ID
  positionMap: Map<string, string>;

  // Tracks if player started with multiple royal pieces (for Regent logic)
  // Set at end of placement phase, used to determine if Regent gets queen powers
  hadMultipleRoyals?: { white: boolean; black: boolean };
}

// =============================================================================
// Game State
// =============================================================================

export type GamePhase =
  | 'setup'       // Choosing board, budget
  | 'draft'       // Selecting pieces
  | 'placement'   // Placing pieces on board
  | 'play'        // Active game
  | 'ended';      // Game over

export type PlacementMode = 'alternating' | 'simultaneous';

export interface DraftState {
  availablePieces: PieceType[];
  whiteArmy: PieceType[];
  blackArmy: PieceType[];
  whiteBudgetRemaining: number;
  blackBudgetRemaining: number;
}

export interface GameState {
  phase: GamePhase;
  boardSize: BoardSize;
  board: BoardState;

  // Players
  players: {
    white: Player;
    black: Player;
  };

  // Turn tracking
  currentTurn: PlayerColor;
  turnNumber: number;

  // Game rules
  pointBudget: number;
  placementMode: PlacementMode;

  // Draft state (during draft phase)
  draft: DraftState | null;

  // Check state
  inCheck: PlayerColor | null;

  // Move history
  moveHistory: Move[];

  // En passant target (if last move was pawn double-move)
  enPassantTarget: Position | null;

  // Game result
  result: GameResult | null;
}

// =============================================================================
// Move Types
// =============================================================================

export interface Move {
  pieceId: string;
  from: Position;
  to: Position;

  // Capture info
  capturedPieceId: string | null;
  capturePosition: Position | null; // May differ from 'to' (en passant, coordinator)

  // Additional captures for special pieces (Coordinator, Boxer)
  additionalCaptures?: { pieceId: string; position: Position }[];

  // Special move types
  isCastling: boolean;
  castlingRookId: string | null;
  castlingRookFrom: Position | null;
  castlingRookTo: Position | null;

  isEnPassant: boolean;
  isPromotion: boolean;
  promotionPieceType: string | null;

  // Swap move (Phantom King, Chamberlain)
  isSwap?: boolean;
  swapPieceId?: string;

  // Notation
  notation: string;
}

// =============================================================================
// Game Result
// =============================================================================

export type GameResultType =
  | 'checkmate'
  | 'stalemate'
  | 'resignation'
  | 'timeout'
  | 'draw-agreement'
  | 'draw-vp-tie';

export interface GameResult {
  type: GameResultType;
  winner: PlayerColor | null; // null for draws

  // VP totals for stalemate resolution
  whiteVP: number;
  blackVP: number;
}

// =============================================================================
// Utility Types
// =============================================================================

export function positionToString(pos: Position): string {
  return `${pos.file}${pos.rank}`;
}

export function stringToPosition(str: string): Position | null {
  const match = str.match(/^([a-j])(\d+)$/);
  if (!match) return null;

  const file = match[1] as File;
  const rank = parseInt(match[2], 10) as Rank;

  if (rank < 1 || rank > 10) return null;

  return { file, rank };
}

export function arePositionsEqual(a: Position, b: Position): boolean {
  return a.file === b.file && a.rank === b.rank;
}

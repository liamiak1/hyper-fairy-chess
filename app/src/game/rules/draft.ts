/**
 * Draft phase logic - piece selection within budget and slot limits
 */

import type {
  PieceType,
  PieceInstance,
  PieceTier,
  PlayerColor,
  BoardSize,
} from '../types';
import { BOARD_CONFIGS } from '../types';
import { ALL_PIECES, PIECE_BY_ID } from '../pieces/pieceDefinitions';

// =============================================================================
// Types
// =============================================================================

export interface DraftSelection {
  pieceTypeId: string;
  count: number;
}

export interface SlotUsage {
  pawn: number;
  piece: number;
  royalty: number;
}

export interface PlayerDraft {
  selections: DraftSelection[];
  budgetSpent: number;
  slotsUsed: SlotUsage;
}

// =============================================================================
// Constants
// =============================================================================

export const MIN_BUDGET = 260;
export const MAX_BUDGET = 900;
export const BUDGET_STEP = 10;

export const BUDGET_PRESETS = [
  { label: 'Minimal', value: 260, description: 'Very tight, forces hard choices' },
  { label: 'Standard', value: 400, description: 'Similar to standard chess value' },
  { label: 'Expanded', value: 600, description: 'Room for experimentation' },
  { label: 'Maximum', value: 900, description: 'Everything available' },
];

// Per-piece-type limits (for pieces with restricted placement positions)
export const MAX_PIECE_COUNTS: Partial<Record<string, number>> = {
  herald: 2, // Only 2 edge files (a and h)
};

// =============================================================================
// Draft Creation
// =============================================================================

/**
 * Create an empty draft (King is auto-included and counts as 1 royalty slot)
 */
export function createEmptyDraft(): PlayerDraft {
  return {
    selections: [],
    budgetSpent: 0,
    slotsUsed: { pawn: 0, piece: 0, royalty: 1 }, // King takes 1 royalty slot
  };
}

// =============================================================================
// Available Pieces
// =============================================================================

/**
 * Get all pieces available for drafting (excludes mandatory pieces like King)
 */
export function getAvailablePieces(): PieceType[] {
  return ALL_PIECES.filter((p) => !p.isMandatory);
}

/**
 * Get pieces grouped by tier
 */
export function getPiecesByTier(): Record<PieceTier, PieceType[]> {
  const pieces = getAvailablePieces();
  return {
    pawn: pieces.filter((p) => p.tier === 'pawn'),
    piece: pieces.filter((p) => p.tier === 'piece'),
    royalty: pieces.filter((p) => p.tier === 'royalty'),
    other: pieces.filter((p) => p.tier === 'other'),
  };
}

// =============================================================================
// Slot Management
// =============================================================================

/**
 * Get slot limits for a board size
 */
export function getSlotLimits(boardSize: BoardSize): SlotUsage {
  const config = BOARD_CONFIGS[boardSize];
  return {
    pawn: config.pawnSlots,
    piece: config.pieceSlots,
    royalty: config.royaltySlots,
  };
}

/**
 * Get the slot type for a piece tier
 */
function getTierSlotKey(tier: PieceTier): keyof SlotUsage | null {
  switch (tier) {
    case 'pawn':
      return 'pawn';
    case 'piece':
      return 'piece';
    case 'royalty':
      return 'royalty';
    default:
      return null;
  }
}

// =============================================================================
// King Replacement Logic
// =============================================================================

/**
 * Check if the draft has a piece that replaces King (Phantom King, Regent)
 */
export function hasKingReplacer(draft: PlayerDraft): boolean {
  return draft.selections.some((s) => {
    const pieceType = PIECE_BY_ID[s.pieceTypeId];
    return pieceType?.replacesKing === true;
  });
}

/**
 * Get the king-replacing piece in the draft (if any)
 */
export function getKingReplacer(draft: PlayerDraft): PieceType | null {
  for (const selection of draft.selections) {
    const pieceType = PIECE_BY_ID[selection.pieceTypeId];
    if (pieceType?.replacesKing) {
      return pieceType;
    }
  }
  return null;
}

// =============================================================================
// Draft Operations
// =============================================================================

/**
 * Check if a piece can be added to the draft
 */
export function canAddPiece(
  draft: PlayerDraft,
  pieceType: PieceType,
  budget: number,
  boardSize: BoardSize
): boolean {
  // Check budget
  if (draft.budgetSpent + pieceType.cost > budget) {
    return false;
  }

  // Check slot limits
  const slotKey = getTierSlotKey(pieceType.tier);
  if (slotKey) {
    const limits = getSlotLimits(boardSize);
    // King-replacing pieces don't use an extra royalty slot - they reuse the King's slot
    const usesExtraSlot = !(pieceType.replacesKing && slotKey === 'royalty');
    if (usesExtraSlot && draft.slotsUsed[slotKey] >= limits[slotKey]) {
      return false;
    }
  }

  // Only one king-type piece allowed (King, Phantom King, or Regent)
  if (pieceType.replacesKing && hasKingReplacer(draft)) {
    return false;
  }

  // Check per-piece-type limits (e.g., Herald max 2)
  const maxCount = MAX_PIECE_COUNTS[pieceType.id];
  if (maxCount !== undefined) {
    const currentCount = getPieceCountInDraft(draft, pieceType.id);
    if (currentCount >= maxCount) {
      return false;
    }
  }

  return true;
}

/**
 * Add a piece to the draft
 */
export function addPieceToDraft(
  draft: PlayerDraft,
  pieceType: PieceType
): PlayerDraft {
  const existingIndex = draft.selections.findIndex(
    (s) => s.pieceTypeId === pieceType.id
  );

  let newSelections: DraftSelection[];
  if (existingIndex >= 0) {
    // Increment existing selection
    newSelections = draft.selections.map((s, i) =>
      i === existingIndex ? { ...s, count: s.count + 1 } : s
    );
  } else {
    // Add new selection
    newSelections = [...draft.selections, { pieceTypeId: pieceType.id, count: 1 }];
  }

  // Update slot usage
  const slotKey = getTierSlotKey(pieceType.tier);
  const newSlotsUsed = { ...draft.slotsUsed };
  if (slotKey) {
    // King-replacing pieces don't add to royalty slots (they replace the King's slot)
    if (pieceType.replacesKing && slotKey === 'royalty') {
      // No change - replacing King's slot
    } else {
      newSlotsUsed[slotKey] = draft.slotsUsed[slotKey] + 1;
    }
  }

  return {
    selections: newSelections,
    budgetSpent: draft.budgetSpent + pieceType.cost,
    slotsUsed: newSlotsUsed,
  };
}

/**
 * Remove one instance of a piece from the draft
 */
export function removePieceFromDraft(
  draft: PlayerDraft,
  pieceTypeId: string
): PlayerDraft {
  const existingIndex = draft.selections.findIndex(
    (s) => s.pieceTypeId === pieceTypeId
  );

  if (existingIndex < 0) return draft;

  const pieceType = PIECE_BY_ID[pieceTypeId];
  if (!pieceType) return draft;

  const existing = draft.selections[existingIndex];
  let newSelections: DraftSelection[];

  if (existing.count > 1) {
    // Decrement count
    newSelections = draft.selections.map((s, i) =>
      i === existingIndex ? { ...s, count: s.count - 1 } : s
    );
  } else {
    // Remove entirely
    newSelections = draft.selections.filter((_, i) => i !== existingIndex);
  }

  // Update slot usage
  const slotKey = getTierSlotKey(pieceType.tier);
  const newSlotsUsed = { ...draft.slotsUsed };
  if (slotKey) {
    // King-replacing pieces don't free royalty slots (King takes the slot back)
    if (pieceType.replacesKing && slotKey === 'royalty') {
      // No change - King takes the slot back
    } else {
      newSlotsUsed[slotKey] = Math.max(0, draft.slotsUsed[slotKey] - 1);
    }
  }

  return {
    selections: newSelections,
    budgetSpent: draft.budgetSpent - pieceType.cost,
    slotsUsed: newSlotsUsed,
  };
}

// =============================================================================
// Draft Validation
// =============================================================================

export interface DraftValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a draft
 */
export function validateDraft(
  draft: PlayerDraft,
  budget: number,
  boardSize: BoardSize
): DraftValidation {
  const errors: string[] = [];
  const limits = getSlotLimits(boardSize);

  // Check budget
  if (draft.budgetSpent > budget) {
    errors.push(`Over budget by ${draft.budgetSpent - budget} points`);
  }

  // Check slot limits
  if (draft.slotsUsed.pawn > limits.pawn) {
    errors.push(`Too many pawns: ${draft.slotsUsed.pawn}/${limits.pawn}`);
  }
  if (draft.slotsUsed.piece > limits.piece) {
    errors.push(`Too many pieces: ${draft.slotsUsed.piece}/${limits.piece}`);
  }
  if (draft.slotsUsed.royalty > limits.royalty) {
    errors.push(`Too many royalty: ${draft.slotsUsed.royalty}/${limits.royalty}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Create Pieces from Draft
// =============================================================================

let draftPieceIdCounter = 0;

/**
 * Reset the piece ID counter (call when starting a new game)
 */
export function resetDraftPieceIdCounter(): void {
  draftPieceIdCounter = 0;
}

/**
 * Create PieceInstance array from a draft (for placement phase)
 */
export function createPiecesFromDraft(
  draft: PlayerDraft,
  color: PlayerColor
): PieceInstance[] {
  const pieces: PieceInstance[] = [];

  // Add King only if no king-replacing piece was selected
  if (!hasKingReplacer(draft)) {
    const king = PIECE_BY_ID['king'];
    if (king) {
      pieces.push({
        id: `${color}-king-${draftPieceIdCounter++}`,
        typeId: 'king',
        owner: color,
        position: null,
        hasMoved: false,
        isFrozen: false,
      });
    }
  }

  // Add drafted pieces
  for (const selection of draft.selections) {
    const pieceType = PIECE_BY_ID[selection.pieceTypeId];
    if (!pieceType) continue;

    for (let i = 0; i < selection.count; i++) {
      pieces.push({
        id: `${color}-${selection.pieceTypeId}-${draftPieceIdCounter++}`,
        typeId: selection.pieceTypeId,
        owner: color,
        position: null,
        hasMoved: false,
        isFrozen: false,
      });
    }
  }

  return pieces;
}

/**
 * Get total piece count in draft (including mandatory King if no replacer selected)
 */
export function getDraftPieceCount(draft: PlayerDraft): number {
  const draftedCount = draft.selections.reduce((sum, s) => sum + s.count, 0);
  // Only +1 for King if no king-replacing piece was selected
  return hasKingReplacer(draft) ? draftedCount : draftedCount + 1;
}

/**
 * Get the count of a specific piece type in the draft
 */
export function getPieceCountInDraft(draft: PlayerDraft, pieceTypeId: string): number {
  const selection = draft.selections.find((s) => s.pieceTypeId === pieceTypeId);
  return selection?.count ?? 0;
}

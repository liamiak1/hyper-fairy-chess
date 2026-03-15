/**
 * AI draft builder — greedy heuristic army selector
 */

import type { BoardSize, PlayerDraft } from '@hyper-fairy-chess/shared';
import {
  createEmptyDraft,
  getAvailablePieces,
  canAddPiece,
  addPieceToDraft,
} from '@hyper-fairy-chess/shared';

/**
 * Build an AI draft greedily within the given budget.
 * Strategy: sort non-royal pieces by cost descending, add each that fits.
 */
export function buildAIDraft(budget: number, boardSize: BoardSize): PlayerDraft {
  let draft = createEmptyDraft();

  const pieces = getAvailablePieces()
    .filter((p) => !p.isRoyal && p.cost > 0) // skip royals and zero-cost pieces
    .sort((a, b) => b.cost - a.cost);

  let changed = true;
  while (changed) {
    changed = false;
    for (const piece of pieces) {
      if (canAddPiece(draft, piece, budget, boardSize)) {
        draft = addPieceToDraft(draft, piece);
        changed = true;
        break; // restart from most-expensive each iteration
      }
    }
  }

  return draft;
}

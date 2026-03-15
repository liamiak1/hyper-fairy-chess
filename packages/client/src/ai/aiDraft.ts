/**
 * AI draft builder — balanced army selector
 *
 * Strategy (in order):
 *   1. Fill piece slots with a shuffled unique selection (variety across games)
 *   2. Fill pawn slots with a shuffled unique selection
 *   3. Optionally pick a royalty upgrade if budget allows
 *   4. Spend remaining budget greedily (most expensive that fits)
 *
 * The shuffle ensures the AI doesn't always field the same army.
 * Filling both tiers before greedy-filling ensures a balanced army
 * (pieces + pawns) rather than a stack of expensive pieces only.
 */

import type { BoardSize, PieceType, PlayerDraft } from '@hyper-fairy-chess/shared';
import {
  createEmptyDraft,
  getAvailablePieces,
  getSlotLimits,
  canAddPiece,
  addPieceToDraft,
} from '@hyper-fairy-chess/shared';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildAIDraft(budget: number, boardSize: BoardSize): PlayerDraft {
  let draft = createEmptyDraft();
  const limits = getSlotLimits(boardSize);

  const available = getAvailablePieces().filter((p) => !p.isRoyal && p.cost > 0);

  const pawns   = shuffle(available.filter((p) => p.tier === 'pawn'));
  const pieces  = shuffle(available.filter((p) => p.tier === 'piece'));
  const royals  = available.filter((p) => p.tier === 'royalty').sort((a, b) => a.cost - b.cost);

  // Phase 1 — unique pieces (one of each type, shuffled)
  draft = fillSlots(draft, pieces, limits.piece, budget, boardSize);

  // Phase 2 — unique pawns (one of each type, shuffled)
  draft = fillSlots(draft, pawns, limits.pawn, budget, boardSize);

  // Phase 3 — royalty upgrade (cheapest that fits, optional)
  for (const royal of royals) {
    if (canAddPiece(draft, royal, budget, boardSize)) {
      draft = addPieceToDraft(draft, royal);
      break;
    }
  }

  // Phase 4 — spend remaining budget greedily (most expensive first)
  const allByValue = [...available].sort((a, b) => b.cost - a.cost);
  let changed = true;
  while (changed) {
    changed = false;
    for (const piece of allByValue) {
      if (canAddPiece(draft, piece, budget, boardSize)) {
        draft = addPieceToDraft(draft, piece);
        changed = true;
        break;
      }
    }
  }

  return draft;
}

/** Add one of each piece in `pool` until the slot cap or budget is hit. */
function fillSlots(
  draft: PlayerDraft,
  pool: PieceType[],
  slotCap: number,
  budget: number,
  boardSize: BoardSize
): PlayerDraft {
  const slotKey = pool[0]?.tier === 'pawn' ? 'pawn' : 'piece';
  for (const piece of pool) {
    if (draft.slotsUsed[slotKey as keyof typeof draft.slotsUsed] >= slotCap) break;
    if (canAddPiece(draft, piece, budget, boardSize)) {
      draft = addPieceToDraft(draft, piece);
    }
  }
  return draft;
}

/**
 * Piece placement logic for the placement phase
 */

import type {
  Position,
  BoardState,
  BoardSize,
  PieceInstance,
  PieceTier,
  PlayerColor,
  File,
  Rank,
} from '../types';
import { BOARD_CONFIGS, positionToString } from '../types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import type { PlayerDraft } from './draft';
import { createPiecesFromDraft } from './draft';
import { colorSection, threePlayerSquare } from '../board/topology';

// =============================================================================
// Types
// =============================================================================

export interface PlacementZone {
  position: Position;
  allowedTiers: PieceTier[];
}

export interface PlacementState {
  whitePiecesToPlace: PieceInstance[];
  blackPiecesToPlace: PieceInstance[];
  redPiecesToPlace?: PieceInstance[];
  bluePiecesToPlace?: PieceInstance[];
  currentPlacer: PlayerColor;
  selectedPieceId: string | null;
  mode: 'alternating' | 'blind';
  whiteReady: boolean;
  blackReady: boolean;
}

// =============================================================================
// Placement Zone Definitions
// =============================================================================

const ALL_FILES: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

/**
 * Get piece files for a given board width (edge files, excluding center 2 for royalty)
 * For 8 files: a, b, c, f, g, h (4 pieces per side, 2 center for royalty)
 * For 10 files: a, b, c, d, g, h, i, j (4 pieces per side, 2 center for royalty)
 */
function getPieceFiles(numFiles: number): File[] {
  const allFiles = ALL_FILES.slice(0, numFiles);
  const centerIndex = Math.floor(numFiles / 2);
  // Exclude the center 2 files (royalty positions)
  return allFiles.filter((_, i) => i < centerIndex - 1 || i > centerIndex);
}

/**
 * Get royalty files (center 2 files)
 * For 8 files: d, e (indices 3, 4)
 * For 10 files: e, f (indices 4, 5)
 */
function getRoyaltyFiles(numFiles: number): File[] {
  const centerIndex = Math.floor(numFiles / 2);
  return [ALL_FILES[centerIndex - 1], ALL_FILES[centerIndex]];
}

/**
 * Get herald files (first and last file of the board)
 */
function getHeraldFiles(numFiles: number): File[] {
  return [ALL_FILES[0], ALL_FILES[numFiles - 1]];
}

// Files c–j (indices 2-9) for 4-player pawn rows
const FOUR_PLAYER_INNER_FILES: File[] = ['c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
// Royalty files for 4-player inner area: f, g (center 2 of c–j: indices 3 and 4)
const FOUR_PLAYER_ROYALTY_FILES: File[] = ['f', 'g'];
// Piece files for 4-player: c, d, e, h, i, j (inner files excluding royalty center f, g)
const FOUR_PLAYER_PIECE_FILES: File[] = ['c', 'd', 'e', 'h', 'i', 'j'];
// Herald edge files for white/black in 4-player: first and last of c–j
const FOUR_PLAYER_HERALD_FILES: File[] = ['c', 'j'];
// Herald edge ranks for red/blue in 4-player: first and last of 3–10
const FOUR_PLAYER_HERALD_RANKS: Rank[] = [3, 10];

/**
 * Get placement zones for a player on a given board size
 */
export function getPlacementZones(boardSize: BoardSize, color: PlayerColor): PlacementZone[] {
  const config = BOARD_CONFIGS[boardSize];
  const zones: PlacementZone[] = [];

  if (boardSize === '4player') {
    return getFourPlayerPlacementZones(color);
  }

  if (boardSize === '3player') {
    return getThreePlayerPlacementZones(color);
  }

  // Determine ranks based on color (white/black)
  const backRank: Rank = color === 'white' ? 1 : (config.ranks as Rank);
  const pawnRank: Rank = color === 'white' ? 2 : ((config.ranks - 1) as Rank);

  // Get available files based on board size
  const allFiles = ALL_FILES.slice(0, config.files);
  const royaltyFiles = getRoyaltyFiles(config.files);
  const pieceFiles = getPieceFiles(config.files);

  // Back rank - pieces (Tier 2) on edges, royalty (Tier 3) in center
  for (const file of allFiles) {
    const position: Position = { file, rank: backRank };

    if (royaltyFiles.includes(file)) {
      // Center squares for royalty
      zones.push({ position, allowedTiers: ['royalty'] });
    } else if (pieceFiles.includes(file)) {
      // Edge squares for pieces
      zones.push({ position, allowedTiers: ['piece'] });
    }
  }

  // Pawn rank - all squares for pawns (Tier 1)
  for (const file of allFiles) {
    const position: Position = { file, rank: pawnRank };
    zones.push({ position, allowedTiers: ['pawn'] });
  }

  return zones;
}

/**
 * Placement zones for a player in 3-player mode.
 *
 * Each player fills the two ranks at the back of their own 8-file section,
 * mirroring the standard layout: pieces and royalty on rank 1, pawns on rank 2.
 * That leaves ranks 3 and 4 empty in front of them, and rank 4 is the fold, so
 * the armies are three squares apart rather than the four of a normal board.
 */
function getThreePlayerPlacementZones(color: PlayerColor): PlacementZone[] {
  const zones: PlacementZone[] = [];
  const section = colorSection(color);

  // Local files 1-8 of this player's own section
  for (let local = 1; local <= 8; local++) {
    const back = threePlayerSquare(section, local, 1);
    // Royalty takes the middle two files, pieces the rest
    if (local === 4 || local === 5) {
      zones.push({ position: back, allowedTiers: ['royalty'] });
    } else {
      zones.push({ position: back, allowedTiers: ['piece'] });
    }
    zones.push({
      position: threePlayerSquare(section, local, 2),
      allowedTiers: ['pawn'],
    });
  }

  return zones;
}

/**
 * Get placement zones for a player in 4-player mode.
 * White: backRank=1, pawnRank=2, files c–j
 * Black: backRank=12, pawnRank=11, files c–j
 * Red: backFile='a', pawnFile='b', ranks 3–10
 * Blue: backFile='l', pawnFile='k', ranks 3–10
 */
function getFourPlayerPlacementZones(color: PlayerColor): PlacementZone[] {
  const zones: PlacementZone[] = [];

  if (color === 'white' || color === 'black') {
    const backRank: Rank = color === 'white' ? 1 : 12;
    const pawnRank: Rank = color === 'white' ? 2 : 11;

    for (const file of FOUR_PLAYER_INNER_FILES) {
      if (FOUR_PLAYER_ROYALTY_FILES.includes(file)) {
        zones.push({ position: { file, rank: backRank }, allowedTiers: ['royalty'] });
      } else if (FOUR_PLAYER_PIECE_FILES.includes(file)) {
        zones.push({ position: { file, rank: backRank }, allowedTiers: ['piece'] });
      }
    }
    for (const file of FOUR_PLAYER_INNER_FILES) {
      zones.push({ position: { file, rank: pawnRank }, allowedTiers: ['pawn'] });
    }
  } else {
    // Red: left side (files a=back, b=pawn); Blue: right side (files l=back, k=pawn)
    const backFile: File = color === 'red' ? 'a' : 'l';
    const pawnFile: File = color === 'red' ? 'b' : 'k';
    const innerRanks: Rank[] = [3, 4, 5, 6, 7, 8, 9, 10];
    // Royalty ranks: 6, 7 (center 2 of 3–10: indices 3 and 4)
    const royaltyRanks: Rank[] = [6, 7];
    const pieceRanks: Rank[] = [3, 4, 5, 8, 9, 10];

    for (const rank of innerRanks) {
      if (royaltyRanks.includes(rank)) {
        zones.push({ position: { file: backFile, rank }, allowedTiers: ['royalty'] });
      } else if (pieceRanks.includes(rank)) {
        zones.push({ position: { file: backFile, rank }, allowedTiers: ['piece'] });
      }
    }
    for (const rank of innerRanks) {
      zones.push({ position: { file: pawnFile, rank }, allowedTiers: ['pawn'] });
    }
  }

  return zones;
}

/**
 * Get valid placement squares for a piece
 */
export function getValidPlacementSquares(
  board: BoardState,
  piece: PieceInstance,
  zones: PlacementZone[],
  dimensions?: { ranks: number; files: number },
  boardSize?: BoardSize
): Position[] {
  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return [];

  const validSquares: Position[] = [];
  const isHeraldPiece = piece.typeId === 'herald';
  const isPawn = pieceType.tier === 'pawn';

  // Determine herald edge positions based on board type and player color
  let heraldFiles: File[];
  let heraldRanks: Rank[];
  if (boardSize === '4player') {
    if (piece.owner === 'white' || piece.owner === 'black') {
      heraldFiles = FOUR_PLAYER_HERALD_FILES; // c and j (edge inner files)
      heraldRanks = [];
    } else {
      heraldFiles = [];
      heraldRanks = FOUR_PLAYER_HERALD_RANKS; // 3 and 10 (edge inner ranks)
    }
  } else {
    heraldFiles = dimensions ? getHeraldFiles(dimensions.files) : getHeraldFiles(8);
    heraldRanks = [];
  }

  for (const zone of zones) {
    // Check if this zone allows this piece's tier
    if (!zone.allowedTiers.includes(pieceType.tier)) continue;

    // Herald can only be placed on edge positions
    if (isHeraldPiece) {
      if (heraldFiles.length > 0 && !heraldFiles.includes(zone.position.file)) continue;
      if (heraldRanks.length > 0 && !(heraldRanks as number[]).includes(zone.position.rank)) continue;
    }

    // Check if the square is empty
    const posKey = positionToString(zone.position);
    if (board.positionMap.has(posKey)) continue;

    // Block non-pawn pieces from back rank squares where a Herald occupies the pawn rank
    // (only applies to white/black rank-based placement, not red/blue file-based)
    if (
      pieceType.tier === 'piece' &&
      dimensions &&
      heraldFiles.length > 0 &&
      heraldFiles.includes(zone.position.file)
    ) {
      const backRank: Rank = piece.owner === 'white' ? 1 : (dimensions.ranks as Rank);
      if (zone.position.rank === backRank) {
        const pawnRank: Rank = piece.owner === 'white' ? 2 : ((dimensions.ranks - 1) as Rank);
        const pawnPosKey = positionToString({ file: zone.position.file, rank: pawnRank });
        const pieceIdOnPawnRank = board.positionMap.get(pawnPosKey);
        if (pieceIdOnPawnRank) {
          const pieceOnPawnRank = board.pieces.find((p) => p.id === pieceIdOnPawnRank);
          if (pieceOnPawnRank?.typeId === 'herald') {
            continue; // Skip this square - Herald is present, only pawns allowed here
          }
        }
      }
    }

    validSquares.push(zone.position);
  }

  // Special handling for pawns: allow back rank positions where Herald is present
  // (only for white/black rank-based placement)
  if (isPawn && dimensions && heraldFiles.length > 0) {
    for (const file of heraldFiles) {
      const pawnRank: Rank = piece.owner === 'white' ? 2 : ((dimensions.ranks - 1) as Rank);
      const pawnPosKey = positionToString({ file, rank: pawnRank });
      const pieceIdOnPawnRank = board.positionMap.get(pawnPosKey);

      if (pieceIdOnPawnRank) {
        const pieceOnPawnRank = board.pieces.find((p) => p.id === pieceIdOnPawnRank);
        if (pieceOnPawnRank?.typeId === 'herald') {
          const backRank: Rank = piece.owner === 'white' ? 1 : (dimensions.ranks as Rank);
          const backRankPos: Position = { file, rank: backRank };
          const backRankPosKey = positionToString(backRankPos);
          if (!board.positionMap.has(backRankPosKey)) {
            if (!validSquares.some((p) => p.file === file && p.rank === backRank)) {
              validSquares.push(backRankPos);
            }
          }
        }
      }
    }
  }

  return validSquares;
}

/**
 * Check if a placement is valid
 */
export function isValidPlacement(
  board: BoardState,
  piece: PieceInstance,
  position: Position,
  zones: PlacementZone[],
  boardSize?: BoardSize
): boolean {
  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return false;

  // Check if square is empty first
  const posKey = positionToString(position);
  if (board.positionMap.has(posKey)) return false;

  const heraldFiles = boardSize === '4player'
    ? (piece.owner === 'white' || piece.owner === 'black' ? FOUR_PLAYER_HERALD_FILES : [])
    : getHeraldFiles(board.dimensions.files);

  // Special case: Pawns can be placed on back rank if Herald is on pawn rank in that file
  if (pieceType.tier === 'pawn' && heraldFiles.includes(position.file)) {
    const backRank: Rank = piece.owner === 'white' ? 1 : (board.dimensions.ranks as Rank);
    if (position.rank === backRank) {
      // Check if there's a Herald on the pawn rank in this file
      const pawnRank: Rank = piece.owner === 'white' ? 2 : ((board.dimensions.ranks - 1) as Rank);
      const pawnRankPosKey = positionToString({ file: position.file, rank: pawnRank });
      const pieceIdOnPawnRank = board.positionMap.get(pawnRankPosKey);

      if (pieceIdOnPawnRank) {
        const pieceOnPawnRank = board.pieces.find((p) => p.id === pieceIdOnPawnRank);
        if (pieceOnPawnRank?.typeId === 'herald') {
          return true; // Valid - Herald is present, pawn can go to back rank
        }
      }
      return false; // Back rank not valid without Herald
    }
  }

  // Block non-pawn pieces from back rank squares where a Herald occupies the pawn rank
  if (pieceType.tier === 'piece' && heraldFiles.includes(position.file)) {
    const backRank: Rank = piece.owner === 'white' ? 1 : (board.dimensions.ranks as Rank);
    if (position.rank === backRank) {
      // Check if there's a Herald on the pawn rank in this file
      const pawnRank: Rank = piece.owner === 'white' ? 2 : ((board.dimensions.ranks - 1) as Rank);
      const pawnRankPosKey = positionToString({ file: position.file, rank: pawnRank });
      const pieceIdOnPawnRank = board.positionMap.get(pawnRankPosKey);
      if (pieceIdOnPawnRank) {
        const pieceOnPawnRank = board.pieces.find((p) => p.id === pieceIdOnPawnRank);
        if (pieceOnPawnRank?.typeId === 'herald') {
          return false; // Invalid - Herald is present, only pawns allowed here
        }
      }
    }
  }

  // Find the zone for this position
  const zone = zones.find(
    (z) => z.position.file === position.file && z.position.rank === position.rank
  );

  if (!zone) return false;

  // Check if tier is allowed
  if (!zone.allowedTiers.includes(pieceType.tier)) return false;

  return true;
}

// =============================================================================
// Army Creation
// =============================================================================

let pieceIdCounter = 0;

function createPieceInstance(typeId: string, owner: PlayerColor): PieceInstance {
  return {
    id: `${owner}-${typeId}-${pieceIdCounter++}`,
    typeId,
    owner,
    position: null, // No position during placement phase
    hasMoved: false,
    isFrozen: false,
  };
}

/**
 * Create the standard chess army for a player (pieces without positions)
 */
export function createStandardArmyPieces(color: PlayerColor): PieceInstance[] {
  const pieces: PieceInstance[] = [];

  // Royalty (Tier 3)
  pieces.push(createPieceInstance('king', color));
  pieces.push(createPieceInstance('queen', color));

  // Pieces (Tier 2)
  pieces.push(createPieceInstance('rook', color));
  pieces.push(createPieceInstance('rook', color));
  pieces.push(createPieceInstance('knight', color));
  pieces.push(createPieceInstance('knight', color));
  pieces.push(createPieceInstance('bishop', color));
  pieces.push(createPieceInstance('bishop', color));

  // Pawns (Tier 1)
  for (let i = 0; i < 8; i++) {
    pieces.push(createPieceInstance('pawn', color));
  }

  return pieces;
}

/**
 * Create initial placement state for a new game
 */
export function createInitialPlacementState(): PlacementState {
  // Reset counter for consistent IDs in new games
  pieceIdCounter = 0;

  return {
    whitePiecesToPlace: createStandardArmyPieces('white'),
    blackPiecesToPlace: createStandardArmyPieces('black'),
    currentPlacer: 'white',
    selectedPieceId: null,
    mode: 'alternating',
    whiteReady: false,
    blackReady: false,
  };
}

/**
 * Get pieces remaining to be placed for a player
 */
export function getPiecesToPlace(state: PlacementState, color: PlayerColor): PieceInstance[] {
  switch (color) {
    case 'white': return state.whitePiecesToPlace;
    case 'black': return state.blackPiecesToPlace;
    case 'red':   return state.redPiecesToPlace ?? [];
    case 'blue':  return state.bluePiecesToPlace ?? [];
  }
}

/**
 * Check if all pieces have been placed
 */
export function isPlacementComplete(state: PlacementState): boolean {
  if (state.whitePiecesToPlace.length > 0) return false;
  if (state.blackPiecesToPlace.length > 0) return false;
  if (state.redPiecesToPlace && state.redPiecesToPlace.length > 0) return false;
  if (state.bluePiecesToPlace && state.bluePiecesToPlace.length > 0) return false;
  return true;
}

/** Get all colors participating in placement */
function getPlacementColors(state: PlacementState): PlayerColor[] {
  const colors: PlayerColor[] = ['white', 'black'];
  if (state.redPiecesToPlace !== undefined) colors.push('red');
  if (state.bluePiecesToPlace !== undefined) colors.push('blue');
  return colors;
}

/**
 * Get the next placer after a piece is placed
 * For 4-player, cycles white → blue → black → red → ... (TURN_ORDER) skipping done players.
 */
export function getNextPlacer(state: PlacementState, currentPlacer: PlayerColor): PlayerColor {
  const colors = getPlacementColors(state);

  // For 4-player, use TURN_ORDER within the participating colors
  const import_TURN_ORDER: PlayerColor[] = ['white', 'blue', 'black', 'red'];
  const ordered = import_TURN_ORDER.filter(c => colors.includes(c));

  // Find next in order who still has pieces
  const currentIdx = ordered.indexOf(currentPlacer);
  for (let i = 1; i <= ordered.length; i++) {
    const nextColor = ordered[(currentIdx + i) % ordered.length];
    if (getPiecesToPlace(state, nextColor).length > 0) {
      return nextColor;
    }
  }

  return currentPlacer;
}

/**
 * Create placement state from completed drafts
 */
export function createPlacementStateFromDrafts(
  whiteDraft: PlayerDraft,
  blackDraft: PlayerDraft,
  mode: 'alternating' | 'blind' = 'alternating'
): PlacementState {
  return {
    whitePiecesToPlace: createPiecesFromDraft(whiteDraft, 'white'),
    blackPiecesToPlace: createPiecesFromDraft(blackDraft, 'black'),
    currentPlacer: 'white',
    selectedPieceId: null,
    mode,
    whiteReady: false,
    blackReady: false,
  };
}

/**
 * Create placement state from 4-player completed drafts
 */
export function createFourPlayerPlacementState(
  whiteDraft: PlayerDraft,
  blueDraft: PlayerDraft,
  blackDraft: PlayerDraft,
  redDraft: PlayerDraft,
): PlacementState {
  return {
    whitePiecesToPlace: createPiecesFromDraft(whiteDraft, 'white'),
    blackPiecesToPlace: createPiecesFromDraft(blackDraft, 'black'),
    redPiecesToPlace: createPiecesFromDraft(redDraft, 'red'),
    bluePiecesToPlace: createPiecesFromDraft(blueDraft, 'blue'),
    currentPlacer: 'white',
    selectedPieceId: null,
    mode: 'alternating',
    whiteReady: false,
    blackReady: false,
  };
}

// =============================================================================
// Herald Placement Special Rules
// =============================================================================

/**
 * Check if a piece is a Herald (for special placement rules)
 */
export function isHerald(piece: PieceInstance): boolean {
  return piece.typeId === 'herald';
}

/**
 * Get the actual position where a Herald should be placed.
 * Heralds go on the pawn rank/file, not the back rank/file.
 */
export function getHeraldActualPosition(
  clickedPosition: Position,
  color: PlayerColor,
  dimensions: { ranks: number; files?: number }
): Position {
  if (color === 'red') {
    return { file: 'b', rank: clickedPosition.rank };
  }
  if (color === 'blue') {
    const bl = String.fromCharCode(97 + (dimensions.files ?? 12) - 2) as File;
    return { file: bl, rank: clickedPosition.rank };
  }
  const pawnRank: Rank = color === 'white' ? 2 : ((dimensions.ranks - 1) as Rank);
  return {
    file: clickedPosition.file,
    rank: pawnRank,
  };
}

/**
 * Get the back rank/file position for a pawn that swaps with a Herald.
 */
export function getPawnSwapPosition(
  file: File,
  color: PlayerColor,
  dimensions: { ranks: number; files?: number }
): Position {
  if (color === 'red') {
    return { file: 'a', rank: file.charCodeAt(0) as unknown as Rank }; // use rank as surrogate - not applicable for 4-player side
  }
  if (color === 'blue') {
    const bl = String.fromCharCode(97 + (dimensions.files ?? 12) - 1) as File;
    return { file: bl, rank: file.charCodeAt(0) as unknown as Rank };
  }
  const backRank: Rank = color === 'white' ? 1 : (dimensions.ranks as Rank);
  return {
    file,
    rank: backRank,
  };
}

/**
 * Find a pawn in the pieces-to-place list that would be swapped with a Herald.
 * Returns the pawn if found, null otherwise.
 */
export function findPawnForHeraldSwap(
  piecesToPlace: PieceInstance[],
  _heraldFile: File
): PieceInstance | null {
  // Find any pawn - the specific file doesn't matter until placement
  // but we return the first pawn to indicate one exists for swapping
  const pawns = piecesToPlace.filter((p) => {
    const pieceType = PIECE_BY_ID[p.typeId];
    return pieceType && pieceType.tier === 'pawn';
  });
  return pawns.length > 0 ? pawns[0] : null;
}

/**
 * Check if a pawn should be placed on the back rank due to a Herald in that file.
 */
export function shouldPawnSwapToBackRank(
  board: BoardState,
  pawnFile: File,
  color: PlayerColor,
  dimensions: { ranks: number }
): boolean {
  const pawnRank: Rank = color === 'white' ? 2 : ((dimensions.ranks - 1) as Rank);
  const pawnRankPos = positionToString({ file: pawnFile, rank: pawnRank });

  // Check if there's a Herald on the pawn rank in this file
  const pieceId = board.positionMap.get(pawnRankPos);
  if (!pieceId) return false;

  const piece = board.pieces.find((p) => p.id === pieceId);
  return piece?.typeId === 'herald';
}

/**
 * Placement state for a 3-player game: white, black and red, in seat order.
 *
 * Blue does not play, so bluePiecesToPlace is left off entirely rather than set
 * to an empty array — the placement flow advances by looking for the next
 * player who still has pieces, and an empty list reads the same as "done".
 */
export function createThreePlayerPlacementState(
  whiteDraft: PlayerDraft,
  blackDraft: PlayerDraft,
  redDraft: PlayerDraft,
): PlacementState {
  return {
    whitePiecesToPlace: createPiecesFromDraft(whiteDraft, 'white'),
    blackPiecesToPlace: createPiecesFromDraft(blackDraft, 'black'),
    redPiecesToPlace: createPiecesFromDraft(redDraft, 'red'),
    currentPlacer: 'white',
    selectedPieceId: null,
    mode: 'alternating',
    whiteReady: false,
    blackReady: false,
  };
}

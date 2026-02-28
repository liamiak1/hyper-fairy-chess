/**
 * Move generation - generates pseudo-legal moves for pieces
 * (Does not account for leaving own king in check - that's handled by checkDetection)
 */

import type {
  Position,
  BoardState,
  PieceInstance,
  SlideDirection,
  LeapOffset,
  SpecialMovement,
  PlayerColor,
} from '../types';
import { PIECE_BY_ID } from '../pieces/pieceDefinitions';
import {
  offsetPosition,
  isSquareEmpty,
  hasEnemyPiece,
  hasCapturableEnemyPiece,
  hasFriendlyPiece,
  getDirectionVectors,
  expandLeapOffset,
  getPawnDirection,
  canPawnDoubleMove,
  ALL_DIRECTIONS,
  getAllPieces,
  canCaptureByDisplacement,
  getPieceAt,
  fileToIndex,
} from './boardUtils';
import { positionToString } from '../types';

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Generate all pseudo-legal moves for a piece
 * Pseudo-legal means the move follows piece movement rules,
 * but may leave the player's own king in check
 */
export function generatePseudoLegalMoves(
  board: BoardState,
  piece: PieceInstance,
  enPassantTarget: Position | null
): Position[] {
  if (!piece.position) return [];
  if (piece.isFrozen) return [];

  const pieceType = PIECE_BY_ID[piece.typeId];
  if (!pieceType) return [];

  const moves: Position[] = [];

  // Generate slide moves
  if (pieceType.movement.slides.length > 0) {
    moves.push(...generateSlideMoves(board, piece, pieceType.movement.slides));
  }

  // Generate leap moves
  if (pieceType.movement.leaps.length > 0) {
    moves.push(...generateLeapMoves(board, piece, pieceType.movement.leaps));
  }

  // Generate special moves
  if (pieceType.movement.special.length > 0) {
    moves.push(
      ...generateSpecialMoves(board, piece, pieceType.movement.special, enPassantTarget)
    );
  }

  return moves;
}

// =============================================================================
// Slide Move Generation
// =============================================================================

/**
 * Generate moves for sliding pieces (rook, bishop, queen)
 */
export function generateSlideMoves(
  board: BoardState,
  piece: PieceInstance,
  directions: SlideDirection[]
): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const canDisplacementCapture = canCaptureByDisplacement(piece);

  for (const slideDir of directions) {
    const dirVectors = getDirectionVectors(slideDir);

    for (const dir of dirVectors) {
      let currentPos = piece.position;

      // Slide in this direction until we hit something
      while (true) {
        const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);

        // Off the board
        if (!nextPos) break;

        // Hit a friendly piece - can't move here or beyond
        if (hasFriendlyPiece(board, nextPos, piece.owner)) break;

        // Hit an enemy piece
        if (hasEnemyPiece(board, nextPos, piece.owner)) {
          // Can only capture by displacement if:
          // 1. The piece CAN capture by displacement (not coordinator, boxer, etc.)
          // 2. The target piece is capturable (not Fool/Jester)
          if (canDisplacementCapture && hasCapturableEnemyPiece(board, nextPos, piece.owner)) {
            moves.push(nextPos);
          }
          // Either way, can't slide beyond an enemy piece
          break;
        }

        // Empty square - can move here
        moves.push(nextPos);

        currentPos = nextPos;
      }
    }
  }

  return moves;
}

// =============================================================================
// Leap Move Generation
// =============================================================================

/**
 * Generate moves for leaping pieces (knight, etc.)
 */
export function generateLeapMoves(
  board: BoardState,
  piece: PieceInstance,
  leaps: LeapOffset[]
): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const canDisplacementCapture = canCaptureByDisplacement(piece);

  for (const leap of leaps) {
    const offsets = expandLeapOffset(leap);

    for (const offset of offsets) {
      const targetPos = offsetPosition(piece.position, offset.dx, offset.dy, board.dimensions);

      if (!targetPos) continue;

      // Can't move to square with friendly piece
      if (hasFriendlyPiece(board, targetPos, piece.owner)) continue;

      // Check if there's an enemy piece
      if (hasEnemyPiece(board, targetPos, piece.owner)) {
        // Can only capture by displacement if piece supports it
        if (!canDisplacementCapture) continue;
        // Can't capture uncapturable enemy pieces (Fool, Jester)
        if (!hasCapturableEnemyPiece(board, targetPos, piece.owner)) continue;
      }

      moves.push(targetPos);
    }
  }

  return moves;
}

// =============================================================================
// Special Move Generation
// =============================================================================

/**
 * Generate special moves (pawn, king, etc.)
 */
export function generateSpecialMoves(
  board: BoardState,
  piece: PieceInstance,
  specials: SpecialMovement[],
  enPassantTarget: Position | null
): Position[] {
  const moves: Position[] = [];

  for (const special of specials) {
    switch (special) {
      case 'pawn-forward':
        moves.push(...generatePawnForwardMoves(board, piece));
        break;

      case 'pawn-capture-diagonal':
        moves.push(...generatePawnCaptureMoves(board, piece, enPassantTarget));
        break;

      case 'shogi-pawn':
        moves.push(...generateShogiPawnMoves(board, piece));
        break;

      case 'king-one-square':
        moves.push(...generateKingMoves(board, piece));
        break;

      case 'peasant-diagonal':
        moves.push(...generatePeasantDiagonalMoves(board, piece));
        break;

      case 'peasant-capture-forward':
        moves.push(...generatePeasantCaptureMoves(board, piece));
        break;

      case 'swap-adjacent':
        moves.push(...generateSwapMoves(board, piece));
        break;

      case 'regent-conditional':
        moves.push(...generateRegentMoves(board, piece));
        break;

      case 'herald-orthogonal':
        moves.push(...generateHeraldMoves(board, piece));
        break;

      case 'bounce':
        moves.push(...generateBounceMoves(board, piece));
        break;

      case 'long-leap':
        moves.push(...generateLongLeapMoves(board, piece));
        break;

      case 'chameleon':
        moves.push(...generateChameleonMoves(board, piece));
        break;

      case 'grasshopper':
        moves.push(...generateGrasshopperMoves(board, piece));
        break;

      case 'cannon-move':
        moves.push(...generateCannonMoves(board, piece));
        break;

      case 'nightrider':
        moves.push(...generateNightriderMoves(board, piece));
        break;

      case 'knight-rider':
      case 'berolina':
        // Future fairy piece implementations
        break;
    }
  }

  return moves;
}

// =============================================================================
// Pawn Moves
// =============================================================================

/**
 * Generate pawn forward moves (non-capturing)
 */
function generatePawnForwardMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const direction = getPawnDirection(piece.owner);

  // Single step forward
  const oneStep = offsetPosition(piece.position, 0, direction, board.dimensions);
  if (oneStep && isSquareEmpty(board, oneStep)) {
    moves.push(oneStep);

    // Double step from starting position
    if (canPawnDoubleMove(piece, piece.owner)) {
      const twoStep = offsetPosition(piece.position, 0, direction * 2, board.dimensions);
      if (twoStep && isSquareEmpty(board, twoStep)) {
        moves.push(twoStep);
      }
    }
  }

  return moves;
}

/**
 * Generate pawn capture moves (diagonal captures and en passant)
 */
function generatePawnCaptureMoves(
  board: BoardState,
  piece: PieceInstance,
  enPassantTarget: Position | null
): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const direction = getPawnDirection(piece.owner);

  // Diagonal captures
  for (const dx of [-1, 1]) {
    const capturePos = offsetPosition(piece.position, dx, direction, board.dimensions);
    if (!capturePos) continue;

    // Regular capture - only if enemy piece is capturable
    if (hasCapturableEnemyPiece(board, capturePos, piece.owner)) {
      moves.push(capturePos);
    }

    // En passant (the captured pawn is always capturable)
    if (enPassantTarget && capturePos.file === enPassantTarget.file && capturePos.rank === enPassantTarget.rank) {
      moves.push(capturePos);
    }
  }

  return moves;
}

/**
 * Generate Shogi pawn moves (forward only, captures forward too)
 */
function generateShogiPawnMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const direction = getPawnDirection(piece.owner);
  const canDisplacementCapture = canCaptureByDisplacement(piece);

  // Single step forward (move or capture)
  const oneStep = offsetPosition(piece.position, 0, direction, board.dimensions);
  if (oneStep) {
    // Can move if empty
    if (isSquareEmpty(board, oneStep)) {
      moves.push(oneStep);
    }
    // Can capture if piece supports displacement capture and enemy piece is capturable
    else if (canDisplacementCapture && hasCapturableEnemyPiece(board, oneStep, piece.owner)) {
      moves.push(oneStep);
    }
  }

  return moves;
}

// =============================================================================
// Swap Moves (Phantom King, Chamberlain)
// =============================================================================

/**
 * Generate swap moves - can move into friendly piece's square and swap positions
 */
function generateSwapMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];

  // Check all adjacent squares for friendly pieces to swap with
  for (const dir of ALL_DIRECTIONS) {
    const targetPos = offsetPosition(piece.position, dir.dx, dir.dy, board.dimensions);

    if (!targetPos) continue;

    // Can swap with friendly pieces (not enemies, not empty)
    if (hasFriendlyPiece(board, targetPos, piece.owner)) {
      moves.push(targetPos);
    }
  }

  return moves;
}

// =============================================================================
// Bounce Moves (Pontiff)
// =============================================================================

/**
 * Generate bounce moves - diagonal slides that reflect off board edges
 */
function generateBounceMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const visited = new Set<string>();
  const startKey = `${piece.position.file}${piece.position.rank}`;
  visited.add(startKey);

  // Start in all 4 diagonal directions
  const diagonalDirs = getDirectionVectors('diagonal');

  for (const startDir of diagonalDirs) {
    let currentPos = piece.position;
    let dx = startDir.dx;
    let dy = startDir.dy;
    const pathVisited = new Set<string>([startKey]);

    // Follow the path with bounces
    for (let steps = 0; steps < 50; steps++) { // Safety limit
      let nextPos = offsetPosition(currentPos, dx, dy, board.dimensions);

      // Handle bouncing
      if (!nextPos) {
        // Hit an edge - need to bounce
        const testX = offsetPosition(currentPos, dx, 0, board.dimensions);
        const testY = offsetPosition(currentPos, 0, dy, board.dimensions);

        if (!testX && !testY) {
          // Corner - reflect both
          dx = -dx;
          dy = -dy;
        } else if (!testX) {
          // Left/right edge - reflect X
          dx = -dx;
        } else {
          // Top/bottom edge - reflect Y
          dy = -dy;
        }

        nextPos = offsetPosition(currentPos, dx, dy, board.dimensions);
        if (!nextPos) break; // Still off board after bounce - stop
      }

      const posKey = `${nextPos.file}${nextPos.rank}`;

      // Check for cycle (returned to a visited position in this path)
      if (pathVisited.has(posKey)) break;
      pathVisited.add(posKey);

      // Check for friendly piece - can't move here
      if (hasFriendlyPiece(board, nextPos, piece.owner)) break;

      // Check for enemy piece
      if (hasEnemyPiece(board, nextPos, piece.owner)) {
        if (hasCapturableEnemyPiece(board, nextPos, piece.owner)) {
          if (!visited.has(posKey)) {
            moves.push(nextPos);
            visited.add(posKey);
          }
        }
        break; // Stop at enemy piece
      }

      // Empty square - can move here
      if (!visited.has(posKey)) {
        moves.push(nextPos);
        visited.add(posKey);
      }

      currentPos = nextPos;
    }
  }

  return moves;
}

// =============================================================================
// Herald Moves (2 orthogonal, blockable)
// =============================================================================

/**
 * Generate herald moves - 2 squares orthogonally (blockable)
 * Note: Herald has captureType 'none' so it cannot capture by displacement
 */
function generateHeraldMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const orthoDirs = getDirectionVectors('orthogonal');
  const canDisplacementCapture = canCaptureByDisplacement(piece);

  for (const dir of orthoDirs) {
    // Check if first square is clear (blockable)
    const firstStep = offsetPosition(piece.position, dir.dx, dir.dy, board.dimensions);
    if (!firstStep) continue;
    if (hasFriendlyPiece(board, firstStep, piece.owner)) continue;
    if (hasEnemyPiece(board, firstStep, piece.owner)) continue; // Blocked by enemy too

    // Second square - can move here if empty, or capture if allowed
    const secondStep = offsetPosition(piece.position, dir.dx * 2, dir.dy * 2, board.dimensions);
    if (!secondStep) continue;
    if (hasFriendlyPiece(board, secondStep, piece.owner)) continue;

    // Check if there's an enemy piece
    if (hasEnemyPiece(board, secondStep, piece.owner)) {
      // Can only capture if piece supports displacement capture
      if (!canDisplacementCapture) continue;
      // Can't capture uncapturable pieces
      if (!hasCapturableEnemyPiece(board, secondStep, piece.owner)) continue;
    }

    moves.push(secondStep);
  }

  return moves;
}

// =============================================================================
// Regent Moves (Conditional)
// =============================================================================

/**
 * Check if player has another royalty-tier piece besides the given one
 * Used for Regent logic - checks tier, not isRoyal
 */
function hasOtherRoyalty(board: BoardState, piece: PieceInstance): boolean {
  const friendlyPieces = getAllPieces(board, piece.owner);
  for (const p of friendlyPieces) {
    if (p.id === piece.id) continue; // Skip self
    const pType = PIECE_BY_ID[p.typeId];
    if (pType?.tier === 'royalty') return true;
  }
  return false;
}

/**
 * Generate regent moves - conditional based on whether other royal exists
 * - With other royal on board: moves exactly 2 squares in any direction (blockable)
 * - Without other royal AND was only royal from start: moves exactly 2 squares (blockable)
 * - Without other royal BUT had another that was captured: moves like queen
 */
function generateRegentMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const hasAnotherRoyalty = hasOtherRoyalty(board, piece);
  const canDisplacementCapture = canCaptureByDisplacement(piece);

  // Queen mode only if: no other royalty currently exists AND there was one that got captured
  const hadMultipleRoyals = board.hadMultipleRoyals?.[piece.owner] ?? false;
  const useQueenMode = !hasAnotherRoyalty && hadMultipleRoyals;

  if (!useQueenMode) {
    // Limited mode: exactly 2 squares in any direction (blockable)
    for (const dir of ALL_DIRECTIONS) {
      // Check if first square is clear (blockable)
      const firstStep = offsetPosition(piece.position, dir.dx, dir.dy, board.dimensions);
      if (!firstStep) continue;
      if (hasFriendlyPiece(board, firstStep, piece.owner)) continue;
      if (hasEnemyPiece(board, firstStep, piece.owner)) continue; // Blocked by enemy too

      // Second square - can move here if empty or capture if allowed
      const secondStep = offsetPosition(piece.position, dir.dx * 2, dir.dy * 2, board.dimensions);
      if (!secondStep) continue;
      if (hasFriendlyPiece(board, secondStep, piece.owner)) continue;

      // Check if there's an enemy piece
      if (hasEnemyPiece(board, secondStep, piece.owner)) {
        if (!canDisplacementCapture) continue;
        if (!hasCapturableEnemyPiece(board, secondStep, piece.owner)) continue;
      }

      moves.push(secondStep);
    }
  } else {
    // Full power mode: queen movement (slides in all directions)
    const queenDirs = getDirectionVectors('all');
    for (const dir of queenDirs) {
      let currentPos = piece.position;

      while (true) {
        const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);
        if (!nextPos) break;
        if (hasFriendlyPiece(board, nextPos, piece.owner)) break;

        if (hasEnemyPiece(board, nextPos, piece.owner)) {
          if (canDisplacementCapture && hasCapturableEnemyPiece(board, nextPos, piece.owner)) {
            moves.push(nextPos);
          }
          break;
        }

        moves.push(nextPos);
        currentPos = nextPos;
      }
    }
  }

  return moves;
}

// =============================================================================
// Peasant Moves
// =============================================================================

/**
 * Generate peasant diagonal moves (non-capturing)
 * Peasants move diagonally forward, with optional 2-square move on first turn
 */
function generatePeasantDiagonalMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const direction = getPawnDirection(piece.owner);

  // Diagonal moves (forward-left and forward-right)
  for (const dx of [-1, 1]) {
    const oneStep = offsetPosition(piece.position, dx, direction, board.dimensions);
    if (oneStep && isSquareEmpty(board, oneStep)) {
      moves.push(oneStep);

      // Double diagonal on first move (same diagonal direction)
      if (!piece.hasMoved) {
        const twoStep = offsetPosition(piece.position, dx * 2, direction * 2, board.dimensions);
        if (twoStep && isSquareEmpty(board, twoStep)) {
          moves.push(twoStep);
        }
      }
    }
  }

  return moves;
}

/**
 * Generate peasant capture moves (forward only)
 * Peasants capture straight forward (opposite of pawns)
 */
function generatePeasantCaptureMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const direction = getPawnDirection(piece.owner);

  // Capture forward only
  const capturePos = offsetPosition(piece.position, 0, direction, board.dimensions);
  if (capturePos && hasCapturableEnemyPiece(board, capturePos, piece.owner)) {
    moves.push(capturePos);
  }

  return moves;
}

// =============================================================================
// Classic Fairy Piece Moves
// =============================================================================

/**
 * Generate Grasshopper moves
 * Moves along Queen lines but must hop over exactly one piece, landing immediately beyond.
 */
function generateGrasshopperMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const canDisplacementCapture = canCaptureByDisplacement(piece);

  // Check all 8 directions (queen lines)
  for (const dir of ALL_DIRECTIONS) {
    let currentPos = piece.position;

    // Slide until we find a piece to hop over
    while (true) {
      const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);
      if (!nextPos) break;

      const hasPiece = hasFriendlyPiece(board, nextPos, piece.owner) ||
                       hasEnemyPiece(board, nextPos, piece.owner);

      if (hasPiece) {
        // Found the hurdle - check landing square
        const landingPos = offsetPosition(nextPos, dir.dx, dir.dy, board.dimensions);
        if (landingPos) {
          // Can't land on friendly piece
          if (!hasFriendlyPiece(board, landingPos, piece.owner)) {
            // Empty square or capturable enemy
            if (isSquareEmpty(board, landingPos)) {
              moves.push(landingPos);
            } else if (hasEnemyPiece(board, landingPos, piece.owner)) {
              if (canDisplacementCapture && hasCapturableEnemyPiece(board, landingPos, piece.owner)) {
                moves.push(landingPos);
              }
            }
          }
        }
        break; // Only hop over first piece found
      }

      currentPos = nextPos;
    }
  }

  return moves;
}

/**
 * Generate Nightrider moves
 * Repeats knight moves in the same direction until blocked.
 */
function generateNightriderMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const canDisplacementCapture = canCaptureByDisplacement(piece);

  // All 8 knight directions
  const knightDirs = [
    { dx: 2, dy: 1 }, { dx: 2, dy: -1 },
    { dx: -2, dy: 1 }, { dx: -2, dy: -1 },
    { dx: 1, dy: 2 }, { dx: 1, dy: -2 },
    { dx: -1, dy: 2 }, { dx: -1, dy: -2 },
  ];

  for (const dir of knightDirs) {
    let currentPos = piece.position;

    // Keep moving in this knight direction until blocked
    while (true) {
      const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);
      if (!nextPos) break;

      // Hit a friendly piece - can't move here or beyond
      if (hasFriendlyPiece(board, nextPos, piece.owner)) break;

      // Hit an enemy piece
      if (hasEnemyPiece(board, nextPos, piece.owner)) {
        if (canDisplacementCapture && hasCapturableEnemyPiece(board, nextPos, piece.owner)) {
          moves.push(nextPos);
        }
        break; // Can't continue past enemy
      }

      // Empty square - can move here and continue
      moves.push(nextPos);
      currentPos = nextPos;
    }
  }

  return moves;
}

/**
 * Generate Cannon moves (Chinese Chess style)
 * Non-capturing: slides orthogonally like a Rook
 * Capturing: must hop over exactly one piece (the "screen") to capture a piece beyond
 */
function generateCannonMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const orthogonalDirs = getDirectionVectors('orthogonal');

  for (const dir of orthogonalDirs) {
    let currentPos = piece.position;
    let foundScreen = false;

    while (true) {
      const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);
      if (!nextPos) break;

      if (!foundScreen) {
        // Looking for empty squares to move to, or a screen piece
        if (isSquareEmpty(board, nextPos)) {
          moves.push(nextPos); // Can move to empty squares
          currentPos = nextPos;
        } else {
          // Found the screen piece (friendly or enemy)
          foundScreen = true;
          currentPos = nextPos;
        }
      } else {
        // Already found screen - looking for capture target
        if (isSquareEmpty(board, nextPos)) {
          currentPos = nextPos; // Keep sliding past empty squares
        } else if (hasCapturableEnemyPiece(board, nextPos, piece.owner)) {
          moves.push(nextPos); // Can capture this enemy
          break; // Stop after finding capture target
        } else {
          // Hit another piece (friendly or uncapturable) - stop
          break;
        }
      }
    }
  }

  return moves;
}

// =============================================================================
// Chameleon Moves
// =============================================================================

/**
 * Generate Chameleon moves
 * Non-capturing: moves like a Queen (slides in all directions)
 * Capturing: captures like the piece it's trying to capture.
 */
function generateChameleonMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const visited = new Set<string>();

  // 1. Non-capturing moves: Queen-like slides to empty squares
  const allDirs = getDirectionVectors('all');
  for (const dir of allDirs) {
    let currentPos = piece.position;

    while (true) {
      const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);
      if (!nextPos) break;

      // Stop at any piece (friendly or enemy)
      if (hasFriendlyPiece(board, nextPos, piece.owner)) break;
      if (hasEnemyPiece(board, nextPos, piece.owner)) break;

      // Empty square - can move here
      const posKey = positionToString(nextPos);
      if (!visited.has(posKey)) {
        moves.push(nextPos);
        visited.add(posKey);
      }

      currentPos = nextPos;
    }
  }

  // 2. Long-leaper-style captures: explore all jump paths, valid if any piece is a long leaper
  // This must be done separately because it's path-centric, not enemy-centric
  const longLeaperCaptures = generateAllChameleonLongLeaperCaptures(board, piece);
  for (const pos of longLeaperCaptures) {
    const posKey = positionToString(pos);
    if (!visited.has(posKey)) {
      moves.push(pos);
      visited.add(posKey);
    }
  }

  // 3. Other capturing moves: capture like the target piece
  const enemyPieces = getAllPieces(board, piece.owner === 'white' ? 'black' : 'white');

  for (const enemy of enemyPieces) {
    if (!enemy.position) continue;

    const enemyType = PIECE_BY_ID[enemy.typeId];
    if (!enemyType) continue;

    // Can't capture uncapturable pieces
    if (!enemyType.canBeCaptured) continue;

    // Skip long-leap - handled separately above
    if (enemyType.captureType === 'long-leap') continue;

    // Generate moves as if Chameleon has the enemy's movement pattern
    const capturePositions = getChameleonCapturePositions(board, piece, enemy, enemyType);

    for (const pos of capturePositions) {
      const posKey = positionToString(pos);
      if (!visited.has(posKey)) {
        moves.push(pos);
        visited.add(posKey);
      }
    }
  }

  return moves;
}

/**
 * Generate all long-leaper-style capture positions for a chameleon.
 * Explores all possible jump paths in all directions.
 * A path is valid if it includes at least one long leaper.
 */
function generateAllChameleonLongLeaperCaptures(
  board: BoardState,
  chameleon: PieceInstance
): Position[] {
  if (!chameleon.position) return [];

  const positions: Position[] = [];
  const visited = new Set<string>();

  // Check all 8 directions
  for (const dir of ALL_DIRECTIONS) {
    // Explore jump paths starting from chameleon's position
    exploreLongLeaperJumpPath(board, chameleon, chameleon.position, dir, [], positions, visited);
  }

  return positions;
}

/**
 * Recursively explore jump paths for chameleon long-leaper-style captures.
 * Tracks pieces jumped over and only adds landing positions if path includes a long leaper.
 */
function exploreLongLeaperJumpPath(
  board: BoardState,
  chameleon: PieceInstance,
  fromPos: Position,
  dir: { dx: number; dy: number },
  jumpedPieces: PieceInstance[],
  positions: Position[],
  visited: Set<string>
): void {
  let currentPos = fromPos;

  // Slide until we hit something
  while (true) {
    const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);
    if (!nextPos) break;

    // Hit a friendly piece - stop
    if (hasFriendlyPiece(board, nextPos, chameleon.owner)) break;

    // Empty square
    if (isSquareEmpty(board, nextPos)) {
      // If we've jumped over at least one piece and one is a long leaper, this is a valid landing
      if (jumpedPieces.length > 0) {
        const hasLongLeaper = jumpedPieces.some((p) => {
          const pType = PIECE_BY_ID[p.typeId];
          return pType?.captureType === 'long-leap';
        });
        if (hasLongLeaper) {
          const posKey = positionToString(nextPos);
          if (!visited.has(posKey)) {
            positions.push(nextPos);
            visited.add(posKey);
          }
        }
      }
      currentPos = nextPos;
      continue;
    }

    // Enemy piece - can we jump over it?
    if (hasEnemyPiece(board, nextPos, chameleon.owner)) {
      const enemyPiece = getPieceAt(board, nextPos);
      if (!enemyPiece) break;

      const enemyType = PIECE_BY_ID[enemyPiece.typeId];
      // Can't jump over uncapturable pieces
      if (enemyType?.canBeCaptured === false) break;

      // Check if there's a square beyond to potentially land on or continue jumping
      const beyondPos = offsetPosition(nextPos, dir.dx, dir.dy, board.dimensions);
      if (!beyondPos) break;

      // Can only continue if beyond is empty or another enemy (for chain jumps)
      if (hasFriendlyPiece(board, beyondPos, chameleon.owner)) break;

      // Add this piece to our jumped list and continue exploring
      const newJumpedPieces = [...jumpedPieces, enemyPiece];

      if (isSquareEmpty(board, beyondPos)) {
        // Can land here - check if path includes a long leaper
        const hasLongLeaper = newJumpedPieces.some((p) => {
          const pType = PIECE_BY_ID[p.typeId];
          return pType?.captureType === 'long-leap';
        });
        if (hasLongLeaper) {
          const posKey = positionToString(beyondPos);
          if (!visited.has(posKey)) {
            positions.push(beyondPos);
            visited.add(posKey);
          }
        }
        // Continue exploring from landing position for more jumps or slides
        exploreLongLeaperJumpPath(board, chameleon, beyondPos, dir, newJumpedPieces, positions, visited);
      } else if (hasEnemyPiece(board, beyondPos, chameleon.owner)) {
        // Another enemy - continue chain by recursing from current enemy position
        exploreLongLeaperJumpPath(board, chameleon, nextPos, dir, newJumpedPieces, positions, visited);
      }

      break;
    }

    currentPos = nextPos;
  }
}

/**
 * Get positions where Chameleon can capture a specific enemy piece
 * using that enemy's capture method
 */
function getChameleonCapturePositions(
  board: BoardState,
  chameleon: PieceInstance,
  enemy: PieceInstance,
  enemyType: { movement: { slides: string[]; leaps: { dx: number; dy: number; symmetric: boolean }[]; special: string[] }; captureType: string }
): Position[] {
  if (!chameleon.position || !enemy.position) return [];

  // FIRST: Check captureType for pieces with non-standard capture methods
  // These pieces don't capture by displacement, so chameleon must mimic their capture style
  switch (enemyType.captureType) {
    case 'boxer':
      // Chameleon captures boxer by moving adjacent to it with friendly piece on opposite side
      return getChameleonBoxerCapturePositions(board, chameleon, enemy);
    case 'withdrawal':
      // Chameleon captures withdrawer by moving AWAY from it (not onto it)
      return getChameleonWithdrawerCapturePositions(board, chameleon, enemy);
    case 'long-leap':
      // Handled separately in generateAllChameleonLongLeaperCaptures (path-centric, not enemy-centric)
      return [];
    case 'coordinator':
      // Chameleon captures coordinator using coordinator-style capture
      // (coordinator at intersection of chameleon's file/rank and friendly king's rank/file)
      return getChameleonCoordinatorCapturePositions(board, chameleon, enemy);
    case 'cannon':
      // Chameleon captures cannon using cannon-style capture (hop over screen piece)
      return getChameleonCannonCapturePositions(board, chameleon, enemy);
    case 'thief':
    case 'none':
      // These capture types are too complex or don't make sense for chameleon to mimic
      return [];
  }

  // Standard capture types - use the enemy's movement pattern to determine if chameleon
  // can reach the enemy position (displacement capture)
  const positions: Position[] = [];

  // Handle slides (Rook, Bishop, Queen-like)
  for (const slideDir of enemyType.movement.slides as ('orthogonal' | 'diagonal' | 'all')[]) {
    if (canReachBySlide(board, chameleon.position, enemy.position, slideDir, chameleon.owner)) {
      positions.push(enemy.position);
    }
  }

  // Handle leaps (Knight, Catapult, etc.)
  for (const leap of enemyType.movement.leaps) {
    if (canReachByLeap(chameleon.position, enemy.position, leap, board.dimensions)) {
      positions.push(enemy.position);
    }
  }

  // Handle special movements
  for (const special of enemyType.movement.special) {
    if (canChameleonCaptureWithSpecial(board, chameleon, enemy, special)) {
      positions.push(enemy.position);
    }
  }

  return positions;
}

/**
 * Get positions where Chameleon can capture a Boxer using boxer-style capture.
 * Chameleon must move to a position adjacent to the boxer, where a friendly piece
 * is on the opposite side of the boxer.
 */
function getChameleonBoxerCapturePositions(
  board: BoardState,
  chameleon: PieceInstance,
  boxer: PieceInstance
): Position[] {
  if (!chameleon.position || !boxer.position) return [];

  const positions: Position[] = [];
  const orthogonalDirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  // For each orthogonal direction from the boxer...
  for (const dir of orthogonalDirs) {
    // Position adjacent to boxer (where chameleon needs to move)
    const adjacentPos = offsetPosition(boxer.position, dir.dx, dir.dy, board.dimensions);
    if (!adjacentPos) continue;

    // Position on opposite side of boxer (must have friendly piece)
    const oppositePos = offsetPosition(boxer.position, -dir.dx, -dir.dy, board.dimensions);
    if (!oppositePos) continue;

    // Check if there's a friendly piece on the opposite side
    if (!hasFriendlyPiece(board, oppositePos, chameleon.owner)) continue;

    // Check if the adjacent position is reachable
    // It can be empty (chameleon slides there) or be where chameleon already is
    const isChameleonHere = adjacentPos.file === chameleon.position.file &&
                            adjacentPos.rank === chameleon.position.rank;

    if (isChameleonHere) {
      // Chameleon is already in position - but this is a "capturing" move
      // so we need a position to move TO. Skip this case.
      continue;
    }

    // Adjacent position must be empty for chameleon to slide there
    if (!isSquareEmpty(board, adjacentPos)) continue;

    // Check if chameleon can reach this adjacent position (queen-like slide)
    if (canReachBySlide(board, chameleon.position, adjacentPos, 'all', chameleon.owner)) {
      positions.push(adjacentPos);
    }
  }

  return positions;
}

/**
 * Get positions where Chameleon can capture a Withdrawer using withdrawal-style capture.
 * Chameleon must be adjacent to the withdrawer and move directly away from it.
 */
function getChameleonWithdrawerCapturePositions(
  board: BoardState,
  chameleon: PieceInstance,
  withdrawer: PieceInstance
): Position[] {
  if (!chameleon.position || !withdrawer.position) return [];

  const positions: Position[] = [];

  // Check if chameleon is adjacent to withdrawer (including diagonally)
  const dx = fileToIndex(chameleon.position.file) - fileToIndex(withdrawer.position.file);
  const dy = chameleon.position.rank - withdrawer.position.rank;

  // Must be adjacent (max 1 square away in any direction)
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0)) {
    return positions; // Not adjacent, can't capture with withdrawal
  }

  // Chameleon must move AWAY from the withdrawer (same direction as dx, dy)
  const moveDir = { dx: Math.sign(dx), dy: Math.sign(dy) };

  // Generate all positions in the "away" direction (queen-like slide)
  let currentPos = chameleon.position;
  while (true) {
    const nextPos = offsetPosition(currentPos, moveDir.dx, moveDir.dy, board.dimensions);
    if (!nextPos) break;

    // Stop if blocked by friendly piece
    if (hasFriendlyPiece(board, nextPos, chameleon.owner)) break;

    // Stop if blocked by enemy piece (can't slide through enemies)
    if (hasEnemyPiece(board, nextPos, chameleon.owner)) break;

    // Valid position to move to (this move will capture the withdrawer)
    positions.push(nextPos);
    currentPos = nextPos;
  }

  return positions;
}

/**
 * Get positions where Chameleon can capture a Coordinator using coordinator-style capture.
 * Chameleon moves like a Queen, and after moving, captures any coordinator at the intersection
 * of the chameleon's file/rank with the friendly king's rank/file.
 */
function getChameleonCoordinatorCapturePositions(
  board: BoardState,
  chameleon: PieceInstance,
  coordinator: PieceInstance
): Position[] {
  if (!chameleon.position || !coordinator.position) return [];

  const positions: Position[] = [];

  // Find the chameleon's king
  const king = getAllPieces(board, chameleon.owner).find((p) => {
    const pType = PIECE_BY_ID[p.typeId];
    return pType?.isRoyal && p.position;
  });

  if (!king || !king.position) return [];

  // For chameleon to capture coordinator using coordinator-style:
  // Chameleon must move to a position where the coordinator is at:
  // - (king's file, chameleon's new rank), OR
  // - (chameleon's new file, king's rank)

  // Case 1: Coordinator is on king's file - chameleon needs to move to coordinator's rank
  if (coordinator.position.file === king.position.file) {
    // Chameleon needs to move to any square on coordinator's rank (where it can reach)
    // that would trigger the capture
    const targetRank = coordinator.position.rank;

    // Generate all queen-like slide positions on that rank
    const allDirs = getDirectionVectors('all');
    for (const dir of allDirs) {
      let currentPos = chameleon.position;

      while (true) {
        const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);
        if (!nextPos) break;

        // Can't pass through pieces
        if (hasFriendlyPiece(board, nextPos, chameleon.owner)) break;
        if (hasEnemyPiece(board, nextPos, chameleon.owner)) {
          // Can only stop on enemy if it's the coordinator itself (displacement)
          // But coordinator capture is non-displacement, so skip
          break;
        }

        // If this position is on the coordinator's rank, it's a valid capture position
        if (nextPos.rank === targetRank) {
          positions.push(nextPos);
        }

        currentPos = nextPos;
      }
    }
  }

  // Case 2: Coordinator is on king's rank - chameleon needs to move to coordinator's file
  if (coordinator.position.rank === king.position.rank) {
    const targetFile = coordinator.position.file;

    const allDirs = getDirectionVectors('all');
    for (const dir of allDirs) {
      let currentPos = chameleon.position;

      while (true) {
        const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);
        if (!nextPos) break;

        if (hasFriendlyPiece(board, nextPos, chameleon.owner)) break;
        if (hasEnemyPiece(board, nextPos, chameleon.owner)) break;

        // If this position is on the coordinator's file, it's a valid capture position
        if (nextPos.file === targetFile) {
          positions.push(nextPos);
        }

        currentPos = nextPos;
      }
    }
  }

  return positions;
}

/**
 * Get positions where Chameleon can capture a Cannon using cannon-style capture.
 * Chameleon must hop over exactly one piece (screen) orthogonally to land on the cannon.
 * Returns [cannon.position] if capture is possible, empty array otherwise.
 */
function getChameleonCannonCapturePositions(
  board: BoardState,
  chameleon: PieceInstance,
  cannon: PieceInstance
): Position[] {
  if (!chameleon.position || !cannon.position) return [];

  // Check if chameleon and cannon are on the same orthogonal line
  const dx = fileToIndex(cannon.position.file) - fileToIndex(chameleon.position.file);
  const dy = cannon.position.rank - chameleon.position.rank;

  // Must be orthogonal (same file or same rank, but not same square)
  if ((dx !== 0 && dy !== 0) || (dx === 0 && dy === 0)) return [];

  const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

  // Count pieces between chameleon and cannon - need exactly one (the screen)
  let piecesInBetween = 0;
  let currentPos = chameleon.position;

  while (true) {
    const nextPos = offsetPosition(currentPos, stepX, stepY, board.dimensions);
    if (!nextPos) return [];

    // Reached cannon position - check if we had exactly one screen piece
    if (nextPos.file === cannon.position.file && nextPos.rank === cannon.position.rank) {
      if (piecesInBetween === 1) {
        return [cannon.position]; // Valid cannon-capture!
      }
      return [];
    }

    // Count pieces in between
    if (!isSquareEmpty(board, nextPos)) {
      piecesInBetween++;
      if (piecesInBetween > 1) return []; // Too many pieces, can't cannon-capture
    }

    currentPos = nextPos;
  }
}

/**
 * Check if position A can reach position B by sliding in the given direction
 */
function canReachBySlide(
  board: BoardState,
  from: Position,
  to: Position,
  direction: 'orthogonal' | 'diagonal' | 'all',
  friendlyColor: PlayerColor
): boolean {
  const dirVectors = getDirectionVectors(direction);

  for (const dir of dirVectors) {
    let currentPos = from;

    while (true) {
      const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);
      if (!nextPos) break;

      // Reached target
      if (nextPos.file === to.file && nextPos.rank === to.rank) {
        return true;
      }

      // Blocked by any piece (can't slide through)
      if (hasFriendlyPiece(board, nextPos, friendlyColor) || hasEnemyPiece(board, nextPos, friendlyColor)) {
        break;
      }

      currentPos = nextPos;
    }
  }

  return false;
}

/**
 * Check if position A can reach position B by the given leap offset
 */
function canReachByLeap(
  from: Position,
  to: Position,
  leap: { dx: number; dy: number; symmetric: boolean },
  dimensions: { files: number; ranks: number }
): boolean {
  const offsets = expandLeapOffset(leap);

  for (const offset of offsets) {
    const targetPos = offsetPosition(from, offset.dx, offset.dy, dimensions);
    if (targetPos && targetPos.file === to.file && targetPos.rank === to.rank) {
      return true;
    }
  }

  return false;
}

/**
 * Check if Chameleon can capture enemy using a special movement
 */
function canChameleonCaptureWithSpecial(
  board: BoardState,
  chameleon: PieceInstance,
  enemy: PieceInstance,
  special: string
): boolean {
  if (!chameleon.position || !enemy.position) return false;

  switch (special) {
    case 'king-one-square': {
      // Can capture if adjacent
      const dx = Math.abs(fileToIndex(enemy.position.file) - fileToIndex(chameleon.position.file));
      const dy = Math.abs(enemy.position.rank - chameleon.position.rank);
      return dx <= 1 && dy <= 1 && (dx > 0 || dy > 0);
    }

    case 'pawn-capture-diagonal':
    case 'shogi-pawn':
    case 'peasant-capture-forward': {
      // Chameleon captures as the pawn would (from the pawn's perspective)
      // The pawn captures forward-diagonally, so Chameleon must approach from behind-diagonally
      const pawnDir = getPawnDirection(enemy.owner);
      // Enemy captures diagonally forward from their perspective
      // Chameleon must be on a square that the enemy pawn could capture
      const dx = fileToIndex(chameleon.position.file) - fileToIndex(enemy.position.file);
      const dy = chameleon.position.rank - enemy.position.rank;

      if (special === 'shogi-pawn' || special === 'peasant-capture-forward') {
        // Captures forward only
        return dx === 0 && dy === pawnDir;
      } else {
        // Diagonal capture
        return Math.abs(dx) === 1 && dy === pawnDir;
      }
    }

    case 'herald-orthogonal': {
      // Herald moves 2 squares orthogonally (blockable)
      const dx = fileToIndex(enemy.position.file) - fileToIndex(chameleon.position.file);
      const dy = enemy.position.rank - chameleon.position.rank;

      // Must be exactly 2 squares orthogonally
      if (!((Math.abs(dx) === 2 && dy === 0) || (dx === 0 && Math.abs(dy) === 2))) {
        return false;
      }

      // Check that the intermediate square is empty
      const stepX = dx === 0 ? 0 : dx / 2;
      const stepY = dy === 0 ? 0 : dy / 2;
      const midPos = offsetPosition(chameleon.position, stepX, stepY, board.dimensions);
      if (!midPos) return false;
      return isSquareEmpty(board, midPos);
    }

    case 'regent-conditional': {
      // For simplicity, treat as 2 squares in any direction or queen movement
      // (depends on game state, but Chameleon can use either)
      const dx = Math.abs(fileToIndex(enemy.position.file) - fileToIndex(chameleon.position.file));
      const dy = Math.abs(enemy.position.rank - chameleon.position.rank);

      // Check if exactly 2 squares away in any direction
      if ((dx === 2 && dy === 0) || (dx === 0 && dy === 2) || (dx === 2 && dy === 2)) {
        // Check path is clear
        return canReachBySlide(board, chameleon.position, enemy.position, 'all', chameleon.owner);
      }
      // Or can slide like Queen
      return canReachBySlide(board, chameleon.position, enemy.position, 'all', chameleon.owner);
    }

    case 'swap-adjacent': {
      // Can't really "capture" with swap, skip
      return false;
    }

    case 'grasshopper': {
      // Grasshopper must hop over exactly one piece to land on/beyond enemy
      // Check if there's a direct Queen-line from chameleon to enemy
      const dx = fileToIndex(enemy.position.file) - fileToIndex(chameleon.position.file);
      const dy = enemy.position.rank - chameleon.position.rank;

      // Must be on a Queen line (orthogonal or diagonal)
      if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;

      const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

      // Count pieces between chameleon and enemy
      let piecesInBetween = 0;
      let currentPos = chameleon.position;
      while (true) {
        const nextPos = offsetPosition(currentPos, stepX, stepY, board.dimensions);
        if (!nextPos) return false;

        // Reached enemy position - check if we hopped exactly one piece
        if (nextPos.file === enemy.position.file && nextPos.rank === enemy.position.rank) {
          return piecesInBetween === 1;
        }

        if (!isSquareEmpty(board, nextPos)) {
          piecesInBetween++;
        }
        currentPos = nextPos;
      }
    }

    case 'nightrider': {
      // Nightrider moves in repeated knight jumps in the same direction
      // Check if enemy is reachable by a nightrider path
      const dx = fileToIndex(enemy.position.file) - fileToIndex(chameleon.position.file);
      const dy = enemy.position.rank - chameleon.position.rank;

      // Check all 8 knight directions
      const knightDirs = [
        { dx: 2, dy: 1 }, { dx: 2, dy: -1 }, { dx: -2, dy: 1 }, { dx: -2, dy: -1 },
        { dx: 1, dy: 2 }, { dx: 1, dy: -2 }, { dx: -1, dy: 2 }, { dx: -1, dy: -2 },
      ];

      for (const dir of knightDirs) {
        // Check if enemy is along this knight direction
        if (dir.dx !== 0 && dir.dy !== 0) {
          // Must be a multiple of this direction
          if (dx % dir.dx !== 0 || dy % dir.dy !== 0) continue;
          const mult = dx / dir.dx;
          if (mult <= 0 || dy / dir.dy !== mult) continue;

          // Check path is clear (all intermediate positions must be empty)
          let pathClear = true;
          for (let i = 1; i < mult; i++) {
            const midPos = offsetPosition(chameleon.position, dir.dx * i, dir.dy * i, board.dimensions);
            if (!midPos || !isSquareEmpty(board, midPos)) {
              pathClear = false;
              break;
            }
          }
          if (pathClear) return true;
        }
      }
      return false;
    }

    case 'cannon-move': {
      // Cannon captures by hopping over exactly one piece (screen) to hit target
      const dx = fileToIndex(enemy.position.file) - fileToIndex(chameleon.position.file);
      const dy = enemy.position.rank - chameleon.position.rank;

      // Must be orthogonal (cannon moves like rook)
      if (dx !== 0 && dy !== 0) return false;

      const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

      // Count pieces between chameleon and enemy (need exactly one screen)
      let piecesInBetween = 0;
      let currentPos = chameleon.position;
      while (true) {
        const nextPos = offsetPosition(currentPos, stepX, stepY, board.dimensions);
        if (!nextPos) return false;

        // Reached enemy position
        if (nextPos.file === enemy.position.file && nextPos.rank === enemy.position.rank) {
          return piecesInBetween === 1; // Must have exactly one screen piece
        }

        if (!isSquareEmpty(board, nextPos)) {
          piecesInBetween++;
          if (piecesInBetween > 1) return false; // Too many pieces
        }
        currentPos = nextPos;
      }
    }

    default:
      return false;
  }
}

// =============================================================================
// Long Leaper Moves
// =============================================================================

/**
 * Generate Long Leaper moves
 * - Non-capturing: slides like a Queen (any direction, any distance)
 * - Capturing: jumps over exactly one enemy piece to empty square beyond
 * - Can chain multiple jumps in the same direction
 */
function generateLongLeapMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];
  const visited = new Set<string>();

  // All 8 directions (orthogonal + diagonal)
  for (const dir of ALL_DIRECTIONS) {
    // Generate non-capturing slides (like Queen) and capturing jumps
    generateLongLeapInDirection(board, piece, piece.position, dir, moves, visited, false);
  }

  return moves;
}

/**
 * Recursively generate Long Leaper moves in a single direction
 * @param _hasJumped - true if we've already jumped at least one piece (capturing mode)
 */
function generateLongLeapInDirection(
  board: BoardState,
  piece: PieceInstance,
  fromPos: Position,
  dir: { dx: number; dy: number },
  moves: Position[],
  visited: Set<string>,
  _hasJumped: boolean
): void {
  let currentPos = fromPos;

  // Slide in this direction
  while (true) {
    const nextPos = offsetPosition(currentPos, dir.dx, dir.dy, board.dimensions);
    if (!nextPos) break;

    const posKey = positionToString(nextPos);

    // Hit a friendly piece - stop
    if (hasFriendlyPiece(board, nextPos, piece.owner)) break;

    // Empty square
    if (isSquareEmpty(board, nextPos)) {
      // If we haven't jumped yet, this is a valid non-capturing move (Queen-like slide)
      // If we have jumped, this is a valid landing spot after a capture
      if (!visited.has(posKey)) {
        moves.push(nextPos);
        visited.add(posKey);
      }
      currentPos = nextPos;
      continue;
    }

    // Enemy piece - check if we can jump over it
    if (hasEnemyPiece(board, nextPos, piece.owner)) {
      // Check if the piece is capturable
      const targetPiece = getPieceAt(board, nextPos);
      const targetType = targetPiece ? PIECE_BY_ID[targetPiece.typeId] : null;

      if (targetType?.canBeCaptured === false) {
        // Can't jump over uncapturable pieces (Fool, Jester) - stop
        break;
      }

      // Check the square beyond for landing
      const landingPos = offsetPosition(nextPos, dir.dx, dir.dy, board.dimensions);
      if (!landingPos) break; // No landing square - can't jump

      // Can only land on empty square
      if (!isSquareEmpty(board, landingPos)) break;

      const landingKey = positionToString(landingPos);
      if (!visited.has(landingKey)) {
        moves.push(landingPos);
        visited.add(landingKey);
      }

      // After landing, we can potentially continue jumping in the same direction
      // (multiple captures in one move)
      generateLongLeapInDirection(board, piece, landingPos, dir, moves, visited, true);

      // Can't continue past a jump in this iteration
      break;
    }

    currentPos = nextPos;
  }
}

// =============================================================================
// King Moves
// =============================================================================

/**
 * Generate king moves (one square in any direction)
 * Note: Castling is handled separately in castling.ts
 */
function generateKingMoves(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const moves: Position[] = [];

  for (const dir of ALL_DIRECTIONS) {
    const targetPos = offsetPosition(piece.position, dir.dx, dir.dy, board.dimensions);

    if (!targetPos) continue;

    // Can't move to square with friendly piece
    if (hasFriendlyPiece(board, targetPos, piece.owner)) continue;

    // Can't capture uncapturable enemy pieces (Fool, Jester)
    if (hasEnemyPiece(board, targetPos, piece.owner) &&
        !hasCapturableEnemyPiece(board, targetPos, piece.owner)) {
      continue;
    }

    moves.push(targetPos);
  }

  return moves;
}

// =============================================================================
// Attack Generation (for check detection)
// =============================================================================

/**
 * Generate all squares attacked by a piece
 * Similar to move generation but used for determining if a square is under attack
 */
export function getAttackedSquares(
  board: BoardState,
  piece: PieceInstance
): Position[] {
  if (!piece.position) return [];

  const pType = PIECE_BY_ID[piece.typeId];
  if (!pType) return [];

  const attacked: Position[] = [];

  // Sliding attacks
  if (pType.movement.slides.length > 0) {
    attacked.push(...generateSlideMoves(board, piece, pType.movement.slides));
  }

  // Leap attacks
  if (pType.movement.leaps.length > 0) {
    attacked.push(...generateLeapMoves(board, piece, pType.movement.leaps));
  }

  // Special attack patterns
  for (const special of pType.movement.special) {
    switch (special) {
      case 'pawn-capture-diagonal':
        // Pawns attack diagonally even if no piece is there
        attacked.push(...getPawnAttackSquares(board, piece));
        break;

      case 'shogi-pawn':
        // Shogi pawn attacks forward
        attacked.push(...getShogiPawnAttackSquares(board, piece));
        break;

      case 'peasant-capture-forward':
        // Peasant attacks forward (like shogi pawn)
        attacked.push(...getShogiPawnAttackSquares(board, piece));
        break;

      case 'king-one-square':
        // King attacks all adjacent squares
        attacked.push(...generateKingMoves(board, piece));
        break;

      case 'regent-conditional':
        // Regent attacks based on current mode
        attacked.push(...generateRegentMoves(board, piece));
        break;

      case 'herald-orthogonal':
        // Herald attacks 2 squares orthogonally
        attacked.push(...generateHeraldMoves(board, piece));
        break;

      case 'bounce':
        // Pontiff attacks with bouncing diagonal moves
        attacked.push(...generateBounceMoves(board, piece));
        break;

      case 'nightrider':
        // Nightrider attacks with repeated knight moves
        attacked.push(...generateNightriderMoves(board, piece));
        break;
    }
  }

  return attacked;
}

/**
 * Get squares a pawn attacks (for check detection)
 */
function getPawnAttackSquares(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const squares: Position[] = [];
  const direction = getPawnDirection(piece.owner);

  for (const dx of [-1, 1]) {
    const attackPos = offsetPosition(piece.position, dx, direction, board.dimensions);
    if (attackPos) {
      squares.push(attackPos);
    }
  }

  return squares;
}

/**
 * Get squares a Shogi pawn attacks (forward only)
 */
function getShogiPawnAttackSquares(board: BoardState, piece: PieceInstance): Position[] {
  if (!piece.position) return [];

  const direction = getPawnDirection(piece.owner);
  const attackPos = offsetPosition(piece.position, 0, direction, board.dimensions);

  return attackPos ? [attackPos] : [];
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a specific move is in the list of generated moves
 */
export function isMoveInList(moves: Position[], target: Position): boolean {
  return moves.some((m) => m.file === target.file && m.rank === target.rank);
}

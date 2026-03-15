/**
 * Web Worker for running minimax off the main thread
 */

import { getBestMove } from './minimax';
import type { GameState, PlayerColor } from '@hyper-fairy-chess/shared';

self.onmessage = (e: MessageEvent<{ gameState: GameState; color: PlayerColor; depth: number }>) => {
  const { gameState, color, depth } = e.data;
  const move = getBestMove(gameState, color, depth);
  self.postMessage(move);
};

/**
 * Games API Routes - game history and replay data
 */

import { Router, Request, Response } from 'express';
import { isDatabaseAvailable } from '../db/index.js';
import { verifyToken } from '../auth/jwt.js';
import { getUserGames, getGame } from '../services/gameService.js';

export const gamesRouter = Router();

function getAuthPayload(req: Request): { userId: string; username: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  return verifyToken(token);
}

/**
 * GET /games
 * Returns the authenticated user's game history (most recent 20)
 */
gamesRouter.get('/', async (req: Request, res: Response) => {
  if (!isDatabaseAvailable()) {
    return res.json({ games: [] });
  }

  const payload = getAuthPayload(req);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const games = await getUserGames(payload.userId);
  return res.json({ games });
});

/**
 * GET /games/:id
 * Returns full game record including moves and initial board state (for replay)
 * Public - anyone with the game ID can view it
 */
gamesRouter.get('/:id', async (req: Request, res: Response) => {
  if (!isDatabaseAvailable()) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  const game = await getGame(req.params.id);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  return res.json({ game });
});

import { Router } from 'express';
import { findUserByUsername } from '../auth/userService.js';
import { getPieceStats } from '../services/gameService.js';

const router = Router();

/**
 * GET /stats/pieces — per-piece draft and win-rate stats (non-playtest games only)
 */
router.get('/pieces', async (_req, res) => {
  try {
    const stats = await getPieceStats();
    return res.json(stats);
  } catch (error) {
    console.error('[Stats] Error fetching piece stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /stats/player/:username — player stats by username
 */
router.get('/player/:username', async (req, res) => {
  try {
    const { username } = req.params;

    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    const user = await findUserByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const winRate =
      user.gamesPlayed > 0
        ? Math.round((user.wins / user.gamesPlayed) * 100)
        : 0;

    return res.json({
      username: user.username,
      eloRating: user.eloRating,
      gamesPlayed: user.gamesPlayed,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      winRate,
    });
  } catch (error) {
    console.error('[Stats] Error fetching stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as statsRouter };

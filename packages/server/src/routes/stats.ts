import { Router } from 'express';
import { findUserByUsername } from '../auth/userService.js';

const router = Router();

/**
 * Get player stats by username
 */
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Invalid username' });
    }

    const user = await findUserByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate win rate
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

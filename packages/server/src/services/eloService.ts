import { getPool, isDatabaseAvailable } from '../db/index.js';

const K_FACTOR = 32;
const DEFAULT_ELO = 1200;

export interface EloUpdateResult {
  whiteEloChange: number;
  blackEloChange: number;
  whiteNewElo: number;
  blackNewElo: number;
}

/**
 * Calculate expected score using ELO formula.
 * Returns a value between 0 and 1.
 */
export function calculateExpectedScore(
  playerElo: number,
  opponentElo: number
): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Calculate ELO change for a player.
 * @param playerElo - Player's current ELO
 * @param opponentElo - Opponent's current ELO
 * @param score - Actual score: 1 for win, 0.5 for draw, 0 for loss
 * @returns ELO change (can be positive or negative)
 */
export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  score: number
): number {
  const expectedScore = calculateExpectedScore(playerElo, opponentElo);
  return Math.round(K_FACTOR * (score - expectedScore));
}

/**
 * Get user ELO by user ID.
 */
export async function getUserElo(userId: string): Promise<number | null> {
  if (!isDatabaseAvailable()) {
    return null;
  }

  const pool = getPool()!;

  try {
    const result = await pool.query(
      'SELECT elo_rating FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].elo_rating;
  } catch (error) {
    console.error('[ELO] Error getting user ELO:', error);
    return null;
  }
}

/**
 * Record a game result and update ELO ratings.
 * Only updates if both players are authenticated users.
 */
export async function recordGameResult(
  whiteUserId: string,
  blackUserId: string,
  resultType: string,
  winnerColor: 'white' | 'black' | null
): Promise<EloUpdateResult | null> {
  if (!isDatabaseAvailable()) {
    console.log('[ELO] Database not available, skipping ELO update');
    return null;
  }

  const pool = getPool()!;

  try {
    // Get current ELO for both players
    const whiteElo = await getUserElo(whiteUserId);
    const blackElo = await getUserElo(blackUserId);

    if (whiteElo === null || blackElo === null) {
      console.log('[ELO] Could not find ELO for one or both players');
      return null;
    }

    // Calculate scores based on result
    let whiteScore: number;
    let blackScore: number;

    if (winnerColor === 'white') {
      whiteScore = 1;
      blackScore = 0;
    } else if (winnerColor === 'black') {
      whiteScore = 0;
      blackScore = 1;
    } else {
      // Draw
      whiteScore = 0.5;
      blackScore = 0.5;
    }

    // Calculate ELO changes
    const whiteEloChange = calculateEloChange(whiteElo, blackElo, whiteScore);
    const blackEloChange = calculateEloChange(blackElo, whiteElo, blackScore);

    const whiteNewElo = whiteElo + whiteEloChange;
    const blackNewElo = blackElo + blackEloChange;

    // Update white player stats
    const whiteWinInc = winnerColor === 'white' ? 1 : 0;
    const whiteLossInc = winnerColor === 'black' ? 1 : 0;
    const whiteDrawInc = winnerColor === null ? 1 : 0;

    await pool.query(
      `UPDATE users SET
        elo_rating = $1,
        games_played = games_played + 1,
        wins = wins + $2,
        losses = losses + $3,
        draws = draws + $4
       WHERE id = $5`,
      [whiteNewElo, whiteWinInc, whiteLossInc, whiteDrawInc, whiteUserId]
    );

    // Update black player stats
    const blackWinInc = winnerColor === 'black' ? 1 : 0;
    const blackLossInc = winnerColor === 'white' ? 1 : 0;
    const blackDrawInc = winnerColor === null ? 1 : 0;

    await pool.query(
      `UPDATE users SET
        elo_rating = $1,
        games_played = games_played + 1,
        wins = wins + $2,
        losses = losses + $3,
        draws = draws + $4
       WHERE id = $5`,
      [blackNewElo, blackWinInc, blackLossInc, blackDrawInc, blackUserId]
    );

    // Insert game record
    await pool.query(
      `INSERT INTO games (white_user_id, black_user_id, result_type, winner_color,
        white_elo_before, black_elo_before, white_elo_change, black_elo_change)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        whiteUserId,
        blackUserId,
        resultType,
        winnerColor,
        whiteElo,
        blackElo,
        whiteEloChange,
        blackEloChange,
      ]
    );

    console.log(
      `[ELO] Game recorded: ${resultType}, winner: ${winnerColor || 'draw'}`
    );
    console.log(
      `[ELO] White: ${whiteElo} -> ${whiteNewElo} (${whiteEloChange >= 0 ? '+' : ''}${whiteEloChange})`
    );
    console.log(
      `[ELO] Black: ${blackElo} -> ${blackNewElo} (${blackEloChange >= 0 ? '+' : ''}${blackEloChange})`
    );

    return {
      whiteEloChange,
      blackEloChange,
      whiteNewElo,
      blackNewElo,
    };
  } catch (error) {
    console.error('[ELO] Error recording game result:', error);
    return null;
  }
}

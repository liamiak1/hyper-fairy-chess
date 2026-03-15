import { getPool, isDatabaseAvailable } from '../db/index.js';
import type { GameState, Move } from '@hyper-fairy-chess/shared';
import type { RoomSettings, DraftPick } from '@hyper-fairy-chess/shared';

export interface SaveGameParams {
  whiteUserId: string | null;
  blackUserId: string | null;
  whitePlayerName: string;
  blackPlayerName: string;
  resultType: string;
  winnerColor: 'white' | 'black' | null;
  whiteEloBefore: number | null;
  blackEloBefore: number | null;
  whiteEloChange: number | null;
  blackEloChange: number | null;
  settings: RoomSettings;
  whiteDraft: DraftPick[] | null;
  blackDraft: DraftPick[] | null;
  initialBoardState: GameState | null;
  moves: Move[];
}

export interface GameSummary {
  id: string;
  whitePlayerName: string;
  blackPlayerName: string;
  resultType: string;
  winnerColor: string | null;
  whiteEloChange: number | null;
  blackEloChange: number | null;
  settings: RoomSettings | null;
  moveCount: number;
  playedAt: string;
}

export interface GameRecord extends GameSummary {
  whiteDraft: DraftPick[] | null;
  blackDraft: DraftPick[] | null;
  initialBoardState: GameState | null;
  moves: Move[] | null;
}

export async function saveGame(params: SaveGameParams): Promise<string | null> {
  if (!isDatabaseAvailable()) return null;

  const pool = getPool()!;
  try {
    const result = await pool.query(
      `INSERT INTO games (
        white_user_id, black_user_id, white_player_name, black_player_name,
        result_type, winner_color,
        white_elo_before, black_elo_before, white_elo_change, black_elo_change,
        settings, white_draft, black_draft, initial_board_state, moves, move_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id`,
      [
        params.whiteUserId,
        params.blackUserId,
        params.whitePlayerName,
        params.blackPlayerName,
        params.resultType,
        params.winnerColor,
        params.whiteEloBefore,
        params.blackEloBefore,
        params.whiteEloChange,
        params.blackEloChange,
        params.settings ? JSON.stringify(params.settings) : null,
        params.whiteDraft ? JSON.stringify(params.whiteDraft) : null,
        params.blackDraft ? JSON.stringify(params.blackDraft) : null,
        params.initialBoardState ? JSON.stringify(params.initialBoardState) : null,
        params.moves.length > 0 ? JSON.stringify(params.moves) : null,
        params.moves.length,
      ]
    );
    return result.rows[0].id;
  } catch (error) {
    console.error('[GameService] Error saving game:', error);
    return null;
  }
}

export async function getUserGames(userId: string, limit = 20): Promise<GameSummary[]> {
  if (!isDatabaseAvailable()) return [];

  const pool = getPool()!;
  try {
    const result = await pool.query(
      `SELECT id, white_player_name, black_player_name, result_type, winner_color,
              white_elo_change, black_elo_change, settings, move_count, played_at,
              white_user_id, black_user_id
       FROM games
       WHERE white_user_id = $1 OR black_user_id = $1
       ORDER BY played_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      whitePlayerName: row.white_player_name,
      blackPlayerName: row.black_player_name,
      resultType: row.result_type,
      winnerColor: row.winner_color,
      whiteEloChange: row.white_elo_change,
      blackEloChange: row.black_elo_change,
      settings: row.settings,
      moveCount: row.move_count,
      playedAt: row.played_at,
    }));
  } catch (error) {
    console.error('[GameService] Error fetching user games:', error);
    return [];
  }
}

export interface PieceStat {
  pieceId: string;
  appearances: number;   // armies that included this piece
  totalCopies: number;   // total copies drafted (sum of counts)
  wins: number;
  draws: number;
  losses: number;
  totalGames: number;    // total non-playtest games analysed
}

export async function getPieceStats(): Promise<PieceStat[]> {
  if (!isDatabaseAvailable()) return [];

  const pool = getPool()!;
  try {
    const result = await pool.query(`
      WITH non_playtest AS (
        SELECT id, winner_color, result_type, white_draft, black_draft
        FROM games
        WHERE white_draft IS NOT NULL
          AND COALESCE(settings->>'isPlaytest', 'false') != 'true'
      ),
      total_games AS (
        SELECT COUNT(*) AS total FROM non_playtest
      ),
      exploded AS (
        SELECT
          pick->>'pieceTypeId' AS piece_id,
          COALESCE((pick->>'count')::int, 1) AS draft_count,
          CASE WHEN g.winner_color = 'white' THEN 'win'
               WHEN g.result_type = 'draw'   THEN 'draw'
               ELSE 'loss' END AS outcome
        FROM non_playtest g, jsonb_array_elements(g.white_draft) AS pick

        UNION ALL

        SELECT
          pick->>'pieceTypeId' AS piece_id,
          COALESCE((pick->>'count')::int, 1) AS draft_count,
          CASE WHEN g.winner_color = 'black' THEN 'win'
               WHEN g.result_type = 'draw'   THEN 'draw'
               ELSE 'loss' END AS outcome
        FROM non_playtest g, jsonb_array_elements(g.black_draft) AS pick
        WHERE g.black_draft IS NOT NULL
      )
      SELECT
        e.piece_id,
        COUNT(*)::int                                                       AS appearances,
        SUM(e.draft_count)::int                                            AS total_copies,
        SUM(CASE WHEN e.outcome = 'win'  THEN 1 ELSE 0 END)::int          AS wins,
        SUM(CASE WHEN e.outcome = 'draw' THEN 1 ELSE 0 END)::int          AS draws,
        SUM(CASE WHEN e.outcome = 'loss' THEN 1 ELSE 0 END)::int          AS losses,
        t.total::int                                                        AS total_games
      FROM exploded e, total_games t
      GROUP BY e.piece_id, t.total
      ORDER BY appearances DESC
    `);

    return result.rows.map(row => ({
      pieceId: row.piece_id,
      appearances: row.appearances,
      totalCopies: row.total_copies,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      totalGames: row.total_games,
    }));
  } catch (error) {
    console.error('[GameService] Error fetching piece stats:', error);
    return [];
  }
}

export async function getGame(gameId: string): Promise<GameRecord | null> {
  if (!isDatabaseAvailable()) return null;

  const pool = getPool()!;
  try {
    const result = await pool.query(
      `SELECT id, white_player_name, black_player_name, result_type, winner_color,
              white_elo_change, black_elo_change, settings, move_count, played_at,
              white_draft, black_draft, initial_board_state, moves
       FROM games WHERE id = $1`,
      [gameId]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    return {
      id: row.id,
      whitePlayerName: row.white_player_name,
      blackPlayerName: row.black_player_name,
      resultType: row.result_type,
      winnerColor: row.winner_color,
      whiteEloChange: row.white_elo_change,
      blackEloChange: row.black_elo_change,
      settings: row.settings,
      moveCount: row.move_count,
      playedAt: row.played_at,
      whiteDraft: row.white_draft,
      blackDraft: row.black_draft,
      initialBoardState: row.initial_board_state,
      moves: row.moves,
    };
  } catch (error) {
    console.error('[GameService] Error fetching game:', error);
    return null;
  }
}

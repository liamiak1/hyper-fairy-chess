import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Initialize database connection and run migrations.
 * If DATABASE_URL is not set, returns null (allows running without a database for local dev).
 */
export async function initDatabase(): Promise<pg.Pool | null> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.log(
      '[DB] DATABASE_URL not set - running without database (accounts disabled)'
    );
    return null;
  }

  try {
    pool = new Pool({
      connectionString,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : undefined,
    });

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('[DB] Connected to PostgreSQL');

    // Run migrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(30) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Add ELO columns (idempotent)
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS elo_rating INT DEFAULT 1200;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS games_played INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wins INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS losses INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS draws INT DEFAULT 0;
    `);

    // Create games history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        white_user_id UUID REFERENCES users(id),
        black_user_id UUID REFERENCES users(id),
        white_player_name VARCHAR(30) NOT NULL DEFAULT '',
        black_player_name VARCHAR(30) NOT NULL DEFAULT '',
        result_type VARCHAR(30) NOT NULL,
        winner_color VARCHAR(5),
        white_elo_before INT,
        black_elo_before INT,
        white_elo_change INT,
        black_elo_change INT,
        settings JSONB,
        white_draft JSONB,
        black_draft JSONB,
        initial_board_state JSONB,
        moves JSONB,
        move_count INT DEFAULT 0,
        played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add game history columns to existing games table (idempotent)
    await pool.query(`
      ALTER TABLE games ADD COLUMN IF NOT EXISTS white_player_name VARCHAR(30) NOT NULL DEFAULT '';
      ALTER TABLE games ADD COLUMN IF NOT EXISTS black_player_name VARCHAR(30) NOT NULL DEFAULT '';
      ALTER TABLE games ADD COLUMN IF NOT EXISTS settings JSONB;
      ALTER TABLE games ADD COLUMN IF NOT EXISTS white_draft JSONB;
      ALTER TABLE games ADD COLUMN IF NOT EXISTS black_draft JSONB;
      ALTER TABLE games ADD COLUMN IF NOT EXISTS initial_board_state JSONB;
      ALTER TABLE games ADD COLUMN IF NOT EXISTS moves JSONB;
      ALTER TABLE games ADD COLUMN IF NOT EXISTS move_count INT DEFAULT 0;
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_games_white_user ON games(white_user_id, played_at DESC);
      CREATE INDEX IF NOT EXISTS idx_games_black_user ON games(black_user_id, played_at DESC);
    `);

    // Create saved armies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_armies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        pieces JSONB NOT NULL,
        budget INT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_saved_armies_user ON saved_armies(user_id);
    `);

    // Create password reset tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token VARCHAR(128) PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);
    `);

    console.log('[DB] Migrations complete');

    return pool;
  } catch (error) {
    console.error('[DB] Failed to connect:', error);
    pool = null;
    return null;
  }
}

/**
 * Get the database pool. Returns null if database is not initialized.
 */
export function getPool(): pg.Pool | null {
  return pool;
}

/**
 * Check if database is available.
 */
export function isDatabaseAvailable(): boolean {
  return pool !== null;
}

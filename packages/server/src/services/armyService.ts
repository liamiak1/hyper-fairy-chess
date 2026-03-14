/**
 * Army Service - CRUD operations for saved armies
 */

import { getPool, isDatabaseAvailable } from '../db/index.js';

export interface ArmyPiece {
  pieceTypeId: string;
  count: number;
}

export interface SavedArmy {
  id: string;
  userId: string;
  name: string;
  pieces: ArmyPiece[];
  budget: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all armies for a user, sorted by budget ascending
 */
export async function getUserArmies(userId: string): Promise<SavedArmy[]> {
  if (!isDatabaseAvailable()) return [];

  const pool = getPool()!;
  const result = await pool.query(
    `SELECT id, user_id, name, pieces, budget, created_at, updated_at
     FROM saved_armies
     WHERE user_id = $1
     ORDER BY budget ASC, name ASC`,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    pieces: row.pieces,
    budget: row.budget,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get a single army by ID (must belong to user)
 */
export async function getArmyById(
  armyId: string,
  userId: string
): Promise<SavedArmy | null> {
  if (!isDatabaseAvailable()) return null;

  const pool = getPool()!;
  const result = await pool.query(
    `SELECT id, user_id, name, pieces, budget, created_at, updated_at
     FROM saved_armies
     WHERE id = $1 AND user_id = $2`,
    [armyId, userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    pieces: row.pieces,
    budget: row.budget,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new saved army
 */
export async function createArmy(
  userId: string,
  name: string,
  pieces: ArmyPiece[],
  budget: number
): Promise<SavedArmy | null> {
  if (!isDatabaseAvailable()) return null;

  const pool = getPool()!;
  const result = await pool.query(
    `INSERT INTO saved_armies (user_id, name, pieces, budget)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, pieces, budget, created_at, updated_at`,
    [userId, name.trim(), JSON.stringify(pieces), budget]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    pieces: row.pieces,
    budget: row.budget,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Update an existing army (must belong to user)
 */
export async function updateArmy(
  armyId: string,
  userId: string,
  name: string,
  pieces: ArmyPiece[],
  budget: number
): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const pool = getPool()!;
  const result = await pool.query(
    `UPDATE saved_armies
     SET name = $1, pieces = $2, budget = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND user_id = $5`,
    [name.trim(), JSON.stringify(pieces), budget, armyId, userId]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Delete an army (must belong to user)
 */
export async function deleteArmy(
  armyId: string,
  userId: string
): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  const pool = getPool()!;
  const result = await pool.query(
    `DELETE FROM saved_armies WHERE id = $1 AND user_id = $2`,
    [armyId, userId]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

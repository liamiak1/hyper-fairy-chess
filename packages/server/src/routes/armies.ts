/**
 * Armies API Routes - CRUD for saved armies
 */

import { Router, Request, Response } from 'express';
import { isDatabaseAvailable } from '../db/index.js';
import { verifyToken } from '../auth/jwt.js';
import {
  getUserArmies,
  createArmy,
  updateArmy,
  deleteArmy,
} from '../services/armyService.js';

export const armiesRouter = Router();

/**
 * Extract and verify JWT token from Authorization header
 */
function getAuthPayload(req: Request): { userId: string; username: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyToken(token);
}

/**
 * GET /armies
 * List all saved armies for the authenticated user
 */
armiesRouter.get('/', async (req: Request, res: Response) => {
  if (!isDatabaseAvailable()) {
    res.status(503).json({
      error: 'service_unavailable',
      message: 'Database not available',
    });
    return;
  }

  const payload = getAuthPayload(req);
  if (!payload) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid or missing token',
    });
    return;
  }

  const armies = await getUserArmies(payload.userId);
  res.json({ armies });
});

/**
 * POST /armies
 * Create a new saved army
 */
armiesRouter.post('/', async (req: Request, res: Response) => {
  if (!isDatabaseAvailable()) {
    res.status(503).json({
      error: 'service_unavailable',
      message: 'Database not available',
    });
    return;
  }

  const payload = getAuthPayload(req);
  if (!payload) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid or missing token',
    });
    return;
  }

  const { name, pieces, budget } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      error: 'invalid_name',
      message: 'Army name is required',
    });
    return;
  }

  if (name.length > 50) {
    res.status(400).json({
      error: 'invalid_name',
      message: 'Army name must be 50 characters or less',
    });
    return;
  }

  if (!Array.isArray(pieces)) {
    res.status(400).json({
      error: 'invalid_pieces',
      message: 'Pieces must be an array',
    });
    return;
  }

  if (typeof budget !== 'number' || budget < 0) {
    res.status(400).json({
      error: 'invalid_budget',
      message: 'Budget must be a positive number',
    });
    return;
  }

  const army = await createArmy(payload.userId, name, pieces, budget);

  if (!army) {
    res.status(500).json({
      error: 'create_failed',
      message: 'Failed to create army',
    });
    return;
  }

  res.status(201).json({ army });
});

/**
 * PUT /armies/:id
 * Update an existing army
 */
armiesRouter.put('/:id', async (req: Request, res: Response) => {
  if (!isDatabaseAvailable()) {
    res.status(503).json({
      error: 'service_unavailable',
      message: 'Database not available',
    });
    return;
  }

  const payload = getAuthPayload(req);
  if (!payload) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid or missing token',
    });
    return;
  }

  const { id } = req.params;
  const { name, pieces, budget } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      error: 'invalid_name',
      message: 'Army name is required',
    });
    return;
  }

  if (name.length > 50) {
    res.status(400).json({
      error: 'invalid_name',
      message: 'Army name must be 50 characters or less',
    });
    return;
  }

  if (!Array.isArray(pieces)) {
    res.status(400).json({
      error: 'invalid_pieces',
      message: 'Pieces must be an array',
    });
    return;
  }

  if (typeof budget !== 'number' || budget < 0) {
    res.status(400).json({
      error: 'invalid_budget',
      message: 'Budget must be a positive number',
    });
    return;
  }

  const success = await updateArmy(id, payload.userId, name, pieces, budget);

  if (!success) {
    res.status(404).json({
      error: 'not_found',
      message: 'Army not found or access denied',
    });
    return;
  }

  res.json({ success: true });
});

/**
 * DELETE /armies/:id
 * Delete an army
 */
armiesRouter.delete('/:id', async (req: Request, res: Response) => {
  if (!isDatabaseAvailable()) {
    res.status(503).json({
      error: 'service_unavailable',
      message: 'Database not available',
    });
    return;
  }

  const payload = getAuthPayload(req);
  if (!payload) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid or missing token',
    });
    return;
  }

  const { id } = req.params;
  const success = await deleteArmy(id, payload.userId);

  if (!success) {
    res.status(404).json({
      error: 'not_found',
      message: 'Army not found or access denied',
    });
    return;
  }

  res.json({ success: true });
});

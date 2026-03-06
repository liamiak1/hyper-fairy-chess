import { Router, Request, Response } from 'express';
import { isDatabaseAvailable } from '../db/index.js';
import { verifyToken } from '../auth/jwt.js';
import {
  createUser,
  authenticateUser,
  findUserById,
} from '../auth/userService.js';

export const authRouter = Router();

// JSON body parsing middleware for auth routes
authRouter.use((req: Request, res: Response, next) => {
  if (!req.body) {
    req.body = {};
  }
  next();
});

/**
 * POST /auth/register
 * Create a new user account.
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  if (!isDatabaseAvailable()) {
    res.status(503).json({
      error: 'service_unavailable',
      message: 'Account creation is not available',
    });
    return;
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({
      error: 'missing_fields',
      message: 'Username, email, and password are required',
    });
    return;
  }

  const result = await createUser(username, email, password);

  if (!result.success) {
    res.status(400).json({
      error: 'registration_failed',
      message: result.error,
      field: result.field,
    });
    return;
  }

  res.status(201).json({
    user: result.user,
    token: result.token,
  });
});

/**
 * POST /auth/login
 * Authenticate with email/username and password.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  if (!isDatabaseAvailable()) {
    res.status(503).json({
      error: 'service_unavailable',
      message: 'Login is not available',
    });
    return;
  }

  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    res.status(400).json({
      error: 'missing_fields',
      message: 'Email/username and password are required',
    });
    return;
  }

  const result = await authenticateUser(emailOrUsername, password);

  if (!result.success) {
    res.status(401).json({
      error: 'authentication_failed',
      message: result.error,
    });
    return;
  }

  res.json({
    user: result.user,
    token: result.token,
  });
});

/**
 * GET /auth/profile
 * Get the current user's profile (requires valid token).
 */
authRouter.get('/profile', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'No token provided',
    });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid or expired token',
    });
    return;
  }

  const user = await findUserById(payload.userId);

  if (!user) {
    res.status(404).json({
      error: 'not_found',
      message: 'User not found',
    });
    return;
  }

  res.json({ user });
});

/**
 * GET /auth/status
 * Check if auth/accounts are available (no auth required).
 */
authRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    available: isDatabaseAvailable(),
  });
});

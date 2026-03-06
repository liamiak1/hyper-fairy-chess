import jwt from 'jsonwebtoken';
import type { JWTPayload, User } from './types.js';

const JWT_SECRET =
  process.env.JWT_SECRET || 'dev-secret-change-in-production-12345';
const TOKEN_EXPIRY = '7d';

/**
 * Generate a JWT token for a user.
 */
export function generateToken(user: User): string {
  return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

/**
 * Verify and decode a JWT token.
 * Returns null if token is invalid or expired.
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

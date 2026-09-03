/**
 * Shared helpers for Express route handlers.
 */

import type { Request } from 'express';

/**
 * Read a single route parameter as a string.
 *
 * Express 5 types route params as `string | string[]`, because a repeated
 * param (`?id=a&id=b`, or a repeating path segment) yields an array. Passing
 * that array straight into a service would reach the SQL layer as a non-scalar,
 * so an array is rejected here rather than silently coerced.
 *
 * Returns null if the parameter is missing, empty, or not a single string.
 */
export function getStringParam(req: Request, name: string): string | null {
  const raw = (req.params as Record<string, string | string[] | undefined>)[name];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

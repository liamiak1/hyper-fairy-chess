/**
 * User data returned from database (excludes password hash).
 */
export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

/**
 * JWT payload structure.
 */
export interface JWTPayload {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

/**
 * Result of authentication operations.
 */
export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  field?: string; // Which field caused the error (for validation)
}

/**
 * Validation result for input fields.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
}

import { getPool, isDatabaseAvailable } from '../db/index.js';
import { hashPassword, verifyPassword } from './password.js';
import { generateToken } from './jwt.js';
import type { AuthResult, User, ValidationResult } from './types.js';

// Validation constants
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 8;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate username format.
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.length < USERNAME_MIN) {
    return {
      valid: false,
      error: `Username must be at least ${USERNAME_MIN} characters`,
      field: 'username',
    };
  }
  if (username.length > USERNAME_MAX) {
    return {
      valid: false,
      error: `Username must be at most ${USERNAME_MAX} characters`,
      field: 'username',
    };
  }
  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, and underscores',
      field: 'username',
    };
  }
  return { valid: true };
}

/**
 * Validate email format.
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || !EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Invalid email format', field: 'email' };
  }
  return { valid: true };
}

/**
 * Validate password strength.
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.length < PASSWORD_MIN) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN} characters`,
      field: 'password',
    };
  }
  return { valid: true };
}

/**
 * Create a new user account.
 */
export async function createUser(
  username: string,
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isDatabaseAvailable()) {
    return { success: false, error: 'Database not available' };
  }

  // Validate inputs
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) {
    return {
      success: false,
      error: usernameCheck.error,
      field: usernameCheck.field,
    };
  }

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    return { success: false, error: emailCheck.error, field: emailCheck.field };
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return {
      success: false,
      error: passwordCheck.error,
      field: passwordCheck.field,
    };
  }

  const pool = getPool()!;
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.trim();

  try {
    // Check for existing username or email
    const existing = await pool.query(
      'SELECT username, email FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
      [normalizedUsername, normalizedEmail]
    );

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (existingUser.username.toLowerCase() === normalizedUsername.toLowerCase()) {
        return { success: false, error: 'Username already taken', field: 'username' };
      }
      return { success: false, error: 'Email already registered', field: 'email' };
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [normalizedUsername, normalizedEmail, passwordHash]
    );

    const user: User = {
      id: result.rows[0].id,
      username: result.rows[0].username,
      email: result.rows[0].email,
      createdAt: result.rows[0].created_at,
    };

    const token = generateToken(user);

    return { success: true, user, token };
  } catch (error) {
    console.error('[Auth] Error creating user:', error);
    return { success: false, error: 'Failed to create account' };
  }
}

/**
 * Authenticate a user with email/username and password.
 */
export async function authenticateUser(
  emailOrUsername: string,
  password: string
): Promise<AuthResult> {
  if (!isDatabaseAvailable()) {
    return { success: false, error: 'Database not available' };
  }

  if (!emailOrUsername || !password) {
    return { success: false, error: 'Email/username and password required' };
  }

  const pool = getPool()!;
  const normalized = emailOrUsername.toLowerCase().trim();

  try {
    // Find user by email or username
    const result = await pool.query(
      `SELECT id, username, email, password_hash, created_at
       FROM users
       WHERE LOWER(email) = $1 OR LOWER(username) = $1`,
      [normalized]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid credentials' };
    }

    const row = result.rows[0];
    const isValid = await verifyPassword(password, row.password_hash);

    if (!isValid) {
      return { success: false, error: 'Invalid credentials' };
    }

    const user: User = {
      id: row.id,
      username: row.username,
      email: row.email,
      createdAt: row.created_at,
    };

    const token = generateToken(user);

    return { success: true, user, token };
  } catch (error) {
    console.error('[Auth] Error authenticating user:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Find a user by ID.
 */
export async function findUserById(id: string): Promise<User | null> {
  if (!isDatabaseAvailable()) {
    return null;
  }

  const pool = getPool()!;

  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('[Auth] Error finding user:', error);
    return null;
  }
}

/**
 * Find a user by username.
 */
export async function findUserByUsername(
  username: string
): Promise<User | null> {
  if (!isDatabaseAvailable()) {
    return null;
  }

  const pool = getPool()!;

  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('[Auth] Error finding user:', error);
    return null;
  }
}

/**
 * Find a user by email.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  if (!isDatabaseAvailable()) {
    return null;
  }

  const pool = getPool()!;

  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('[Auth] Error finding user:', error);
    return null;
  }
}

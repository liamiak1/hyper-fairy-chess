/**
 * Auth token storage utilities using localStorage.
 */

const AUTH_TOKEN_KEY = 'hfc_authToken';
const AUTH_USER_KEY = 'hfc_authUser';

export interface StoredUser {
  id: string;
  username: string;
  email: string;
}

/**
 * Get the stored auth token.
 */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Save the auth token to localStorage.
 */
export function saveAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    console.error('[AuthStorage] Failed to save token');
  }
}

/**
 * Clear the auth token from localStorage.
 */
export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    console.error('[AuthStorage] Failed to clear token');
  }
}

/**
 * Get the stored user data.
 */
export function getStoredUser(): StoredUser | null {
  try {
    const data = localStorage.getItem(AUTH_USER_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save user data to localStorage.
 */
export function saveStoredUser(user: StoredUser): void {
  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    console.error('[AuthStorage] Failed to save user');
  }
}

/**
 * Auth API client for communicating with the server.
 */

// Get the server URL from environment or default to localhost
const getApiBase = (): string => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  // For LAN play, use the current hostname
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AuthError {
  error: string;
  message: string;
  field?: string;
}

export interface AuthStatusResponse {
  available: boolean;
}

/**
 * Check if auth/accounts are available on the server.
 */
export async function checkAuthStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBase()}/auth/status`);
    if (!response.ok) return false;
    const data: AuthStatusResponse = await response.json();
    return data.available;
  } catch {
    return false;
  }
}

/**
 * Register a new user account.
 */
export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<{ success: true; data: AuthResponse } | { success: false; error: AuthError }> {
  try {
    const response = await fetch(`${getApiBase()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as AuthError };
    }

    return { success: true, data: data as AuthResponse };
  } catch (error) {
    return {
      success: false,
      error: {
        error: 'network_error',
        message: 'Failed to connect to server',
      },
    };
  }
}

/**
 * Login with email/username and password.
 */
export async function loginUser(
  emailOrUsername: string,
  password: string
): Promise<{ success: true; data: AuthResponse } | { success: false; error: AuthError }> {
  try {
    const response = await fetch(`${getApiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data as AuthError };
    }

    return { success: true, data: data as AuthResponse };
  } catch (error) {
    return {
      success: false,
      error: {
        error: 'network_error',
        message: 'Failed to connect to server',
      },
    };
  }
}

/**
 * Get the current user's profile using a token.
 */
export async function getProfile(
  token: string
): Promise<{ success: true; user: User } | { success: false; error: string }> {
  try {
    const response = await fetch(`${getApiBase()}/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: 'Invalid or expired token' };
    }

    const data = await response.json();
    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, error: 'Failed to connect to server' };
  }
}

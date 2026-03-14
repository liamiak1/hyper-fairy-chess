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
  eloRating?: number;
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  draws?: number;
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
  emailAvailable?: boolean;
}

/**
 * Check if auth/accounts are available on the server.
 */
export async function checkAuthStatus(): Promise<{ available: boolean; emailAvailable: boolean }> {
  try {
    const response = await fetch(`${getApiBase()}/auth/status`);
    if (!response.ok) return { available: false, emailAvailable: false };
    const data: AuthStatusResponse = await response.json();
    return { available: data.available, emailAvailable: data.emailAvailable ?? false };
  } catch {
    return { available: false, emailAvailable: false };
  }
}

/**
 * Request a password reset email.
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${getApiBase()}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.message || 'Failed to send reset email' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to connect to server' };
  }
}

/**
 * Reset password using a token from the reset email.
 */
export async function resetPassword(
  token: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${getApiBase()}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.message || 'Failed to reset password' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to connect to server' };
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

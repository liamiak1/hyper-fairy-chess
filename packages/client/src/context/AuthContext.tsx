/**
 * Authentication context for managing user login state.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { User } from '../api/auth';
import {
  registerUser,
  loginUser,
  getProfile,
  checkAuthStatus,
} from '../api/auth';
import {
  getAuthToken,
  saveAuthToken,
  clearAuthToken,
  saveStoredUser,
} from '../utils/authStorage';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  error: string | null;
  authAvailable: boolean;
}

interface AuthContextValue extends AuthState {
  login: (emailOrUsername: string, password: string) => Promise<boolean>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; field?: string }>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    token: null,
    error: null,
    authAvailable: false,
  });

  // Check for existing token and auth availability on mount
  useEffect(() => {
    async function initAuth() {
      // Check if auth is available on server
      const available = await checkAuthStatus();

      const storedToken = getAuthToken();

      if (!storedToken) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          authAvailable: available,
        }));
        return;
      }

      // Validate token with server
      const result = await getProfile(storedToken);

      if (result.success) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: result.user,
          token: storedToken,
          error: null,
          authAvailable: available,
        });
        saveStoredUser(result.user);
      } else {
        // Token invalid - clear it
        clearAuthToken();
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          token: null,
          error: null,
          authAvailable: available,
        });
      }
    }

    initAuth();
  }, []);

  const login = useCallback(
    async (emailOrUsername: string, password: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, error: null, isLoading: true }));

      const result = await loginUser(emailOrUsername, password);

      if (result.success) {
        saveAuthToken(result.data.token);
        saveStoredUser(result.data.user);
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          isLoading: false,
          user: result.data.user,
          token: result.data.token,
          error: null,
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error.message,
        }));
        return false;
      }
    },
    []
  );

  const register = useCallback(
    async (
      username: string,
      email: string,
      password: string
    ): Promise<{ success: boolean; error?: string; field?: string }> => {
      setState((prev) => ({ ...prev, error: null, isLoading: true }));

      const result = await registerUser(username, email, password);

      if (result.success) {
        saveAuthToken(result.data.token);
        saveStoredUser(result.data.user);
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          isLoading: false,
          user: result.data.user,
          token: result.data.token,
          error: null,
        }));
        return { success: true };
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error.message,
        }));
        return {
          success: false,
          error: result.error.message,
          field: result.error.field,
        };
      }
    },
    []
  );

  const logout = useCallback(() => {
    clearAuthToken();
    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      user: null,
      token: null,
      error: null,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login,
      register,
      logout,
      clearError,
    }),
    [state, login, register, logout, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

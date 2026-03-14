/**
 * Auth Modal - Login, Register, and Forgot Password forms
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { requestPasswordReset } from '../api/auth';
import './AuthModal.css';

interface AuthModalProps {
  onClose: () => void;
}

type Tab = 'login' | 'register' | 'forgot';

export function AuthModal({ onClose }: AuthModalProps) {
  const { login, register, isLoading, error, clearError, emailAvailable } = useAuth();
  const [tab, setTab] = useState<Tab>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    clearError();
    setFieldError(null);
    setForgotSent(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    if (!loginEmail.trim() || !loginPassword) {
      setFieldError('Please fill in all fields');
      return;
    }

    const success = await login(loginEmail.trim(), loginPassword);
    if (success) {
      onClose();
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    if (!regUsername.trim() || !regEmail.trim() || !regPassword || !regConfirm) {
      setFieldError('Please fill in all fields');
      return;
    }

    if (regPassword !== regConfirm) {
      setFieldError('Passwords do not match');
      return;
    }

    if (regPassword.length < 8) {
      setFieldError('Password must be at least 8 characters');
      return;
    }

    const result = await register(regUsername.trim(), regEmail.trim(), regPassword);
    if (result.success) {
      onClose();
    } else if (result.error) {
      setFieldError(result.error);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    if (!forgotEmail.trim()) {
      setFieldError('Please enter your email');
      return;
    }

    setForgotLoading(true);
    const result = await requestPasswordReset(forgotEmail.trim());
    setForgotLoading(false);

    if (result.success) {
      setForgotSent(true);
    } else {
      setFieldError(result.error || 'Failed to send reset email');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="auth-modal-backdrop" onClick={handleBackdropClick}>
      <div className="auth-modal">
        <button className="auth-modal-close" onClick={onClose}>
          &times;
        </button>

        {tab !== 'forgot' && (
          <div className="auth-tabs">
            <button
              className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => handleTabChange('login')}
            >
              Login
            </button>
            <button
              className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => handleTabChange('register')}
            >
              Register
            </button>
          </div>
        )}

        {tab === 'forgot' && (
          <div className="auth-forgot-header">
            <button className="auth-back-btn" onClick={() => handleTabChange('login')}>
              ← Back to Login
            </button>
            <h3>Reset Password</h3>
          </div>
        )}

        {(error || fieldError) && (
          <div className="auth-error">{fieldError || error}</div>
        )}

        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label htmlFor="login-email">Email or Username</label>
              <input
                id="login-email"
                type="text"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Enter email or username"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">
                Password
                {emailAvailable && (
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() => handleTabChange('forgot')}
                  >
                    Forgot password?
                  </button>
                )}
              </label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>

            <p className="auth-switch">
              Don't have an account?{' '}
              <button type="button" onClick={() => handleTabChange('register')}>
                Register
              </button>
            </p>
          </form>
        )}

        {tab === 'register' && (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-field">
              <label htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="Choose a username"
                autoComplete="username"
                maxLength={30}
                disabled={isLoading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Choose a password (min 8 chars)"
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="reg-confirm">Confirm Password</label>
              <input
                id="reg-confirm"
                type="password"
                value={regConfirm}
                onChange={(e) => setRegConfirm(e.target.value)}
                placeholder="Confirm your password"
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>

            <p className="auth-switch">
              Already have an account?{' '}
              <button type="button" onClick={() => handleTabChange('login')}>
                Login
              </button>
            </p>
          </form>
        )}

        {tab === 'forgot' && (
          forgotSent ? (
            <div className="auth-form forgot-sent">
              <div className="forgot-sent-icon">✉</div>
              <p>If <strong>{forgotEmail}</strong> is registered, a reset link has been sent.</p>
              <p className="forgot-hint">Check your inbox (and spam folder).</p>
              <button
                type="button"
                className="auth-submit"
                onClick={() => handleTabChange('login')}
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleForgot}>
              <p className="forgot-desc">
                Enter your account email and we'll send you a link to reset your password.
              </p>
              <div className="auth-field">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={forgotLoading}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="auth-submit"
                disabled={forgotLoading}
              >
                {forgotLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}

/**
 * Reset Password Form - shown when the user arrives via a reset link (?reset_token=...)
 */

import { useState } from 'react';
import { resetPassword } from '../api/auth';
import './AuthModal.css';

interface ResetPasswordFormProps {
  token: string;
  onDone: () => void;
}

export function ResetPasswordForm({ token, onDone }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirm) {
      setError('Please fill in both fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await resetPassword(token, password);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || 'Failed to reset password');
    }
  };

  return (
    <div className="auth-modal-backdrop">
      <div className="auth-modal">
        <h3 style={{ color: '#fff', marginTop: 0 }}>Set New Password</h3>

        {error && <div className="auth-error">{error}</div>}

        {success ? (
          <div className="auth-form forgot-sent">
            <div className="forgot-sent-icon">✓</div>
            <p>Your password has been updated.</p>
            <button className="auth-submit" onClick={onDone}>
              Go to Login
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

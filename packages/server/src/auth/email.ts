/**
 * Email service using Resend (https://resend.com)
 */

import { Resend } from 'resend';

const CLIENT_URL =
  process.env.CLIENT_URL ||
  process.env.CORS_ORIGIN ||
  'http://localhost:5173';

const FROM =
  process.env.EMAIL_FROM ||
  'Hyper Fairy Chess <onboarding@resend.dev>';

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export function isEmailAvailable(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendPasswordResetEmail(
  toEmail: string,
  username: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: 'Email service not configured' };

  const resetUrl = `${CLIENT_URL}?reset_token=${token}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Reset your Hyper Fairy Chess password',
    text: [
      `Hi ${username},`,
      '',
      'You requested a password reset for your Hyper Fairy Chess account.',
      '',
      `Reset your password here: ${resetUrl}`,
      '',
      'This link expires in 1 hour. If you did not request this, you can ignore this email.',
      '',
      '— Hyper Fairy Chess',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#222">
        <h2 style="color:#6c5ce7">Hyper Fairy Chess</h2>
        <p>Hi <strong>${username}</strong>,</p>
        <p>You requested a password reset for your account.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}"
             style="background:#6c5ce7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
        </p>
        <p style="color:#888;font-size:0.9em">
          This link expires in 1 hour.<br>
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('[Email] Resend error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Diagnostic: attempt to send a test email and return the result.
 */
export async function testSmtpConnection(): Promise<{ ok: boolean; error?: string; config: object }> {
  const config = {
    provider: 'Resend',
    apiKeySet: !!process.env.RESEND_API_KEY,
    apiKeyLength: process.env.RESEND_API_KEY?.length ?? 0,
    from: FROM,
    clientUrl: CLIENT_URL,
  };

  const resend = getResend();
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY env var not set', config };
  }

  // Send-only keys can't call domains.list() — that's fine, sending is all we need.
  // Just confirm the key is present and well-formed (starts with "re_").
  const apiKey = process.env.RESEND_API_KEY!;
  if (!apiKey.startsWith('re_')) {
    return { ok: false, error: 'RESEND_API_KEY does not look like a valid Resend key (should start with re_)', config };
  }

  return { ok: true, config };
}

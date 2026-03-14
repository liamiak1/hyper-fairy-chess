/**
 * Email service for sending transactional emails (password reset, etc.)
 */

import nodemailer from 'nodemailer';

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

/**
 * Test the SMTP connection and return a diagnostic result.
 */
export async function testSmtpConnection(): Promise<{ ok: boolean; error?: string; config: object }> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const config = {
    host: host || '(not set)',
    port: port || '(not set)',
    user: user || '(not set)',
    passLength: pass ? pass.length : 0,
    from: FROM,
    clientUrl: CLIENT_URL,
  };

  const transporter = createTransporter();
  if (!transporter) {
    return { ok: false, error: 'Missing SMTP_HOST, SMTP_USER, or SMTP_PASS env vars', config };
  }

  try {
    await transporter.verify();
    return { ok: true, config };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, config };
  }
}

export function isEmailAvailable(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@hyperfairychess.com';
const CLIENT_URL =
  process.env.CLIENT_URL ||
  process.env.CORS_ORIGIN ||
  'http://localhost:5173';

export async function sendPasswordResetEmail(
  toEmail: string,
  username: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, error: 'Email service not configured' };
  }

  const resetUrl = `${CLIENT_URL}?reset_token=${token}`;

  try {
    await transporter.sendMail({
      from: `"Hyper Fairy Chess" <${FROM}>`,
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
    return { success: true };
  } catch (err) {
    console.error('[Email] Failed to send password reset email:', err);
    return { success: false, error: 'Failed to send email' };
  }
}

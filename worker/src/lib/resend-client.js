/**
 * Resend Email Client — Resend.com HTTP API wrapper for Cloudflare Workers
 *
 * Free tier: 3,000 emails/month, 100/day. Suitable for ~500/mo cafe emails.
 * Non-blocking fire-and-forget pattern — errors are logged, never thrown.
 *
 * Usage:
 *   import { sendEmail } from '../lib/resend-client.js';
 *   const { success, messageId } = await sendEmail(env, { to, subject, html });
 *   // Or fire-and-forget:
 *   ctx.waitUntil(sendEmail(env, { to, subject, html }));
 *
 * Env vars required:
 *   RESEND_API_KEY  — Resend API key (Bearer token)
 *
 * Optional:
 *   EMAIL_FROM      — Sender address, e.g. "Aura Cafe <aura@auraspace.cafe>"
 *
 * API docs: https://resend.com/docs/api-reference/emails/send-email
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'resend.email' });
const RESEND_API = 'https://api.resend.com/emails';

/**
 * @param {object} env — Worker env bindings (RESEND_API_KEY, optional EMAIL_FROM)
 * @param {object} opts
 * @param {string} opts.to — Recipient email address
 * @param {string} opts.subject — Email subject line
 * @param {string} opts.html — Email body (HTML)
 * @returns {Promise<{success: boolean, messageId?: string, skipped?: boolean}>}
 */
export async function sendEmail(env, { to, subject, html }) {
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey) {
    log.warn('RESEND_API_KEY not configured — skipping email', { to, subject });
    return { success: false, skipped: true };
  }

  if (!to || !subject || !html) {
    log.warn('Missing required email fields', {
      hasTo: !!to,
      hasSubject: !!subject,
      hasHtml: !!html,
    });
    return { success: false };
  }

  const from = env.EMAIL_FROM || 'Aura Cafe <aura@auraspace.cafe>';

  const payload = {
    from,
    to: [to],
    subject,
    html,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      log.info('email_sent', { to, subject, messageId: data.id });
      return { success: true, messageId: data.id };
    }

    const body = await response.text();
    log.error('resend_api_error', {
      status: response.status,
      body: body.slice(0, 200),
      to,
      subject,
    });
    return { success: false };
  } catch (err) {
    log.error('resend_network_error', { message: err.message, to, subject });
    return { success: false };
  }
}

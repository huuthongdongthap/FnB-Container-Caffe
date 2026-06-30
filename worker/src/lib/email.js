/**
 * Email Utility — SendGrid HTTP API wrapper for Cloudflare Workers
 *
 * Uses SendGrid Mail Send v3 API (HTTP POST), compatible with Edge Runtime.
 * Non-blocking fire-and-forget pattern — errors are logged never thrown.
 *
 * Provider: SendGrid (free tier: 100 emails/day)
 * Docs: https://docs.sendgrid.com/api-reference/mail-send/mail-send
 *
 * Usage:
 *   import { sendEmail } from '../lib/email.js';
 *   const ok = await sendEmail(env, { to, subject, html });
 *   // Or fire-and-forget:
 *   ctx.waitUntil(sendEmail(env, { to, subject, html }));
 *
 * Env vars required:
 *   SENDGRID_API_KEY  — SendGrid API key (Bearer token)
 *   EMAIL_FROM        — Sender email (e.g. "aura@fnb-caffe-container.pages.dev")
 *   EMAIL_FROM_NAME   — Sender display name (e.g. "AURA CAFE")
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'email.send' });

const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send';

/**
 * @param {object} env — Worker env bindings (SENDGRID_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME)
 * @param {object} opts
 * @param {string} opts.to — Recipient email address
 * @param {string} opts.subject — Email subject line
 * @param {string} opts.html — Email body (HTML)
 * @param {string} [opts.text] — Optional plain-text fallback
 * @returns {Promise<boolean>} true if sent successfully, false on error
 */
export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.SENDGRID_API_KEY) {
    log.warn('SENDGRID_API_KEY not configured — skipping email', { to, subject });
    return false;
  }

  if (!to || !subject || !html) {
    log.warn('Missing required email fields', { hasTo: !!to, hasSubject: !!subject, hasHtml: !!html });
    return false;
  }

  const fromEmail = env.EMAIL_FROM || 'aura@fnb-caffe-container.pages.dev';
  const fromName = env.EMAIL_FROM_NAME || 'AURA CAFE';

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail, name: fromName },
    subject,
    content: [{ type: 'text/html', value: html }],
  };

  if (text) {
    payload.content.push({ type: 'text/plain', value: text });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(SENDGRID_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      log.info('email_sent', { to, subject });
      return true;
    }

    const body = await response.text();
    log.error('sendgrid_error', { status: response.status, body: body.slice(0, 200), to, subject });
    return false;
  } catch (err) {
    log.error('sendgrid_network_error', { message: err.message, to, subject });
    return false;
  }
}

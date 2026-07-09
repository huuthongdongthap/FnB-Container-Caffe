/**
 * Email Utility — SendGrid HTTP API wrapper for Cloudflare Workers
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'email.send' });

const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send';

export interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailEnv {
  SENDGRID_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
}

export async function sendEmail(env: EmailEnv, opts: SendEmailOpts): Promise<boolean> {
  const { to, subject, html, text } = opts;

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

  const payload: Record<string, unknown> = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail, name: fromName },
    subject,
    content: [{ type: 'text/html', value: html }]
  };

  if (text) {
    (payload.content as Array<Record<string, string>>).push({ type: 'text/plain', value: text });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(SENDGRID_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (response.ok) {
      log.info('email_sent', { to, subject });
      return true;
    }

    const body = await response.text();
    log.error('sendgrid_error', { status: response.status, body: body.slice(0, 200), to, subject });
    return false;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('sendgrid_network_error', { message, to, subject });
    return false;
  }
}

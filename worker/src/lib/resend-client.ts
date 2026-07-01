/**
 * Resend Email Client — Resend.com HTTP API wrapper for Cloudflare Workers
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'resend.email' });
const RESEND_API = 'https://api.resend.com/emails';

export interface ResendSendOpts {
  to: string;
  subject: string;
  html: string;
}

export interface ResendEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export interface ResendResult {
  success: boolean;
  messageId?: string;
  skipped?: boolean;
}

export async function sendEmail(env: ResendEnv, opts: ResendSendOpts): Promise<ResendResult> {
  const { to, subject, html } = opts;
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
      const data = await response.json().catch(() => ({} as Record<string, unknown>));
      log.info('email_sent', { to, subject, messageId: (data as any).id });
      return { success: true, messageId: (data as any).id as string };
    }

    const body = await response.text();
    log.error('resend_api_error', {
      status: response.status,
      body: body.slice(0, 200),
      to,
      subject,
    });
    return { success: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('resend_network_error', { message, to, subject });
    return { success: false };
  }
}

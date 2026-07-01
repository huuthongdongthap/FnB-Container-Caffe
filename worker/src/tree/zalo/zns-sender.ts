import type { D1Database } from '@cloudflare/workers-types';
import type { ZnsData, ZnsResult } from './types';
import { TEMPLATE_IDS, buildTemplateData } from './zns-templates';

const ZALO_ZNS_URL = 'https://business.openapi.zalo.me/message/template';

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/^\+?84/, '').replace(/^0/, '');
}

/**
 * Send a single ZNS message.
 * Returns { ok, channel } — never throws.
 */
export async function sendZNS(env: { ZALO_ACCESS_TOKEN?: string; AURA_DB?: D1Database }, params: { phone: string; template_key: string; data: ZnsData }): Promise<ZnsResult> {
  if (!env.ZALO_ACCESS_TOKEN) {
    return { ok: false, channel: 'zalo', reason: 'no_token' };
  }

  const template_id = TEMPLATE_IDS[params.template_key];
  if (!template_id || template_id.startsWith('YOUR_')) {
    return { ok: false, channel: 'zalo', reason: 'template_not_configured' };
  }

  const normalized = '84' + normalizePhone(params.phone);
  let status = 'failed';
  let zaloResponse: unknown = null;

  try {
    const res = await fetch(ZALO_ZNS_URL, {
      method: 'POST',
      headers: {
        'access_token': env.ZALO_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: normalized,
        template_id,
        template_data: buildTemplateData(params.template_key, params.data),
        tracking_id: `aura_${Date.now()}`,
      }),
    });

    zaloResponse = await res.json();
    status = (zaloResponse as { error: number }).error === 0 ? 'sent' : 'failed';
  } catch (err: unknown) {
    zaloResponse = { error: -1, message: err instanceof Error ? err.message : String(err) };
  }

  // Audit log — fire-and-forget, never block main flow
  if (env.AURA_DB) {
    try {
      await env.AURA_DB.prepare(
        `INSERT INTO notification_audit_log
         (channel, phone, template_key, data, status, response, created_at)
         VALUES ('zalo_zns', ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        params.phone, params.template_key,
        JSON.stringify(params.data), status,
        JSON.stringify(zaloResponse)
      ).run();
    } catch {
      /* audit failure never blocks */
    }
  }

  return { ok: status === 'sent', channel: 'zalo', result: zaloResponse };
}

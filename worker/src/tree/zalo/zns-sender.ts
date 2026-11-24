import type { D1Database } from '@cloudflare/workers-types';
import type { ZnsData, ZnsResult } from './types';
import { buildTemplateData, resolveTemplateId } from './zns-templates';

const ZALO_ZNS_URL = 'https://business.openapi.zalo.me/message/template';

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/^\+?84/, '').replace(/^0/, '');
}

export interface ZnsSenderEnv {
  ZALO_ACCESS_TOKEN?: string;
  ZALO_ZNS_TEMPLATE_GENERAL_PROMOTION?: string;
  AURA_DB?: D1Database;
}

/**
 * Send a single ZNS message.
 * Returns { ok, channel } — never throws.
 */
export async function sendZNS(
  env: ZnsSenderEnv,
  params: { phone: string; template_key: string; data: ZnsData; tenantId?: string }
): Promise<ZnsResult> {
  if (!env.ZALO_ACCESS_TOKEN) {
    return { ok: false, channel: 'zalo', reason: 'no_token' };
  }

  const template_id = resolveTemplateId(
    params.template_key,
    env as unknown as Record<string, unknown>
  );
  if (!template_id) {
    return { ok: false, channel: 'zalo', reason: 'template_not_configured' };
  }

  const normalized = `84${normalizePhone(params.phone)}`;
  let status = 'failed';
  let zaloResponse: unknown = null;

  try {
    const res = await fetch(ZALO_ZNS_URL, {
      method: 'POST',
      headers: {
        'access_token': env.ZALO_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        phone: normalized,
        template_id,
        template_data: buildTemplateData(params.template_key, params.data),
        tracking_id: `aura_${crypto.randomUUID()}`
      })
    });

    zaloResponse = await res.json();
    status = (zaloResponse as { error: number }).error === 0 ? 'sent' : 'failed';
  } catch (err: unknown) {
    zaloResponse = { error: -1, message: err instanceof Error ? err.message : String(err) };
  }

  // Audit log — fire-and-forget, never block main flow
  if (env.AURA_DB) {
    const effectiveTenant = params.tenantId && params.tenantId.trim() && params.tenantId.trim() !== '*' ? params.tenantId.trim() : '';
    const writeTenant = !effectiveTenant || effectiveTenant === '*' ? 'default' : effectiveTenant;
    try {
      try {
        await env.AURA_DB.prepare(
          `INSERT INTO notification_audit_log
           (channel, phone, template_key, data, status, response, tenant_id, created_at)
           VALUES ('zalo_zns', ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          params.phone, params.template_key,
          JSON.stringify(params.data), status,
          JSON.stringify(zaloResponse),
          writeTenant
        ).run();
      } catch {
        await env.AURA_DB.prepare(
          `INSERT INTO notification_audit_log
           (channel, phone, template_key, data, status, response, created_at)
           VALUES ('zalo_zns', ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          params.phone, params.template_key,
          JSON.stringify(params.data), status,
          JSON.stringify(zaloResponse)
        ).run();
      }
    } catch {
      /* audit failure never blocks */
    }
  }

  return { ok: status === 'sent', channel: 'zalo', result: zaloResponse };
}

/**
 * Zalo ZNS Notification Service — /api/zalo
 * Sends transactional messages via Zalo Notification Service (ZNS).
 *
 * Prerequisites:
 *   1. Zalo OA Business verified at https://oa.zalo.me
 *   2. 4 ZNS templates approved (3-7 day review)
 *   3. wrangler secret put ZALO_ACCESS_TOKEN
 *   4. Update TEMPLATE_IDS below after approval
 *
 * Until ZALO_ACCESS_TOKEN is set: all sends are no-ops (logged, never throw).
 */

import type { D1Database } from '@cloudflare/workers-types';
import { sendZNS } from '../tree/zalo/zns-sender';
import { notifyMember } from '../tree/zalo/notify-member';
import { zaloSendSchema } from '../lib/validators';

export { sendZNS } from '../tree/zalo/zns-sender';
export { notifyMember } from '../tree/zalo/notify-member';

interface ZaloEnv {
  ZALO_ACCESS_TOKEN?: string;
  AURA_DB?: D1Database;
}

// ── Router handler for /api/zalo webhooks ──

export async function handleZaloRequest(request: Request, env: ZaloEnv, resolvedTenantId?: string): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/zalo', '');
  const method = request.method;
  const rawResolved = typeof resolvedTenantId === 'string' ? resolvedTenantId.trim() : '';
  const effectiveTenantId = rawResolved
    ? (rawResolved.toLowerCase() === 'hq' ? '*' : rawResolved)
    : 'default';

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  const requestTenantCandidates = [
    request.headers.get('X-Tenant-ID'),
    request.headers.get('x-tenant-id'),
    request.headers.get('X-Store-ID'),
    request.headers.get('x-store-id'),
    url.searchParams.get('tenant_id'),
    url.searchParams.get('tenantId'),
    url.searchParams.get('store_id'),
    url.searchParams.get('storeId'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(requestTenantCandidates).size > 1) {
    return json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  if (rawResolved && effectiveTenantId !== '*' && requestTenantCandidates.length > 0) {
    const reqOverride = requestTenantCandidates[0].toLowerCase() === 'hq' ? '*' : requestTenantCandidates[0];
    if (reqOverride !== effectiveTenantId) {
      return json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
  }

  // POST /api/zalo/send — manual send endpoint
  if (method === 'POST' && path === '/send') {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400);
    }
    const parsed = zaloSendSchema.safeParse(raw);
    if (!parsed.success) {
      return json({ success: false, error: parsed.error.issues[0].message }, 400);
    }
    const { phone, customer_id, template_key, data } = parsed.data;

    if (customer_id) {
      const result = await notifyMember(env, {
        customer_id,
        template_key,
        data,
        tenantId: effectiveTenantId
      });
      return json({ success: result.ok, data: result });
    }

    if (phone) {
      let targetTenant = effectiveTenantId === '*' ? 'default' : effectiveTenantId;
      if (effectiveTenantId === '*' && env.AURA_DB) {
        try {
          const matched = await env.AURA_DB
            .prepare(
              "SELECT COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') as tenant_id FROM customers WHERE phone = ? OR zalo = ? ORDER BY created_at DESC LIMIT 5"
            )
            .bind(phone, phone)
            .all<{ tenant_id?: string | null }>();
          const distinctTenants = Array.from(
            new Set(
              (matched.results || [])
                .map((r) => (typeof r.tenant_id === 'string' ? r.tenant_id.trim() : ''))
                .filter((t) => Boolean(t && t !== '*' && t.toLowerCase() !== 'hq'))
            )
          );
          if (distinctTenants.length > 1) {
            return json(
              { success: false, error: 'Ambiguous phone tenant across stores; specify tenant_id or customer_id' },
              400
            );
          }
          if (distinctTenants.length === 1) {
            targetTenant = distinctTenants[0];
          }
        } catch {
          try {
            const row = await env.AURA_DB
              .prepare('SELECT tenant_id FROM customers WHERE phone = ? LIMIT 1')
              .bind(phone)
              .first<{ tenant_id?: string | null }>();
            const rowTenant = typeof row?.tenant_id === 'string' ? row.tenant_id.trim() : '';
            if (rowTenant && rowTenant !== '*' && rowTenant.toLowerCase() !== 'hq') {
              targetTenant = rowTenant;
            }
          } catch {
            // Fall back to default when legacy schema lacks tenant_id
          }
        }
      }
      const result = await sendZNS(env, {
        phone,
        template_key,
        data,
        tenantId: targetTenant
      });
      return json({ success: result.ok, data: result });
    }

    return json({ success: false, error: 'phone or customer_id required' }, 400);
  }

  return json({ success: false, error: 'Not found' }, 404);
}

/**
 * Orders — Get latest order timestamp handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';

const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function resolveLatestTenantId(request: Request): string {
  const headerTenant = (
    request.headers.get('X-Tenant-ID') ||
    request.headers.get('x-tenant-id') ||
    request.headers.get('X-Store-ID') ||
    request.headers.get('x-store-id') ||
    ''
  ).trim();
  let queryTenant = '';
  try {
    const u = new URL(request.url, 'http://localhost');
    queryTenant = (
      u.searchParams.get('tenant_id') ||
      u.searchParams.get('tenantId') ||
      u.searchParams.get('store_id') ||
      u.searchParams.get('storeId') ||
      ''
    ).trim();
  } catch {
    // Ignore invalid URL
  }
  const candidate = headerTenant || queryTenant;
  if (candidate && candidate !== '*' && candidate.toLowerCase() !== 'hq' && TENANT_ID_PATTERN.test(candidate)) {
    return candidate;
  }
  return 'default';
}

export async function getLatestOrderTimestamp(request: Request, env: Record<string, unknown>) {
  try {
    const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const tenantId = resolveLatestTenantId(request);
    let ts: string | null = null;
    if (kv) {
      if (tenantId !== 'default') {
        ts = await kv.get(`latest_order_ts:${tenantId}`);
      } else {
        ts = (await kv.get('latest_order_ts:default')) ?? (await kv.get('latest_order_ts'));
      }
    }
    return jsonResponse({ success: true, ts });
  } catch {
    return errorResponse('Failed to get latest timestamp', 500);
  }
}

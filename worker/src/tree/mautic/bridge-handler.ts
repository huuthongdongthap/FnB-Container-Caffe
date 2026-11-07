/**
 * Mautic Bridge — Route handler
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { getSyncStatus } from './sync-state';
import { syncContacts } from './contact-sync';
import { enrollCampaigns } from './campaign-enrollment';
import type { MauticBridgeEnv } from './types';

export async function handleMauticBridgeRequest(
  request: Request,
  env: MauticBridgeEnv,
  resolvedTenantId?: string
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/mautic-bridge', '');
  const method = request.method;
  const rawTenantHeader = (
    request.headers.get('X-Tenant-ID') ||
    request.headers.get('x-tenant-id') ||
    request.headers.get('X-Store-ID') ||
    request.headers.get('x-store-id') ||
    ''
  ).trim();
  const rawTenantQuery = (
    url.searchParams.get('tenant_id') ||
    url.searchParams.get('tenantId') ||
    url.searchParams.get('store_id') ||
    url.searchParams.get('storeId') ||
    ''
  ).trim();
  const requestedOverride = rawTenantQuery || rawTenantHeader;

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  const rawResolved = resolvedTenantId ? resolvedTenantId.trim() : '';
  const normalizedResolved = rawResolved.toLowerCase() === 'hq' ? '*' : rawResolved;
  if (requestedOverride && requestedOverride !== '*' && !/^[a-zA-Z0-9_-]{1,64}$/.test(requestedOverride)) {
    return json({ success: false, error: 'Invalid tenant identifier' }, 400);
  }
  const normalizedOverride = requestedOverride.toLowerCase() === 'hq' ? '*' : requestedOverride;
  if (normalizedOverride === '*' && normalizedResolved !== '*') {
    return json({ success: false, error: 'Wildcard tenant override denied' }, 403);
  }
  if (
    normalizedResolved &&
    normalizedResolved !== '*' &&
    normalizedOverride &&
    normalizedOverride !== normalizedResolved
  ) {
    return json({ success: false, error: 'Cross-tenant Mautic sync denied' }, 403);
  }

  const safeOverrideTenant = normalizedOverride && normalizedOverride !== '*' ? normalizedOverride : undefined;
  const tenantId = normalizedResolved && normalizedResolved !== '*'
    ? normalizedResolved
    : safeOverrideTenant || (normalizedResolved === '*' ? '*' : undefined);
  const hasExplicitTenant = Boolean(tenantId);

  if (method === 'GET' && path === '/status') {
    return json({ success: true, data: getSyncStatus(tenantId) });
  }

  if (method === 'POST' && path === '/sync-contacts') {
    return json(hasExplicitTenant ? await syncContacts(env, tenantId) : await syncContacts(env));
  }

  if (method === 'POST' && path === '/campaign-enroll') {
    return json(hasExplicitTenant ? await enrollCampaigns(env, tenantId) : await enrollCampaigns(env));
  }

  if (method === 'POST' && path === '/sync-all') {
    const contacts = hasExplicitTenant ? await syncContacts(env, tenantId) : await syncContacts(env);
    const campaigns = hasExplicitTenant ? await enrollCampaigns(env, tenantId) : await enrollCampaigns(env);
    return json({ success: true, data: { contacts, campaigns } });
  }

  return json({ success: false, error: 'Not found' }, 404);
}

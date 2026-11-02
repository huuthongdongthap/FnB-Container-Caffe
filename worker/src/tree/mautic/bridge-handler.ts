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
  const rawTenantHeader = (request.headers.get('X-Tenant-ID') || request.headers.get('x-tenant-id') || '').trim();
  const tenantId = resolvedTenantId ?? (rawTenantHeader && rawTenantHeader !== '*' ? rawTenantHeader : undefined);
  const hasScopedTenant = Boolean(tenantId && tenantId !== '*');

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  if (method === 'GET' && path === '/status') {
    return json({ success: true, data: getSyncStatus(tenantId) });
  }

  if (method === 'POST' && path === '/sync-contacts') {
    return json(hasScopedTenant ? await syncContacts(env, tenantId) : await syncContacts(env));
  }

  if (method === 'POST' && path === '/campaign-enroll') {
    return json(hasScopedTenant ? await enrollCampaigns(env, tenantId) : await enrollCampaigns(env));
  }

  if (method === 'POST' && path === '/sync-all') {
    const contacts = hasScopedTenant ? await syncContacts(env, tenantId) : await syncContacts(env);
    const campaigns = hasScopedTenant ? await enrollCampaigns(env, tenantId) : await enrollCampaigns(env);
    return json({ success: true, data: { contacts, campaigns } });
  }

  return json({ success: false, error: 'Not found' }, 404);
}

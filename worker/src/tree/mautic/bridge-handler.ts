/**
 * Mautic Bridge — Route handler
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { syncStatus } from './sync-state';
import { syncContacts } from './contact-sync';
import { enrollCampaigns } from './campaign-enrollment';
import type { MauticBridgeEnv } from './types';

export async function handleMauticBridgeRequest(request: Request, env: MauticBridgeEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/mautic-bridge', '');
  const method = request.method;

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  if (method === 'GET' && path === '/status') {
    return json({ success: true, data: syncStatus });
  }

  if (method === 'POST' && path === '/sync-contacts') {
    return json(await syncContacts(env));
  }

  if (method === 'POST' && path === '/campaign-enroll') {
    return json(await enrollCampaigns(env));
  }

  if (method === 'POST' && path === '/sync-all') {
    const contacts = await syncContacts(env);
    const campaigns = await enrollCampaigns(env);
    return json({ success: true, data: { contacts, campaigns } });
  }

  return json({ success: false, error: 'Not found' }, 404);
}

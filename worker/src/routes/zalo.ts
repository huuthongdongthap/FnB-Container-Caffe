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
import type { ZnsData } from '../tree/zalo/types';
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

export async function handleZaloRequest(request: Request, env: ZaloEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/zalo', '');
  const method = request.method;

  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  // POST /api/zalo/send — manual send endpoint
  if (method === 'POST' && path === '/send') {
    const raw = await request.json();
    const parsed = zaloSendSchema.safeParse(raw);
    if (!parsed.success) {
      return json({ success: false, error: parsed.error.issues[0].message }, 400);
    }
    const { phone, customer_id, template_key, data } = parsed.data;

    if (customer_id) {
      const result = await notifyMember(env, {
        customer_id,
        template_key,
        data
      });
      return json({ success: result.ok, data: result });
    }

    if (phone) {
      const result = await sendZNS(env, {
        phone,
        template_key,
        data
      });
      return json({ success: result.ok, data: result });
    }

    return json({ success: false, error: 'phone or customer_id required' }, 400);
  }

  return json({ success: false, error: 'Not found' }, 404);
}

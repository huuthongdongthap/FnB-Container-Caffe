import webpush from 'web-push';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'push' });

export interface PushEnv {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_EMAIL?: string;
  AURA_DB: import('@cloudflare/workers-types').D1Database;
}

interface Subscription {
  id: string;
  endpoint: string;
  auth_key: string;
  p256dh_key: string;
  customer_id: string | null;
  role: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

export function initPush(env: PushEnv): void {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const email = env.VAPID_EMAIL || 'mailto:admin@auraspace.vn';

  if (publicKey && privateKey) {
    webpush.setVapidDetails(email, publicKey, privateKey);
  }
}

export async function sendPushToCustomer(
  env: PushEnv,
  customerId: string | null,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    log.warn('VAPID keys not configured');
    return { sent: 0, failed: 0 };
  }

  initPush(env);

  // Get subscriptions for this customer
  let subscriptions: Subscription[];
  if (customerId) {
    const { results } = await env.AURA_DB.prepare(
      'SELECT id, endpoint, auth_key, p256dh_key, customer_id, role FROM push_subscriptions WHERE customer_id = ?'
    ).bind(customerId).all<Subscription>();
    subscriptions = results || [];
  } else {
    // Broadcast to all
    const { results } = await env.AURA_DB.prepare(
      'SELECT id, endpoint, auth_key, p256dh_key, customer_id, role FROM push_subscriptions'
    ).all<Subscription>();
    subscriptions = results || [];
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth_key,
            p256dh: sub.p256dh_key
          }
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err: unknown) {
      // 410 Gone = subscription expired, remove it
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await env.AURA_DB.prepare(
          'DELETE FROM push_subscriptions WHERE endpoint = ?'
        ).bind(sub.endpoint).run();
        log.info('Removed expired subscription', { endpoint: sub.endpoint.slice(0, 30) });
      } else {
        log.error('Push send failed', { endpoint: sub.endpoint.slice(0, 30), error: (err as Error).message });
      }
      failed++;
    }
  }

  return { sent, failed };
}

export async function sendPushToStaff(
  env: PushEnv,
  payload: PushPayload,
  role: string = '',
  excludeCustomerIds?: string[]
): Promise<{ sent: number; failed: number }> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    log.warn('VAPID keys not configured');
    return { sent: 0, failed: 0 };
  }

  initPush(env);

  // Build query: all non-customer roles, or specific role
  let query = 'SELECT id, endpoint, auth_key, p256dh_key, customer_id, role FROM push_subscriptions WHERE role != \'customer\'';
  const params: unknown[] = [];

  if (role) {
    query += ' AND role = ?';
    params.push(role);
  }

  const { results } = await env.AURA_DB.prepare(query).bind(...params).all<Subscription>();
  let subscriptions: Subscription[] = results || [];

  // Exclude specific customer_ids if provided
  if (excludeCustomerIds && excludeCustomerIds.length > 0) {
    subscriptions = subscriptions.filter(s => !s.customer_id || !excludeCustomerIds.includes(s.customer_id));
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth_key,
            p256dh: sub.p256dh_key
          }
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await env.AURA_DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
        log.info('Removed expired subscription', { endpoint: sub.endpoint.slice(0, 30) });
      } else {
        log.error('Staff push send failed', { endpoint: sub.endpoint.slice(0, 30), error: (err as Error).message });
      }
      failed++;
    }
  }

  return { sent, failed };
}

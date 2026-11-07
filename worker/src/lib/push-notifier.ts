import { createLogger } from '../middleware/logger';
import { sendPushToCustomer as treeSendPushToCustomer } from '../tree/push/notifier';

const log = createLogger({ route: 'push-notifier-mobile' });

export type PushPayload = {
  title_vi: string;
  title_en: string;
  body_vi?: string;
  body_en?: string;
  data?: Record<string, unknown>;
  tag?: string;
  requireInteraction?: boolean;
};

type PushEnv = Readonly<{
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_EMAIL?: string;
  AURA_DB: import('@cloudflare/workers-types').D1Database;
}>;

export async function sendPushToUser(
  env: PushEnv,
  userId: string,
  payload: PushPayload,
  tenantId?: string,
): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    log.warn('vapid_keys_missing', { route: 'sendPushToUser' });
    return 0;
  }

  const normTenant = typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : undefined;
  let results: Array<{ endpoint: string; auth_key: string; p256dh_key: string }> | undefined;
  if (normTenant && normTenant !== '*') {
    try {
      const res = await env.AURA_DB
        .prepare(
          `SELECT endpoint, auth_key, p256dh_key
           FROM push_subscriptions
           WHERE user_id = ?
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
        )
        .bind(userId, normTenant)
        .all<{ endpoint: string; auth_key: string; p256dh_key: string }>();
      results = res.results;
    } catch {
      if (normTenant === 'default') {
        const res = await env.AURA_DB
          .prepare(
            `SELECT endpoint, auth_key, p256dh_key
             FROM push_subscriptions
             WHERE user_id = ?`
          )
          .bind(userId)
          .all<{ endpoint: string; auth_key: string; p256dh_key: string }>();
        results = res.results;
      } else {
        results = [];
      }
    }
  } else {
    const res = await env.AURA_DB
      .prepare(
        `SELECT endpoint, auth_key, p256dh_key
         FROM push_subscriptions
         WHERE user_id = ?`
      )
      .bind(userId)
      .all<{ endpoint: string; auth_key: string; p256dh_key: string }>();
    results = res.results;
  }

  const subs = results ?? [];
  let sent = 0;

  for (const sub of subs) {
    try {
      const customerPayload = {
        title: payload.title_vi ?? payload.title_en,
        body: payload.body_vi ?? payload.body_en ?? '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        data: payload.data,
      };
      if (normTenant) {
        await treeSendPushToCustomer(
          env as Parameters<typeof treeSendPushToCustomer>[0],
          userId,
          customerPayload,
          normTenant
        );
      } else {
        await treeSendPushToCustomer(
          env as Parameters<typeof treeSendPushToCustomer>[0],
          userId,
          customerPayload
        );
      }
      sent++;
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode
          : null;

      if (status === 410 || status === 404) {
        if (normTenant && normTenant !== '*') {
          await env.AURA_DB
            .prepare(
              "DELETE FROM push_subscriptions WHERE endpoint = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            )
            .bind(sub.endpoint, normTenant)
            .run()
            .catch(async () => {
              if (normTenant === 'default') {
                await env.AURA_DB
                  .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
                  .bind(sub.endpoint)
                  .run();
              }
            });
        } else {
          await env.AURA_DB
            .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
            .bind(sub.endpoint)
            .run();
        }
        log.info('stale_subscription_removed', {
          endpoint: sub.endpoint.slice(0, 40),
        });
      } else {
        log.error('push_send_failed', {
          endpoint: sub.endpoint.slice(0, 40),
          status,
        });
      }
    }
  }

  return sent;
}

export async function sendPushToRole(
  env: PushEnv,
  role: string,
  payload: PushPayload,
  tenantId?: string,
): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    log.warn('vapid_keys_missing', { route: 'sendPushToRole' });
    return 0;
  }

  const normTenant = typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : undefined;
  const { sendPushToStaff } = await import('../tree/push/notifier.js');
  const mappedPayload: Parameters<typeof sendPushToStaff>[1] = {
    title: payload.title_vi || payload.title_en,
    body: payload.body_vi || payload.body_en || '',
    data: payload.data,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
  };
  const res = normTenant
    ? await sendPushToStaff(
        env as Parameters<typeof sendPushToStaff>[0],
        mappedPayload,
        role,
        undefined,
        normTenant
      )
    : await sendPushToStaff(
        env as Parameters<typeof sendPushToStaff>[0],
        mappedPayload,
        role
      );
  return res.sent;
}

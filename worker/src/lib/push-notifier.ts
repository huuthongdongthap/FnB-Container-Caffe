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

/**
 * Send a Web Push notification to every subscription row for a given user id.
 * Delegates to the existing tree notifier which uses `web-push` (correct crypto).
 * Returns the number of subscriptions we attempted — stale ones will have been
 * deleted by the tree notifier on 410 Gone/404.
 */
export async function sendPushToUser(
  env: PushEnv,
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    log.warn('vapid_keys_missing', { route: 'sendPushToUser' });
    return 0;
  }

  // The tree notifier's sendPushToCustomer(env, customerId | null, payload)
  // accepts `null` for broadcast; we scope it to the user by post-filtering
  // on its push_subscriptions query. To keep behavior correct with the schema
  // in 20260706_11_push_staff.sql (role + customer_id columns), we reuse the
  // raw role-based blast but only rows whose user_id matches. We do that by
  // calling the tree notifier with a role filter.
  //
  // Since the tree notifier only supports role-based blast, the simplest
  // reliable path is to call the DB directly and use the tree notifier's
  // lower-level `webpush` machinery. Avoid reimplementing VAPID signing by
  // importing `web-push` here and mirroring the same pattern.
  const { results } = await env.AURA_DB
    .prepare(
      `SELECT endpoint, auth_key, p256dh_key
         FROM push_subscriptions
        WHERE user_id = ?`
    )
    .bind(userId)
    .all<{ endpoint: string; auth_key: string; p256dh_key: string }>();

  const subs = results ?? [];
  let sent = 0;

  for (const sub of subs) {
    try {
      await treeSendPushToCustomer(
        env as Parameters<typeof treeSendPushToCustomer>[0],
        userId,
        {
          ...payload,
          // Map the vi/en slugs onto the tree payload shape
          title: (payload.title_vi ?? payload.title_en) as string,
          body: (payload.body_vi ?? payload.body_en ?? '') as string,
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          tag: payload.tag,
          data: payload.data,
        }
      );
      sent++;
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode
          : null;

      if (status === 410 || status === 404) {
        await env.AURA_DB
          .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
          .bind(sub.endpoint)
          .run();
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

/**
 * Kept for compatibility — pushes to all staff subscribers (role-based).
 */
export async function sendPushToRole(
  env: PushEnv,
  role: string,
  payload: PushPayload
): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    log.warn('vapid_keys_missing', { route: 'sendPushToRole' });
    return 0;
  }

  // We don't have a direct equivalent in the tree notifier that takes a role
  // and pages all of them without customer_id, but its `sendPushToStaff`
  // does exactly this. Use it.
  const { sendPushToStaff } = await import('../tree/push/notifier.js');
  const res = await sendPushToStaff(env as Parameters<typeof sendPushToStaff>[0], payload, role);
  return res.sent;
}

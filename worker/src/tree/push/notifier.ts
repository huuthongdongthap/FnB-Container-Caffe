import webpush from 'web-push';
import { createLogger } from '../../middleware/logger';
import { matchesTenantRow, resolvePilotStore } from '../../middleware/tenant';
import { CUSTOMER_PUSH_ROLE, STAFF_PUSH_ROLE } from './roles';

const log = createLogger({ route: 'push' });

export interface PushEnv {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_EMAIL?: string;
  PILOT_STORE?: string;
  AUTH_KV?: import('@cloudflare/workers-types').KVNamespace;
  AURA_DB: import('@cloudflare/workers-types').D1Database;
}

const KITCHEN_EXTRA_ROLES = ['kitchen', 'bep', 'barista', 'chef', 'staff', 'cashier'] as const;

async function isStaffPreferenceEnabled(
  env: PushEnv,
  effectiveTenant: string,
  staffId: string | null | undefined,
  prefKey: 'orderAlertsEnabled' | 'shiftRemindersEnabled'
): Promise<boolean> {
  if (!env.AUTH_KV || !staffId || !String(staffId).trim()) return true;
  const cleanId = String(staffId).trim();
  try {
    const scopedKey = `config:staff_notification_settings:${effectiveTenant}:${cleanId}`;
    const raw =
      (await env.AUTH_KV.get(scopedKey)) ??
      (effectiveTenant === 'default' ? await env.AUTH_KV.get(`config:staff_notification_settings:${cleanId}`) : null);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed[prefKey] === 'boolean') {
      return parsed[prefKey] as boolean;
    }
  } catch {
    // Fail open on corrupt settings JSON
  }
  return true;
}

async function isSoundAlertsEnabled(env: PushEnv, effectiveTenant: string): Promise<boolean> {
  if (!env.AUTH_KV) return false;
  try {
    const tenantKey = `config:notification_settings:${effectiveTenant}`;
    const raw =
      (await env.AUTH_KV.get(tenantKey)) ??
      (effectiveTenant === 'default' ? await env.AUTH_KV.get('config:notification_settings') : null);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { soundAlerts?: unknown };
    return Boolean(parsed.soundAlerts);
  } catch {
    return false;
  }
}

async function isAutoNotifyNewOrderEnabled(env: PushEnv, effectiveTenant: string): Promise<boolean> {
  if (!env.AUTH_KV) return true;
  try {
    const tenantKey = `config:notification_settings:${effectiveTenant}`;
    const raw =
      (await env.AUTH_KV.get(tenantKey)) ??
      (effectiveTenant === 'default' ? await env.AUTH_KV.get('config:notification_settings') : null);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { autoNotifyNewOrder?: unknown };
    if (typeof parsed.autoNotifyNewOrder === 'boolean') {
      return parsed.autoNotifyNewOrder;
    }
  } catch {
    // Fail open on corrupt settings JSON so orders are not silently dropped
  }
  return true;
}

interface Subscription {
  id: string;
  endpoint: string;
  auth_key: string;
  p256dh_key: string;
  customer_id: string | null;
  role: string;
  tenant_id?: string | null;
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
  payload: PushPayload,
  tenantId?: string
): Promise<{ sent: number; failed: number }> {
  if (customerId !== null && customerId !== undefined && !String(customerId).trim()) {
    return { sent: 0, failed: 0 };
  }
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    log.warn('VAPID keys not configured');
    return { sent: 0, failed: 0 };
  }

  initPush(env);
  const effectiveTenant = tenantId || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);

  // Get subscriptions for this customer
  let subscriptions: Subscription[];
  if (customerId !== null && customerId !== undefined) {
    const cleanCustomerId = String(customerId).trim();
    if (effectiveTenant && effectiveTenant !== '*') {
      try {
        const { results } = await env.AURA_DB.prepare(
          "SELECT id, endpoint, auth_key, p256dh_key, customer_id, role, tenant_id FROM push_subscriptions WHERE customer_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(cleanCustomerId, effectiveTenant).all<Subscription>();
        subscriptions = results || [];
      } catch {
        if (effectiveTenant === 'default') {
          const { results } = await env.AURA_DB.prepare(
            'SELECT id, endpoint, auth_key, p256dh_key, customer_id, role FROM push_subscriptions WHERE customer_id = ?'
          ).bind(cleanCustomerId).all<Subscription>();
          subscriptions = results || [];
        } else {
          subscriptions = [];
        }
      }
    } else {
      const { results } = await env.AURA_DB.prepare(
        'SELECT id, endpoint, auth_key, p256dh_key, customer_id, role FROM push_subscriptions WHERE customer_id = ?'
      ).bind(cleanCustomerId).all<Subscription>();
      subscriptions = results || [];
    }
  } else {
    // Broadcast to all
    if (effectiveTenant && effectiveTenant !== '*') {
      try {
        const { results } = await env.AURA_DB.prepare(
          "SELECT id, endpoint, auth_key, p256dh_key, customer_id, role, tenant_id FROM push_subscriptions WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(effectiveTenant).all<Subscription>();
        subscriptions = results || [];
      } catch {
        if (effectiveTenant === 'default') {
          const { results } = await env.AURA_DB.prepare(
            'SELECT id, endpoint, auth_key, p256dh_key, customer_id, role FROM push_subscriptions'
          ).all<Subscription>();
          subscriptions = results || [];
        } else {
          subscriptions = [];
        }
      }
    } else {
      const { results } = await env.AURA_DB.prepare(
        'SELECT id, endpoint, auth_key, p256dh_key, customer_id, role FROM push_subscriptions'
      ).all<Subscription>();
      subscriptions = results || [];
    }
  }
  subscriptions = subscriptions.filter(
    s =>
      s.endpoint &&
      !s.endpoint.startsWith('https://manual.auraspace.local/') &&
      (!customerId ? !s.role || s.role === 'customer' : true) &&
      matchesTenantRow(s, effectiveTenant)
  );

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
        if (effectiveTenant && effectiveTenant !== '*') {
          await env.AURA_DB.prepare(
            "DELETE FROM push_subscriptions WHERE endpoint = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(sub.endpoint, effectiveTenant).run().catch(async () => {
            if (effectiveTenant === 'default') {
              await env.AURA_DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
            }
          });
        } else {
          await env.AURA_DB.prepare(
            'DELETE FROM push_subscriptions WHERE endpoint = ?'
          ).bind(sub.endpoint).run();
        }
        log.info('Removed expired subscription', { endpoint: sub.endpoint.slice(0, 30) });
      } else {
        log.error('Push send failed', { endpoint: sub.endpoint.slice(0, 30), error: (err as Error).message });
      }
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Send a new-order/staff announcement.
 *
 * `role` is an exact-match role literal, so the value has to come from the
 * same vocabulary the subscribe path writes (see ./roles). An empty string
 * means "every non-customer subscription" and is the broadcast path.
 */
export async function sendPushToStaff(
  env: PushEnv,
  payload: PushPayload,
  role: string = '',
  excludeCustomerIds?: string[],
  tenantId?: string
): Promise<{ sent: number; failed: number }> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    log.warn('VAPID keys not configured');
    return { sent: 0, failed: 0 };
  }

  initPush(env);
  const effectiveTenant = tenantId || resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);

  if (role === STAFF_PUSH_ROLE && payload.data?.type === 'new_order') {
    const enabled = await isAutoNotifyNewOrderEnabled(env, effectiveTenant);
    if (!enabled) {
      log.info('Auto new-order push disabled by admin notification settings', { tenantId: effectiveTenant });
      return { sent: 0, failed: 0 };
    }
  }

  // Build query: all non-customer roles, or specific role (expanding STAFF_PUSH_ROLE to kitchen-capable roles)
  let query = `SELECT id, endpoint, auth_key, p256dh_key, customer_id, role FROM push_subscriptions WHERE role != ?`;
  const params: unknown[] = [CUSTOMER_PUSH_ROLE];

  if (role === STAFF_PUSH_ROLE) {
    const placeholders = KITCHEN_EXTRA_ROLES.map(() => '?').join(', ');
    query += ` AND (role = ? OR role IN (${placeholders}))`;
    params.push(STAFF_PUSH_ROLE, ...KITCHEN_EXTRA_ROLES);
  } else if (role) {
    query += ' AND role = ?';
    params.push(role);
  }

  let subscriptions: Subscription[] = [];
  if (effectiveTenant && effectiveTenant !== '*') {
    try {
      const tenantQuery = `${query.replace('SELECT id, endpoint, auth_key, p256dh_key, customer_id, role', 'SELECT id, endpoint, auth_key, p256dh_key, customer_id, role, tenant_id')} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`;
      const { results } = await env.AURA_DB.prepare(tenantQuery).bind(...params, effectiveTenant).all<Subscription>();
      subscriptions = results || [];
    } catch {
      if (effectiveTenant === 'default') {
        const { results } = await env.AURA_DB.prepare(query).bind(...params).all<Subscription>();
        subscriptions = results || [];
      } else {
        subscriptions = [];
      }
    }
  } else {
    const { results } = await env.AURA_DB.prepare(query).bind(...params).all<Subscription>();
    subscriptions = results || [];
  }
  subscriptions = subscriptions.filter(s => matchesTenantRow(s, effectiveTenant));

  // Exclude manual placeholder entries that have not yet paired a browser WebPush endpoint
  subscriptions = subscriptions.filter(s => s.endpoint && !s.endpoint.startsWith('https://manual.auraspace.local/'));

  // Exclude specific customer_ids if provided
  if (excludeCustomerIds && excludeCustomerIds.length > 0) {
    subscriptions = subscriptions.filter(s => !s.customer_id || !excludeCustomerIds.includes(s.customer_id));
  }

  const eventType = typeof payload.data?.type === 'string' ? payload.data.type : '';
  const isOrderAlert = eventType === 'new_order' || role === STAFF_PUSH_ROLE;
  const isShiftReminder = eventType === 'shift_reminder' || eventType === 'shift';

  if (env.AUTH_KV && (isOrderAlert || isShiftReminder)) {
    const prefKey = isShiftReminder ? 'shiftRemindersEnabled' : 'orderAlertsEnabled';
    const filteredSubs: Subscription[] = [];
    for (const sub of subscriptions) {
      const allowed = await isStaffPreferenceEnabled(env, effectiveTenant, sub.customer_id, prefKey);
      if (allowed) {
        filteredSubs.push(sub);
      }
    }
    subscriptions = filteredSubs;
  }

  const soundAlerts = await isSoundAlertsEnabled(env, effectiveTenant);
  const enrichedPayload: PushPayload = {
    ...payload,
    data: {
      ...(payload.data || {}),
      soundAlerts,
    },
  };

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
        JSON.stringify(enrichedPayload)
      );
      sent++;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        if (effectiveTenant && effectiveTenant !== '*') {
          await env.AURA_DB.prepare(
            "DELETE FROM push_subscriptions WHERE endpoint = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(sub.endpoint, effectiveTenant).run().catch(async () => {
            if (effectiveTenant === 'default') {
              await env.AURA_DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
            }
          });
        } else {
          await env.AURA_DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
        }
        log.info('Removed expired subscription', { endpoint: sub.endpoint.slice(0, 30) });
      } else {
        log.error('Staff push send failed', { endpoint: sub.endpoint.slice(0, 30), error: (err as Error).message });
      }
      failed++;
    }
  }

  return { sent, failed };
}

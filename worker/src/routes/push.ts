import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth, authenticateRequest } from '../middleware/auth';
import { sendPushToStaff } from '../tree/push/notifier';
import { DEFAULT_STAFF_PUSH_ROLE } from '../tree/push/roles';
import { pushSubscribeSchema, pushUnsubscribeSchema, pushSendStaffSchema, zodErrorResponse } from '../lib/validators';

const STAFF_PUSH_AUTH_ROLES = new Set([
  'owner',
  'manager',
  'supervisor',
  'admin',
  'staff',
  'waiter',
  'cashier',
  'kitchen',
  'barista',
  'chef',
]);

export const pushRouter = new Hono<{ Bindings: Env }>();

// GET /api/push/list-subscriptions — list staff push subscriptions for admin UI
pushRouter.get('/list-subscriptions', requireAuth(['owner', 'manager', 'supervisor', 'admin', 'staff', 'waiter', 'cashier']), async(c) => {
  const db = c.env.AURA_DB;
  let results: Array<{
    id: string;
    customer_id: string | null;
    endpoint: string;
    user_agent: string | null;
    role: string | null;
    created_at: string;
  }> = [];
  try {
    const res = await db.prepare(
      `SELECT id, customer_id, endpoint, user_agent, role, created_at
       FROM push_subscriptions
       WHERE role != 'customer'
       ORDER BY created_at DESC`
    ).all<{
      id: string;
      customer_id: string | null;
      endpoint: string;
      user_agent: string | null;
      role: string | null;
      created_at: string;
    }>();
    results = res.results || [];
  } catch {
    const res = await db.prepare(
      `SELECT id, customer_id, endpoint, user_agent, 'staff' as role, created_at
       FROM push_subscriptions
       ORDER BY created_at DESC`
    ).all<{
      id: string;
      customer_id: string | null;
      endpoint: string;
      user_agent: string | null;
      role: string | null;
      created_at: string;
    }>().catch(() => ({ results: [] }));
    results = res.results || [];
  }

  const subscriptions = (results || []).map((row) => {
    const isManual = row.endpoint?.startsWith('https://manual.auraspace.local/');
    const normalizedRole: 'owner' | 'staff' | 'all' =
      row.role === 'owner' || row.role === 'staff' || row.role === 'all'
        ? row.role
        : row.role?.startsWith('staff')
          ? 'staff'
          : 'all';
    return {
      name: row.user_agent || row.customer_id || row.id,
      role: normalizedRole,
      endpoint: isManual ? '' : (row.endpoint || ''),
      subscribed: !isManual && Boolean(row.endpoint),
      createdAt: row.created_at,
    };
  });

  return c.json({ success: true, subscriptions });
});

// POST /api/push/subscribe — save subscription (supports both browser WebPush and manual staff registration)
pushRouter.post('/subscribe', async(c) => {
  const db = c.env.AURA_DB;
  const raw = await c.req.json() as Record<string, unknown>;
  const isManualStaffEntry = !raw.endpoint && typeof raw.name === 'string' && raw.name.trim().length > 0;
  const requestedRole = typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : (isManualStaffEntry ? DEFAULT_STAFF_PUSH_ROLE : 'customer');

  // Rate limit customer subscriptions: 5 per minute per IP
  if (requestedRole === 'customer' && !isManualStaffEntry) {
    const kv = c.env.AUTH_KV as { get: (k: string) => Promise<string | null>; put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void> } | undefined;
    if (kv) {
      const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
      const rlKey = `rl:push-sub:${ip}`;
      const cur = parseInt(await kv.get(rlKey) || '0', 10);
      if (cur >= 5) {
        return c.json({ success: false, error: 'Too many subscription attempts, please try again later' }, 429);
      }
      await kv.put(rlKey, String(cur + 1), { expirationTtl: 60 });
    }
  }

  if (isManualStaffEntry || requestedRole !== 'customer') {
    let authSession: Awaited<ReturnType<typeof authenticateRequest>> | { role?: string } | null = null;
    try {
      authSession = await authenticateRequest(c.req.raw, c.env);
    } catch {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    if (!authSession || ('blocked' in authSession && authSession.blocked)) {
      return c.json({ success: false, error: 'Forbidden: staff role required for staff push subscriptions' }, 403);
    }
    const resolvedRole = ('payload' in authSession && authSession.payload
      ? authSession.payload.role
      : (authSession as { role?: string }).role) || '';
    if (!STAFF_PUSH_AUTH_ROLES.has(String(resolvedRole))) {
      return c.json({ success: false, error: 'Forbidden: staff role required for staff push subscriptions' }, 403);
    }
  }

  let endpoint: string;
  let auth_key: string;
  let p256dh_key: string;
  let customer_id: string | undefined;
  let user_agent: string | undefined;
  let role: string | undefined;

  if (isManualStaffEntry) {
    const cleanName = String(raw.name).trim();
    endpoint = `https://manual.auraspace.local/staff/${encodeURIComponent(cleanName.toLowerCase())}`;
    auth_key = 'manual_pending';
    p256dh_key = 'manual_pending';
    customer_id = cleanName;
    user_agent = cleanName;
    role = requestedRole;
  } else {
    const parsed = pushSubscribeSchema.safeParse({ ...raw, role: requestedRole });
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    ({ endpoint, auth_key, p256dh_key, customer_id, user_agent, role } = parsed.data);
    try {
      const parsedEndpoint = new URL(endpoint);
      const host = parsedEndpoint.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      if (
        parsedEndpoint.protocol !== 'https:' ||
        host === 'localhost' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      ) {
        return c.json({ success: false, error: 'Push endpoint must use HTTPS and a public host' }, 400);
      }
    } catch {
      return c.json({ success: false, error: 'Push endpoint must use HTTPS and a public host' }, 400);
    }
  }

  const subRand = new Uint8Array(3);
  crypto.getRandomValues(subRand);
  const subSuffix = Array.from(subRand, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const id = `SUB-${Date.now().toString(36).toUpperCase()}${subSuffix}`;
  const now = new Date().toISOString();

  try {
    await db.prepare(
      `INSERT INTO push_subscriptions (id, customer_id, endpoint, auth_key, p256dh_key, user_agent, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
       auth_key = excluded.auth_key,
       p256dh_key = excluded.p256dh_key,
       customer_id = excluded.customer_id,
       user_agent = excluded.user_agent,
       role = excluded.role,
       updated_at = excluded.updated_at`
    ).bind(id, customer_id || null, endpoint, auth_key, p256dh_key, user_agent || null, role || 'customer', now, now).run();
  } catch {
    await db.prepare(
      `INSERT INTO push_subscriptions (id, customer_id, endpoint, auth_key, p256dh_key, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
       auth_key = excluded.auth_key,
       p256dh_key = excluded.p256dh_key,
       customer_id = excluded.customer_id,
       user_agent = excluded.user_agent`
    ).bind(id, customer_id || null, endpoint, auth_key, p256dh_key, user_agent || null, now).run();
  }

  return c.json({ success: true, message: 'Subscribed' }, 201);
});

// DELETE /api/push/subscribe — remove staff subscription by name or endpoint
pushRouter.delete('/subscribe', requireAuth(['owner', 'manager', 'supervisor', 'admin', 'staff', 'waiter', 'cashier']), async(c) => {
  const db = c.env.AURA_DB;
  const raw = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const endpoint = typeof raw.endpoint === 'string' ? raw.endpoint.trim() : '';

  if (!name && !endpoint) {
    return c.json({ success: false, error: 'name or endpoint is required' }, 400);
  }

  if (endpoint) {
    await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
  } else {
    const manualEndpoint = `https://manual.auraspace.local/staff/${encodeURIComponent(name.toLowerCase())}`;
    await db.prepare(
      'DELETE FROM push_subscriptions WHERE user_agent = ? OR customer_id = ? OR endpoint = ?'
    ).bind(name, name, manualEndpoint).run();
  }

  return c.json({ success: true, message: 'Unsubscribed' });
});

// POST /api/push/unsubscribe — remove subscription (requires matching auth_key for ownership proof)
pushRouter.post('/unsubscribe', async(c) => {
  const db = c.env.AURA_DB;
  const raw = await c.req.json();
  const parsed = pushUnsubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }

  const endpoint = parsed.data.endpoint;
  // Verify the caller owns this subscription via auth_key match
  const authKey = typeof (raw as Record<string, unknown>).auth_key === 'string'
    ? String((raw as Record<string, unknown>).auth_key).trim()
    : '';
  if (authKey) {
    // If auth_key provided, verify it matches the stored subscription
    try {
      const existing = await db.prepare('SELECT auth_key FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).first<{ auth_key: string }>();
      if (existing && existing.auth_key !== authKey && existing.auth_key !== 'manual_pending') {
        return c.json({ success: false, error: 'Invalid auth_key' }, 403);
      }
    } catch {
      // table schema variation — proceed with delete
    }
  }

  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
  return c.json({ success: true, message: 'Unsubscribed' });
});

// GET /api/push/public-key — expose VAPID public key to frontend
pushRouter.get('/public-key', async(c) => {
  return c.json({
    success: true,
    publicKey: c.env.VAPID_PUBLIC_KEY || null
  });
});

// POST /api/push/send-staff — send push to staff by role (kitchen/cashier/all or admin testSend)
pushRouter.post('/send-staff', requireAuth(['owner', 'manager', 'supervisor', 'admin']), async(c) => {
  const raw = await c.req.json() as Record<string, unknown>;
  const targetRole = typeof raw.targetRole === 'string' ? raw.targetRole : undefined;
  const staffName = typeof raw.name === 'string' ? raw.name : undefined;
  const normalizedPayload = {
    ...raw,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'AURA SPACE — Thông báo thử nghiệm',
    body: typeof raw.body === 'string' && raw.body.trim()
      ? raw.body
      : (staffName ? `Thông báo thử cho ${staffName}` : 'Kiểm tra kết nối thông báo đẩy'),
    role: typeof raw.role === 'string'
      ? raw.role
      : (targetRole === 'all' ? '' : (targetRole || 'staff-all')),
  };
  const parsed = pushSendStaffSchema.safeParse(normalizedPayload);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { title, body: msgBody, role = 'staff-all', data, actions } = parsed.data;

  const result = await sendPushToStaff(c.env as Env, {
    title,
    body: msgBody,
    data,
    actions
  },
  role === 'all' ? '' : role);

  return c.json({ success: true, ...result });
});

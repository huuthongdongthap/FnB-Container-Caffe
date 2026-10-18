import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { sendPushToStaff } from '../tree/push/notifier';
import { pushSubscribeSchema, pushUnsubscribeSchema, pushSendStaffSchema, zodErrorResponse } from '../lib/validators';

export const pushRouter = new Hono<{ Bindings: Env }>();

// GET /api/push/list-subscriptions — list staff push subscriptions for admin UI
pushRouter.get('/list-subscriptions', requireAuth(['owner', 'manager', 'admin', 'staff', 'waiter', 'cashier']), async(c) => {
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
  const normalizedPayload = isManualStaffEntry
    ? {
        endpoint: `https://manual.auraspace.local/staff/${encodeURIComponent(String(raw.name).trim().toLowerCase())}`,
        auth_key: 'manual_pending',
        p256dh_key: 'manual_pending',
        customer_id: String(raw.name).trim(),
        user_agent: String(raw.name).trim(),
        role: typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : 'staff',
      }
    : raw;

  const parsed = pushSubscribeSchema.safeParse(normalizedPayload);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const { endpoint, auth_key, p256dh_key, customer_id, user_agent, role } = parsed.data;

  const id = `SUB-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
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
pushRouter.delete('/subscribe', requireAuth(['owner', 'manager', 'admin', 'staff', 'waiter', 'cashier']), async(c) => {
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

// POST /api/push/unsubscribe — remove subscription
pushRouter.post('/unsubscribe', async(c) => {
  const db = c.env.AURA_DB;
  const raw = await c.req.json();
  const parsed = pushUnsubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }

  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(parsed.data.endpoint).run();
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
pushRouter.post('/send-staff', requireAuth(['owner', 'manager', 'admin']), async(c) => {
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

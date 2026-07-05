import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth.js';
import { sendPushToStaff } from '../tree/push/notifier.js';

export const pushRouter = new Hono<{ Bindings: Env }>();

// POST /api/push/subscribe — save subscription
pushRouter.post('/subscribe', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const { endpoint, auth_key, p256dh_key, customer_id, user_agent, role } = body;

  if (!endpoint || !auth_key || !p256dh_key) {
    return c.json({ success: false, error: 'Missing required fields: endpoint, auth_key, p256dh_key' }, 400);
  }

  const id = 'SUB-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const now = new Date().toISOString();

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

  return c.json({ success: true, message: 'Subscribed' }, 201);
});

// POST /api/push/unsubscribe — remove subscription
pushRouter.post('/unsubscribe', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as { endpoint?: string };

  if (!body.endpoint) {
    return c.json({ success: false, error: 'Missing endpoint' }, 400);
  }

  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(body.endpoint).run();
  return c.json({ success: true, message: 'Unsubscribed' });
});

// GET /api/push/public-key — expose VAPID public key to frontend
pushRouter.get('/public-key', async (c) => {
  return c.json({
    success: true,
    publicKey: c.env.VAPID_PUBLIC_KEY || null,
  });
});

// POST /api/push/send-staff — send push to staff by role (kitchen/cashier/all)
pushRouter.post('/send-staff', requireAuth(['owner']), async (c) => {
  const body = await c.req.json() as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title : '';
  const msgBody = typeof body.body === 'string' ? body.body : '';
  const role = typeof body.role === 'string' ? body.role : 'staff-all';
  const payloadData = typeof body.data === 'object' && body.data !== null ? body.data as Record<string, unknown> : undefined;
  const payloadActions = Array.isArray(body.actions) ? body.actions as Array<{ action: string; title: string }> : undefined;

  if (!title || !msgBody) {
    return c.json({ success: false, error: 'Missing: title, body' }, 400);
  }

  const result = await sendPushToStaff(c.env as Env, {
    title,
    body: msgBody,
    data: payloadData,
    actions: payloadActions,
  }, role);

  return c.json({ success: true, ...result });
});

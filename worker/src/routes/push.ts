import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { sendPushToStaff } from '../tree/push/notifier';
import { pushSubscribeSchema, pushUnsubscribeSchema, pushSendStaffSchema } from '../lib/validators';

export const pushRouter = new Hono<{ Bindings: Env }>();

// POST /api/push/subscribe — save subscription
pushRouter.post('/subscribe', async(c) => {
  const db = c.env.AURA_DB;
  const raw = await c.req.json();
  const parsed = pushSubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const { endpoint, auth_key, p256dh_key, customer_id, user_agent, role } = parsed.data;

  const id = `SUB-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
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
pushRouter.post('/unsubscribe', async(c) => {
  const db = c.env.AURA_DB;
  const raw = await c.req.json();
  const parsed = pushUnsubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
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

// POST /api/push/send-staff — send push to staff by role (kitchen/cashier/all)
pushRouter.post('/send-staff', requireAuth(['owner']), async(c) => {
  const raw = await c.req.json();
  const parsed = pushSendStaffSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const { title, body: msgBody, role = 'staff-all', data, actions } = parsed.data;

  const result = await sendPushToStaff(c.env as Env, {
    title,
    body: msgBody,
    data,
    actions
  },
  role);

  return c.json({ success: true, ...result });
});

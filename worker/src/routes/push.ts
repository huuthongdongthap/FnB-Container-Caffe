import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth.js';

export const pushRouter = new Hono<{ Bindings: Env }>();

// POST /api/push/subscribe — save subscription
pushRouter.post('/subscribe', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const { endpoint, auth_key, p256dh_key, customer_id, user_agent } = body;

  if (!endpoint || !auth_key || !p256dh_key) {
    return c.json({ success: false, error: 'Missing required fields: endpoint, auth_key, p256dh_key' }, 400);
  }

  const id = 'SUB-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  const now = new Date().toISOString();

  // Upsert by endpoint (unique)
  await db.prepare(`
    INSERT INTO push_subscriptions (id, customer_id, endpoint, auth_key, p256dh_key, user_agent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      auth_key = excluded.auth_key,
      p256dh_key = excluded.p256dh_key,
      customer_id = excluded.customer_id,
      user_agent = excluded.user_agent,
      updated_at = excluded.updated_at
  `).bind(id, customer_id || null, endpoint, auth_key, p256dh_key, user_agent || null, now, now).run();

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

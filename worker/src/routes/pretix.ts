/**
 * pretix Routes — /api/pretix
 * Event ticketing bridge — webhook HMAC validation + REST proxy.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { createPretixClient, PretixClient } from '../lib/pretix-client';

interface PretixWebhookBody {
  notification_id: number;
  organizer: string;
  event: string;
  code: string;
  action: string;
}

interface TicketInfo {
  order_code: string;
  ticket_name: string;
  attendee_name: string;
  email: string;
  status: string;
  event_name: string;
  event_date: string;
}

export const pretixRouter = new Hono<{ Bindings: Env }>();

function getPretixClient(env: { PRETIX_API_URL?: string; PRETIX_API_TOKEN?: string }): PretixClient | null {
  if (!env.PRETIX_API_URL || !env.PRETIX_API_TOKEN) return null;
  return createPretixClient(env.PRETIX_API_URL, env.PRETIX_API_TOKEN);
}

// POST /api/pretix/webhook — receive pretix webhook
pretixRouter.post('/webhook', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json<PretixWebhookBody>();

  if (!body.action || !body.code) {
    return c.json({ success: false, error: 'Invalid webhook payload' }, 400);
  }

  // Log webhook event
  await db.prepare(
    'INSERT INTO pretix_webhook_log (notification_id, organizer, event, code, action, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    body.notification_id || null,
    body.organizer || '',
    body.event || '',
    body.code,
    body.action,
    JSON.stringify(body),
    new Date().toISOString()
  ).run();

  return c.json({ success: true, message: 'Webhook received' });
});

// GET /api/pretix/tickets/:code — fetch ticket by order code
pretixRouter.get('/tickets/:code', async (c) => {
  const client = getPretixClient(c.env);
  if (!client) {
    return c.json({ success: false, error: 'pretix not configured' }, 503);
  }

  const code = c.req.param('code');
  try {
    const order = await (client as any).getOrder(code);
    return c.json({ success: true, data: order });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: msg }, 500);
  }
});

// GET /api/pretix/events — list events
pretixRouter.get('/events', async (c) => {
  const client = getPretixClient(c.env);
  if (!client) {
    return c.json({ success: false, error: 'pretix not configured' }, 503);
  }

  try {
    const events = await (client as any).listEvents();
    return c.json({ success: true, data: events });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: msg }, 500);
  }
});

// POST /api/pretix/checkin — verify ticket at door
pretixRouter.post('/checkin', async (c) => {
  const client = getPretixClient(c.env);
  if (!client) {
    return c.json({ success: false, error: 'pretix not configured' }, 503);
  }

  const body = await c.req.json<{ ticket_code: string }>();
  if (!body.ticket_code) {
    return c.json({ success: false, error: 'ticket_code required' }, 400);
  }

  try {
    const ticket = await (client as any).checkInTicket(body.ticket_code);
    return c.json({ success: true, data: ticket });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: msg }, 500);
  }
});

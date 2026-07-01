/**
 * pretix Routes — /api/pretix
 * Event ticketing bridge — webhook HMAC validation + REST proxy.
 *
 * Routes:
 *   GET  /events          — List events
 *   GET  /events/:slug    — Get event with items
 *   GET  /orders          — List paginated orders
 *   POST /webhook         — Receive pretix webhook (HMAC validated)
 *   POST /checkin         — Verify ticket at door
 *   POST /generate        — Generate social post from event
 */

import { Hono } from 'hono';
import { PretixApiError } from '../lib/pretix-client';
import { pretixWebhookBodySchema, pretixCheckinSchema, pretixGenerateSchema } from '../lib/validators';
import { getPretixClient } from '../tree/pretix/client-factory';
import { validateWebhookSignature } from '../tree/pretix/hmac-validator';
import type { PretixEnv, PretixItemsResponse, PretixEventResponse, PretixItem } from '../tree/pretix/types';

export const pretixRouter = new Hono();

// POST /webhook — receive pretix webhook
pretixRouter.post('/webhook', async (c) => {
  const env = c.env as unknown as PretixEnv;
  const db = env.AURA_DB;
  const bodyText = await c.req.text();
  const signature = c.req.header('X-pretix-Signature');

  const isValid = await validateWebhookSignature(bodyText, signature, env.PRETIX_WEBHOOK_SECRET);
  if (!isValid) {
    if (env.PRETIX_WEBHOOK_SECRET) {
      return c.json({ success: false, error: 'Invalid signature' }, 401);
    }
  }

  let parsedBody: Record<string, unknown>;
  try {
    parsedBody = JSON.parse(bodyText);
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }
  const parsed = pretixWebhookBodySchema.safeParse(parsedBody);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const body = parsed.data;

  if (db) {
    try {
      await db.prepare(
        'INSERT INTO pretix_webhook_log (notification_id, organizer, event, code, action, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        body.notification_id || null, body.organizer || '', body.event || '',
        body.code, body.action, bodyText, new Date().toISOString()
      ).run();
    } catch {
      // DB logging is best-effort
    }
  }

  return c.json({ success: true, message: 'Webhook received' });
});

// GET /events — list events
pretixRouter.get('/events', async (c) => {
  const env = c.env as unknown as PretixEnv;
  const client = getPretixClient(env);
  if (!client) return c.json({ success: false, error: 'pretix not configured' }, 503);

  const organizer = (env.PRETIX_ORGANIZER as string) || (c.req.query('organizer') as string) || 'default';

  try {
    const events = await client.listEvents(organizer);
    return c.json({ success: true, data: events });
  } catch {
    return c.json({ success: false, error: 'Failed to fetch events' }, 500);
  }
});

// GET /events/:slug — get event with items
pretixRouter.get('/events/:slug', async (c) => {
  const env = c.env as unknown as PretixEnv;
  const client = getPretixClient(env);
  if (!client) return c.json({ success: false, error: 'pretix not configured' }, 503);

  const organizer = (env.PRETIX_ORGANIZER as string) || 'default';
  const slug = c.req.param('slug');

  try {
    const event = await client.getEvent(organizer, slug) as PretixEventResponse;
    try {
      const itemsResult = await client.listItems(organizer, slug) as PretixItemsResponse;
      event.items = itemsResult.results || [];
    } catch {
      event.items = [];
    }
    return c.json({ success: true, data: event });
  } catch (e: unknown) {
    if (e instanceof PretixApiError && e.status === 404) {
      return c.json({ success: false, error: 'Event not found' }, 404);
    }
    return c.json({ success: false, error: 'Failed to fetch event' }, 500);
  }
});

// GET /orders — list paginated orders
pretixRouter.get('/orders', async (c) => {
  const env = c.env as unknown as PretixEnv;
  const client = getPretixClient(env);
  if (!client) return c.json({ success: false, error: 'pretix not configured' }, 503);

  const organizer = (env.PRETIX_ORGANIZER as string) || 'default';
  const eventSlug = c.req.query('event') || 'default';

  try {
    const orders = await client.listOrders(organizer, eventSlug);
    return c.json({ success: true, data: orders });
  } catch {
    return c.json({ success: false, error: 'Failed to fetch orders' }, 500);
  }
});

// POST /checkin — verify ticket at door
pretixRouter.post('/checkin', async (c) => {
  const env = c.env as unknown as PretixEnv;
  const client = getPretixClient(env);
  if (!client) return c.json({ success: false, error: 'pretix not configured' }, 503);

  let rawCheckin: Record<string, unknown>;
  try {
    rawCheckin = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }
  const parsed = pretixCheckinSchema.safeParse(rawCheckin);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const body = parsed.data;

  const organizer = (env.PRETIX_ORGANIZER as string) || 'default';
  const eventSlug = body.event || 'default';
  const listId = body.listId || 1;

  try {
    const result = await client.redeemCheckin(organizer, eventSlug, listId, body.secret);
    return c.json({ success: true, data: result });
  } catch (e: unknown) {
    if (e instanceof PretixApiError && e.status === 404) {
      return c.json({ success: false, error: 'Ticket not found' }, 404);
    }
    return c.json({ success: false, error: 'Checkin failed' }, 500);
  }
});

// POST /generate — generate social post from event
pretixRouter.post('/generate', async (c) => {
  const env = c.env as unknown as PretixEnv;
  const client = getPretixClient(env);
  if (!client) return c.json({ success: false, error: 'pretix not configured' }, 503);

  let rawGenerate: Record<string, unknown>;
  try {
    rawGenerate = await c.req.json<Record<string, unknown>>();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }
  const parsed = pretixGenerateSchema.safeParse(rawGenerate);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  const body = parsed.data;

  const organizer = (env.PRETIX_ORGANIZER as string) || 'default';

  try {
    const event = await client.getEvent(organizer, body.slug) as PretixEventResponse;

    let items: PretixItem[] = [];
    try {
      const itemsResult = await client.listItems(organizer, body.slug) as PretixItemsResponse;
      items = itemsResult.results || [];
    } catch {
      // items optional
    }

    const eventName = event.name?.['vi'] || event.name || body.slug;
    const content = `🎉 Su kien: ${eventName} — Aura Cafe\n#AuraCafe #SuKien #Workshop`;

    return c.json({
      success: true,
      data: { content, hashtags: ['AuraCafe', 'SuKien', 'Workshop'] },
    });
  } catch (e: unknown) {
    if (e instanceof PretixApiError && e.status === 404) {
      return c.json({ success: false, error: 'Event not found' }, 404);
    }
    return c.json({ success: false, error: 'Failed to generate content' }, 500);
  }
});

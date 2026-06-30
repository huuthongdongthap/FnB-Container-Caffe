/**
 * pretix Bridge Routes — Hono router for event ticketing
 *
 * Bridges Aura D1 data to the self-hosted pretix API.
 * Internal network only (no auth middleware except webhook signature).
 *
 * GET  /api/pretix/events         — List events from pretix
 * GET  /api/pretix/events/:slug   — Get single event with ticket types
 * GET  /api/pretix/orders         — List recent orders (admin)
 * POST /api/pretix/webhook        — Receive pretix webhook events (HMAC validated)
 * POST /api/pretix/checkin        — Proxy check-in scan (QR → redeem)
 * POST /api/pretix/generate       — Generate branded social post from event data
 */

import { Hono } from 'hono';
import { createLogger } from '../utils/logger.js';
import { createPretixClient, PretixApiError } from '../lib/pretix-client.js';

const log = createLogger({ route: 'pretix' });

export const pretixRouter = new Hono();

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Get pretix client from env.
 */
function getPretix(c) {
  return createPretixClient(c.env.PRETIX_API_URL, c.env.PRETIX_API_TOKEN);
}

/**
 * Validate HMAC-SHA256 webhook signature using Web Crypto API.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param {string} body - Raw request body
 * @param {string} signature - Hex signature from X-pretix-Signature header
 * @param {string} secret - Webhook secret key
 * @returns {Promise<boolean>}
 */
async function validateWebhookSignature(body, signature, secret) {
  if (!secret || !signature) { return false; }

  // Validate format: signature must be 64-char hex string
  if (!/^[a-f0-9]{64}$/i.test(signature)) { return false; }

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
    const expected = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Constant-time comparison
    if (expected.length !== signature.length) { return false; }
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

// ── Content Templates ────────────────────────────────────────────

/**
 * Generate branded social post content from an event.
 *
 * @param {object} event - pretix event object
 * @param {Array<object>} items - Ticket type items
 * @returns {{ content: string, hashtags: string[], mediaUrls: string[] }}
 */
function eventToPostContent(event, items) {
  const eventName = event.name || 'Su kien Aura Cafe';
  const itemList = (items || [])
    .map((i) => `🎫 ${i.name}: ${Number(i.default_price || 0).toLocaleString('vi-VN')}đ`)
    .join('\n');

  const content = [
    `🎪 ${eventName}`,
    '',
    itemList || '🎟️ Vé đang mở bán!',
    '',
    '📍 Aura Cafe, Sa Đéc',
    '🎟️ Đặt vé ngay: https://tickets.auraspace.cafe',
    '',
    '#AuraCafe #SuKien #Workshop',
  ].join('\n');

  return {
    content,
    hashtags: ['AuraCafe', 'SuKien', 'Workshop'],
    mediaUrls: [],
  };
}

// ── GET /api/pretix/events ──────────────────────────────────────

pretixRouter.get('/events', async (c) => {
  log.info('list_events_start');
  try {
    const pretix = getPretix(c);
    const data = await pretix.listEvents(c.env.PRETIX_ORGANIZER);
    log.info('list_events_success', { count: data.count });
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof PretixApiError) {
      log.error('pretix_events_failed', { status: err.status });
      return c.json({ success: false, error: 'Failed to fetch events' }, 500);
    }
    log.error('list_events_failed', { error: err.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── GET /api/pretix/events/:slug ─────────────────────────────────

pretixRouter.get('/events/:slug', async (c) => {
  const slug = c.req.param('slug');
  log.info('get_event_start', { slug });
  try {
    const pretix = getPretix(c);
    const data = await pretix.getEvent(c.env.PRETIX_ORGANIZER, slug);

    // Also fetch ticket types (items)
    let items = [];
    try {
      const itemsResp = await pretix.listItems(c.env.PRETIX_ORGANIZER, slug);
      items = itemsResp.results || [];
    } catch {
      // Items fetch is best-effort
      log.warn('get_event_items_failed', { slug });
    }
    data.items = items;

    log.info('get_event_success', { slug, itemCount: items.length });
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof PretixApiError) {
      if (err.status === 404) {
        return c.json({ success: false, error: 'Event not found' }, 404);
      }
      log.error('pretix_event_failed', { status: err.status, slug });
      return c.json({ success: false, error: 'Failed to fetch event' }, 500);
    }
    log.error('get_event_failed', { error: err.message, slug });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── GET /api/pretix/orders ──────────────────────────────────────

pretixRouter.get('/orders', async (c) => {
  log.info('list_orders_start');
  try {
    const pretix = getPretix(c);
    const event = c.req.query('event') || '';
    const data = event
      ? await pretix.listOrders(c.env.PRETIX_ORGANIZER, event)
      : { results: [] };
    log.info('list_orders_success', { count: data.count || 0 });
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof PretixApiError) {
      log.error('pretix_orders_failed', { status: err.status });
      return c.json({ success: false, error: 'Failed to fetch orders' }, 500);
    }
    log.error('list_orders_failed', { error: err.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── POST /api/pretix/webhook ────────────────────────────────────

pretixRouter.post('/webhook', async (c) => {
  log.info('webhook_received');
  try {
    const signature = c.req.header('X-pretix-Signature') || '';
    const body = await c.req.text();

    // Validate HMAC signature
    if (c.env.PRETIX_WEBHOOK_SECRET) {
      if (!signature || signature.length < 10) {
        log.warn('webhook_missing_signature');
        return c.json({ success: false, error: 'Invalid webhook signature' }, 401);
      }
      if (!(await validateWebhookSignature(body, signature, c.env.PRETIX_WEBHOOK_SECRET))) {
        log.warn('webhook_invalid_signature');
        return c.json({ success: false, error: 'Invalid webhook signature' }, 401);
      }
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      log.warn('webhook_invalid_json');
      return c.json({ success: false, error: 'Invalid JSON' }, 400);
    }

    const { action, event, code } = payload;

    if (!action || !code) {
      log.warn('webhook_missing_fields', { hasAction: !!action, hasCode: !!code });
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    const db = c.env.AURA_DB;

    switch (action) {
    case 'pretix.event.order.placed':
      log.info('webhook_order_placed', { code });
      await db.prepare(
        'INSERT OR REPLACE INTO ticket_orders (id, event_slug, status, webhook_raw, updated_at)'
        + ' VALUES (?, ?, \'placed\', ?, datetime(\'now\'))'
      ).bind(code, event, body).run();
      break;

    case 'pretix.event.order.paid':
      log.info('webhook_order_paid', { code });
      await db.prepare(
        'UPDATE ticket_orders SET status = \'paid\', webhook_raw = ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).bind(body, code).run();
      break;

    case 'pretix.event.order.canceled':
      log.info('webhook_order_canceled', { code });
      await db.prepare(
        'UPDATE ticket_orders SET status = \'canceled\', webhook_raw = ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).bind(body, code).run();
      break;

    case 'pretix.event.order.refund.done':
      log.info('webhook_order_refunded', { code });
      await db.prepare(
        'UPDATE ticket_orders SET status = \'refunded\', webhook_raw = ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).bind(body, code).run();
      break;

    case 'pretix.event.checkin':
      log.info('webhook_checkin', { code });
      await db.prepare(
        'UPDATE ticket_orders SET status = \'checked_in\', webhook_raw = ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).bind(body, code).run();
      break;

    default:
      // Unknown action — acknowledge but don't error
      log.info('webhook_ignored', { action });
    }

    return c.json({ success: true });
  } catch (err) {
    log.error('webhook_failed', { error: err.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── POST /api/pretix/checkin ────────────────────────────────────

pretixRouter.post('/checkin', async (c) => {
  log.info('checkin_start');
  try {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body.secret || typeof body.secret !== 'string') {
      return c.json({ success: false, error: 'secret is required' }, 400);
    }

    const pretix = getPretix(c);
    const event = body.event || '';
    const listId = body.listId != null ? Number(body.listId) : 1;

    const result = await pretix.redeemCheckin(
      c.env.PRETIX_ORGANIZER, event, listId, body.secret
    );

    log.info('checkin_success', { status: result.status });
    return c.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof PretixApiError) {
      if (err.status === 404) {
        log.warn('checkin_invalid_ticket');
        return c.json({
          success: false,
          error: 'Invalid ticket',
          data: { status: 'error', reason: 'unknown_ticket' },
        }, 404);
      }
      log.error('checkin_pretix_failed', { status: err.status });
      return c.json({ success: false, error: 'Check-in failed' }, 500);
    }
    log.error('checkin_failed', { error: err.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── POST /api/pretix/generate ────────────────────────────────────

pretixRouter.post('/generate', async (c) => {
  log.info('generate_post_start');
  try {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    if (!body.slug || typeof body.slug !== 'string') {
      return c.json({ success: false, error: 'slug is required' }, 400);
    }

    const pretix = getPretix(c);
    const event = await pretix.getEvent(c.env.PRETIX_ORGANIZER, body.slug);

    let items = [];
    try {
      const itemsResp = await pretix.listItems(c.env.PRETIX_ORGANIZER, body.slug);
      items = itemsResp.results || [];
    } catch {
      // Best-effort items fetch
    }

    const data = eventToPostContent(event, items);
    log.info('generate_post_success', { slug: body.slug });
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof PretixApiError && err.status === 404) {
      return c.json({ success: false, error: 'Event not found' }, 404);
    }
    log.error('generate_post_failed', { error: err.message });
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

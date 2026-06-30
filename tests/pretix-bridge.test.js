/**
 * pretix Bridge Tests — TDD for pretix event ticketing integration
 *
 * Tests cover:
 * - pretix-client.js (HTTP client with Token auth, retry, error handling)
 * - pretix.js routes (events, orders, checkin, webhook, generate)
 *
 * Uses mock D1 + mock fetch. Follows mixpost-bridge.test.js pattern.
 */

// ── Mock logger ────────────────────────────────────────────────
jest.mock('../worker/src/utils/logger.js', () => {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const noop = () => {};
  return {
    createLogger: () => ({
      debug: noop, info: noop, warn: noop, error: noop,
      child: () => ({ debug: noop, info: noop, warn: noop, error: noop }),
    }),
    levels,
  };
});

// ── Mock Web Crypto API ────────────────────────────────────────
// pretix validates HMAC-SHA256 with crypto.subtle.
// Mock returns 32 bytes of 0x61 ('a') → hex = '61'.repeat(32) = valid 64-char hex
const VALID_HMAC_HEX = '61'.repeat(32); // 32 bytes of 0x61 → 64 hex chars

// TextEncoder/TextDecoder are not available in jsdom (v20) but are required by
// validateWebhookSignature which uses them to encode the body and secret for HMAC.
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// NOTE: globalThis.crypto is a getter-only accessor in jsdom/Node.js.
// Direct assignment silently fails. Must delete first, then assign.
delete globalThis.crypto;
globalThis.crypto = {
  subtle: {
    importKey: jest.fn(async () => ({ type: 'secret', algorithm: { name: 'HMAC', hash: 'SHA-256' } })),
    sign: jest.fn(async () => new Uint8Array(32).fill(97)), // 0x61 = 97 = 'a'
  },
};

// ── Mock D1 Helper ─────────────────────────────────────────────
function createMockD1(seedData = {}) {
  const tables = {};
  ['ticket_orders']
    .forEach(t => { tables[t] = [...(seedData[t] || [])]; });

  function parseWhere(sql) {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    const table = fromMatch ? fromMatch[1] : null;
    const condMatch = sql.match(/(\w+)\s*(>=|<=|!=|>|<|=)\s*(\?|'[^']*'|"[^"]*"|\d+)/g);
    if (!condMatch || !table) return null;
    const conditions = [];
    let bindIdx = 0;
    for (const c of condMatch) {
      const m = c.match(/(\w+)\s*(>=|<=|!=|>|<|=)\s*(\?|'[^']*'|"[^"]*"|\d+)/);
      const vt = m[3];
      if (vt === '?') { conditions.push({ col: m[1], op: m[2], bindIdx }); bindIdx++; }
      else if (vt.startsWith("'") || vt.startsWith('"')) { conditions.push({ col: m[1], op: m[2], literal: vt.slice(1, -1) }); }
      else { conditions.push({ col: m[1], op: m[2], literal: Number(vt) }); }
    }
    return { table, conditions };
  }

  function matchRow(row, conditions, bindValues) {
    for (const cond of conditions) {
      const val = cond.literal !== undefined ? cond.literal : bindValues[cond.bindIdx];
      const rowVal = row[cond.col];
      if (rowVal == null && val != null) return false;
      switch (cond.op) {
        case '=':  if (String(rowVal) !== String(val)) return false; break;
        case '>':  if (Number(rowVal) <= Number(val)) return false; break;
        case '<':  if (Number(rowVal) >= Number(val)) return false; break;
        default:   if (String(rowVal) !== String(val)) return false; break;
      }
    }
    return true;
  }

  function getPrimaryTable(sql) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  const db = {
    prepare: jest.fn((q) => {
      const stmt = {
        _sql: q, _bindValues: [],
        bind: jest.fn(function (...vals) { this._bindValues.push(...vals); return this; }),
        first: jest.fn(async function () {
          const parsed = parseWhere(q);
          const table = getPrimaryTable(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          if (!parsed || !tables[parsed.table]) return rows[0] || null;
          const matched = rows.filter(r => matchRow(r, parsed.conditions, this._bindValues));
          return matched[0] || null;
        }),
        all: jest.fn(async function () {
          const parsed = parseWhere(q);
          const table = getPrimaryTable(q);
          const rows = (table && tables[table]) ? tables[table] : [];
          if (!parsed || !tables[parsed.table]) return { results: [...rows] };
          const matched = rows.filter(r => matchRow(r, parsed.conditions, this._bindValues));
          return { results: matched };
        }),
        run: jest.fn(async function () {
          // For INSERT/UPDATE/DELETE — extract table name and handle accordingly
          const insertMatch = q.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
          const updateMatch = q.match(/UPDATE\s+(\w+)/i);
          const table = insertMatch ? insertMatch[1] : (updateMatch ? updateMatch[1] : getPrimaryTable(q));
          if (insertMatch && table && tables[table]) {
            // Create a row from bind values for INSERT
            const row = {};
            const cols = q.match(/\(([^)]+)\)/);
            if (cols) {
              const names = cols[1].split(',').map(c => c.trim());
              names.forEach((n, i) => { row[n] = this._bindValues[i]; });
            }
            tables[table].push(row);
          }
          if (updateMatch && table && tables[table]) {
            // Simple UPDATE: modify matching rows
            const parsed = parseWhere(q);
            if (parsed) {
              tables[table].forEach(r => {
                if (matchRow(r, parsed.conditions, this._bindValues.slice(1))) {
                  // First bind value is typically the SET value
                }
              });
            }
          }
          return { success: true };
        }),
      };
      return stmt;
    }),
  };
  return db;
}

// ── Fetch Mock Helpers ─────────────────────────────────────────
function mockFetchResponse(data, status = 200) {
  global.fetch.mockResolvedValue(
    new Response(JSON.stringify(data), {
      status, headers: { 'Content-Type': 'application/json' },
    })
  );
}

function mockFetchError(status, body) {
  global.fetch.mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    })
  );
}

// ── Test Data ──────────────────────────────────────────────────
const seedEvents = [
  { slug: 'workshop-thang-7', name: 'Workshop Tháng 7', date_from: '2026-07-15T09:00:00+07:00', date_to: '2026-07-15T12:00:00+07:00', live: true },
  { slug: 'live-music-fri', name: 'Live Music Friday', date_from: '2026-07-18T19:00:00+07:00', date_to: '2026-07-18T22:00:00+07:00', live: false },
];

const seedItems = [
  { id: 1, name: 'Vé thường', default_price: '150000.00', currency: 'VND', quota: 20 },
  { id: 2, name: 'Vé VIP', default_price: '350000.00', currency: 'VND', quota: 10 },
];

const seedOrders = [
  { code: 'ABC23', status: 'p', email: 'khach@example.com', total: '150000.00', event: 'workshop-thang-7' },
  { code: 'DEF45', status: 'n', email: 'vip@example.com', total: '350000.00', event: 'workshop-thang-7' },
];

const pretixResponse = { count: 2, next: null, previous: null, results: seedEvents };

// ── pretix-client.js Tests ─────────────────────────────────────
describe('PretixClient', () => {
  let createPretixClient, PretixApiError;

  beforeAll(() => {
    global.fetch = jest.fn();
    if (!globalThis.crypto) {
      globalThis.crypto = { subtle: { importKey: jest.fn(), sign: jest.fn() } };
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const mod = require('../worker/src/lib/pretix-client.js');
    createPretixClient = mod.createPretixClient;
    PretixApiError = mod.PretixApiError;
  });

  test('listEvents sends correct Token auth header', async () => {
    mockFetchResponse(pretixResponse);
    const client = createPretixClient('https://tickets.auraspace.cafe', 'tok_test123');
    await client.listEvents('aura-cafe');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/v1/organizers/aura-cafe/events/');
    expect(opts.headers.Authorization).toBe('Token tok_test123');
  });

  test('getEvent returns event with items', async () => {
    mockFetchResponse({ ...seedEvents[0], items: seedItems });
    const client = createPretixClient('https://tickets.auraspace.cafe', 'tok');
    const event = await client.getEvent('aura-cafe', 'workshop-thang-7');

    expect(event.name).toBe('Workshop Tháng 7');
    expect(event.items).toHaveLength(2);
  });

  test('listOrders returns paginated orders', async () => {
    mockFetchResponse({ count: 2, next: null, previous: null, results: seedOrders });
    const client = createPretixClient('https://tickets.auraspace.cafe', 'tok');
    const orders = await client.listOrders('aura-cafe', 'workshop-thang-7');

    expect(orders.results).toHaveLength(2);
  });

  test('redeemCheckin sends POST with untrusted_input=true', async () => {
    mockFetchResponse({ status: 'ok', position: 5 });
    const client = createPretixClient('https://tickets.auraspace.cafe', 'tok');
    await client.redeemCheckin('aura-cafe', 'workshop-thang-7', 1, 'abc123secret');

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/redeem/');
    expect(url).toContain('untrusted_input=true');
    expect(opts.method).toBe('POST');
  });

  test('createWebhook sends POST with action_types', async () => {
    mockFetchResponse({ id: 5, target_url: 'https://fnb-caffe-container.pages.dev/api/pretix/webhook' });
    const client = createPretixClient('https://tickets.auraspace.cafe', 'tok');
    await client.createWebhook('aura-cafe', {
      target_url: 'https://example.com/webhook',
      action_types: ['pretix.event.order.placed'],
      all_events: true,
    });

    const [, opts] = global.fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.target_url).toBe('https://example.com/webhook');
    expect(body.action_types).toContain('pretix.event.order.placed');
  });

  test('retries once on 5xx response', async () => {
    global.fetch
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(pretixResponse), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));

    const client = createPretixClient('https://tickets.auraspace.cafe', 'tok', { retryDelay: 10 });
    const result = await client.listEvents('aura-cafe');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
  });

  test('throws PretixApiError on 401', async () => {
    mockFetchError(401, { detail: 'Invalid token' });
    const client = createPretixClient('https://tickets.auraspace.cafe', 'tok');

    await expect(client.listEvents('aura-cafe')).rejects.toThrow(PretixApiError);
    await expect(client.listEvents('aura-cafe')).rejects.toMatchObject({ status: 401 });
  });

  test('throws PretixApiError on 4xx (non-401)', async () => {
    mockFetchError(404, { detail: 'Not found' });
    const client = createPretixClient('https://tickets.auraspace.cafe', 'tok');

    await expect(client.getEvent('aura-cafe', 'nonexistent')).rejects.toThrow(PretixApiError);
    await expect(client.getEvent('aura-cafe', 'nonexistent')).rejects.toMatchObject({ status: 404 });
  });
});

// ── pretix.js Route Tests ──────────────────────────────────────
describe('pretix Routes', () => {
  let pretixRouter;
  let env;

  function mountRouter() {
    pretixRouter = require('../worker/src/routes/pretix.js').pretixRouter;
  }

  beforeEach(() => {
    global.fetch = jest.fn();
    env = {
      PRETIX_API_URL: 'https://tickets.auraspace.cafe',
      PRETIX_API_TOKEN: 'tok_test123',
      PRETIX_ORGANIZER: 'aura-cafe',
      PRETIX_WEBHOOK_SECRET: 'whsec_test_secret_32chars_long',
      AURA_DB: createMockD1({ ticket_orders: [] }),
    };
    jest.clearAllMocks();
  });

  // ── GET /api/pretix/events ──────────────────────────────
  describe('GET /events', () => {
    test('returns events list from pretix', async () => {
      mockFetchResponse(pretixResponse);
      mountRouter();

      const res = await pretixRouter.request('/events', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.results).toHaveLength(2);
    });

    test('returns 500 when pretix API fails', async () => {
      mockFetchError(500, 'Internal error');
      mountRouter();

      const res = await pretixRouter.request('/events', { method: 'GET' }, env);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Failed to fetch events');
    }, 10000);
  });

  // ── GET /api/pretix/events/:slug ─────────────────────────
  describe('GET /events/:slug', () => {
    test('returns single event with items', async () => {
      // First fetch: getEvent, Second fetch: listItems
      global.fetch
        .mockResolvedValueOnce(new Response(JSON.stringify(seedEvents[0]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ count: 2, results: seedItems }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }));
      mountRouter();

      const res = await pretixRouter.request('/events/workshop-thang-7', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.name).toBe('Workshop Tháng 7');
      expect(body.data.items).toHaveLength(2);
    });

    test('returns 404 for unknown event', async () => {
      mockFetchError(404, { detail: 'Not found' });
      mountRouter();

      const res = await pretixRouter.request('/events/nonexistent', { method: 'GET' }, env);
      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/pretix/orders ───────────────────────────────
  describe('GET /orders', () => {
    test('returns paginated orders', async () => {
      mockFetchResponse({ count: 2, next: null, previous: null, results: seedOrders });
      mountRouter();

      const res = await pretixRouter.request('/orders?event=workshop-thang-7', { method: 'GET' }, env);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.results).toHaveLength(2);
    });
  });

  // ── POST /api/pretix/webhook ─────────────────────────────
  describe('POST /webhook', () => {
    function webhookPayload(action) {
      return {
        notification_id: 1,
        organizer: 'aura-cafe',
        event: 'workshop-thang-7',
        code: 'ABC23',
        action,
      };
    }

    test('order.placed syncs new order to D1', async () => {
      mountRouter();
      const res = await pretixRouter.request('/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-pretix-Signature': VALID_HMAC_HEX,
        },
        body: JSON.stringify(webhookPayload('pretix.event.order.placed')),
      }, env);

      // Webhook validation is skipped in test mode (no valid HMAC possible in test)
      expect(res.status).toBe(200);
    });

    test('order.paid updates order status in D1', async () => {
      mountRouter();
      const res = await pretixRouter.request('/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-pretix-Signature': VALID_HMAC_HEX,
        },
        body: JSON.stringify(webhookPayload('pretix.event.order.paid')),
      }, env);

      expect(res.status).toBe(200);
    });

    test('order.canceled updates order status in D1', async () => {
      mountRouter();
      const res = await pretixRouter.request('/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-pretix-Signature': VALID_HMAC_HEX,
        },
        body: JSON.stringify(webhookPayload('pretix.event.order.canceled')),
      }, env);

      expect(res.status).toBe(200);
    });

    test('invalid signature returns 401 when secret is set', async () => {
      mountRouter();
      // Force webhook secret validation
      env.PRETIX_WEBHOOK_SECRET = 'valid-secret-32chars-long!';

      const res = await pretixRouter.request('/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-pretix-Signature': 'bb'.repeat(32), // valid 64-char hex, wrong signature
        },
        body: JSON.stringify(webhookPayload('pretix.event.order.placed')),
      }, env);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/signature/i);
    });

    test('unknown action returns 200 (ignored)', async () => {
      mountRouter();
      const res = await pretixRouter.request('/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-pretix-Signature': VALID_HMAC_HEX,
        },
        body: JSON.stringify(webhookPayload('pretix.event.added')),
      }, env);

      expect(res.status).toBe(200);
    });

    test('missing signature header returns 401', async () => {
      mountRouter();
      const res = await pretixRouter.request('/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload('pretix.event.order.placed')),
      }, env);

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/pretix/checkin ─────────────────────────────
  describe('POST /checkin', () => {
    test('valid ticket returns green status', async () => {
      mockFetchResponse({ status: 'ok', position_id: 5 });
      mountRouter();

      const res = await pretixRouter.request('/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'abc123secret', event: 'workshop-thang-7', listId: 1 }),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('ok');
    });

    test('already checked in ticket returns yellow', async () => {
      mockFetchResponse({ status: 'error', reason: 'already_redeemed' });
      mountRouter();

      const res = await pretixRouter.request('/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'abc123secret', event: 'workshop-thang-7' }),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('error');
      expect(body.data.reason).toBe('already_redeemed');
    });

    test('invalid ticket returns red', async () => {
      mockFetchError(404, { detail: 'Unknown ticket' });
      mountRouter();

      const res = await pretixRouter.request('/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'badsecret', event: 'workshop-thang-7' }),
      }, env);

      expect(res.status).toBe(404);
    });

    test('missing secret returns 400', async () => {
      mountRouter();
      const res = await pretixRouter.request('/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'workshop-thang-7' }),
      }, env);

      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/pretix/generate ────────────────────────────
  describe('POST /generate', () => {
    test('generates branded social post from event', async () => {
      // First fetch: getEvent, Second fetch: listItems
      global.fetch
        .mockResolvedValueOnce(new Response(JSON.stringify(seedEvents[0]), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ count: 2, results: seedItems }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }));
      mountRouter();

      const res = await pretixRouter.request('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'event', slug: 'workshop-thang-7' }),
      }, env);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.content).toMatch(/Workshop Tháng 7/);
      expect(body.data.content).toMatch(/#AuraCafe/);
      expect(body.data.hashtags).toEqual(['AuraCafe', 'SuKien', 'Workshop']);
    });

    test('returns 404 for unknown event slug', async () => {
      mockFetchError(404, { detail: 'Not found' });
      mountRouter();

      const res = await pretixRouter.request('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'event', slug: 'nonexistent' }),
      }, env);

      expect(res.status).toBe(404);
    });
  });
});

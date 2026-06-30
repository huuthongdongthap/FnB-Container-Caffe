/**
 * Cal.com Booking Webhook Tests — TDD (Phase 01)
 *
 * Tests for POST /api/webhooks/cal-booking webhook receiver.
 * Strategy: write tests BEFORE implementation, verify RED → GREEN.
 */

const { test, expect, describe, beforeEach } = require('@jest/globals');

// ═══════════════════════════════════════════════════════════════════
// Mock D1 + KV
// ═══════════════════════════════════════════════════════════════════

function createMockD1(tables = {}) {
  const data = {
    cafe_tables: tables.cafe_tables || [
      { id: 'T1', table_number: 1, zone: 'Trong nha', capacity: 4, status: 'Available' },
      { id: 'T2', table_number: 2, zone: 'Trong nha', capacity: 2, status: 'Available' },
      { id: 'T3', table_number: 3, zone: 'Ngoai troi', capacity: 6, status: 'Available' },
      { id: 'T4', table_number: 4, zone: 'Ngoai troi', capacity: 4, status: 'Reserved' },
    ],
    reservations: tables.reservations || [],
  };

  const db = {
    prepare: jest.fn((sql) => {
      let _bindValues = [];
      const stmt = {
        bind: jest.fn(function (...vals) { _bindValues = vals; return this; }),
        first: jest.fn(async function () {
          if (sql.includes('cafe_tables')) {
            const idVal = _bindValues[0];
            return data.cafe_tables.find(t => t.id === idVal) || null;
          }
          if (sql.includes('reservations') && sql.includes('cal_booking_uid')) {
            const uid = _bindValues[0];
            return data.reservations.find(r => r.cal_booking_uid === uid) || null;
          }
          if (sql.includes('reservations') && sql.includes('table_id') && !sql.includes('cal_booking_uid')) {
            const [tableId, date, time] = _bindValues;
            return data.reservations.find(r =>
              r.table_id === tableId && r.date === date && r.time === time && r.status === 'confirmed'
            ) || null;
          }
          return null;
        }),
        all: jest.fn(async function () {
          if (sql.includes('cafe_tables') && sql.includes('capacity')) {
            const minSeats = _bindValues[0];
            return { results: data.cafe_tables.filter(t => t.capacity >= minSeats && t.status === 'Available') };
          }
          return { results: [] };
        }),
        run: jest.fn(async function () {
          if (sql.includes('INSERT INTO reservations')) {
            const id = _bindValues[0];
            data.reservations.push({
              id,
              table_id: _bindValues[1],
              customer_name: _bindValues[2],
              customer_phone: _bindValues[3],
              guest_count: _bindValues[4],
              date: _bindValues[5],
              time: _bindValues[6],
              zone: _bindValues[7],
              notes: _bindValues[8],
              cal_booking_uid: _bindValues[9],
              status: 'confirmed',
            });
            return { changes: 1 };
          }
          if (sql.includes('UPDATE cafe_tables')) return { changes: 1 };
          if (sql.includes('UPDATE reservations') && sql.includes('cancelled')) {
            const id = _bindValues[1];
            const rsv = data.reservations.find(r => r.id === id);
            if (rsv) { rsv.status = 'cancelled'; }
            return { changes: 1 };
          }
          return { changes: 0 };
        }),
      };
      return stmt;
    }),
  };
  return db;
}

function createMockEnv(overrides = {}) {
  return {
    AURA_DB: createMockD1(),
    AUTH_KV: { get: jest.fn().mockResolvedValue(null), put: jest.fn().mockResolvedValue(undefined) },
    CAL_WEBHOOK_SECRET: 'whsec_test_abc123',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function createRequest({ secret, body }) {
  return {
    headers: {
      get: (name) => name === 'x-cal-webhook-secret' ? secret : null,
    },
    json: async () => body,
    method: 'POST',
    url: 'https://test.worker.dev/api/webhooks/cal-booking',
  };
}

// Sample Cal.com webhook payload
function sampleBookingPayload(overrides = {}) {
  return {
    triggerEvent: 'BOOKING_CREATED',
    payload: {
      uid: 'cal_booking_001',
      title: 'Đặt Bàn — Aura Cafe',
      startTime: '2026-07-01T18:00:00+07:00',
      endTime: '2026-07-01T19:00:00+07:00',
      attendees: [
        { name: 'Nguyễn Văn A', email: 'a@example.com', phone: '0909123456', timeZone: 'Asia/Saigon' },
        { name: 'Guest 2', email: '', phone: '', timeZone: 'Asia/Saigon' },
      ],
      metadata: { guest_count: 4, zone: 'Trong nha' },
      ...overrides,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════

describe('Cal.com Booking Webhook', () => {
  let handleCalBookingWebhook;

  beforeAll(() => {
    try {
      const mod = require('../worker/src/routes/cal-booking-webhook.js');
      handleCalBookingWebhook = mod.handleCalBookingWebhook;
    } catch (e) {
      // TDD: handler doesn't exist yet — tests will fail (RED)
      handleCalBookingWebhook = null;
    }
  });

  // ── Test 1: Valid booking.created → 200 ──
  test('should create reservation on valid BOOKING_CREATED webhook', async () => {
    if (!handleCalBookingWebhook) throw new Error('TDD RED: handler not implemented yet');

    const env = createMockEnv();
    const req = createRequest({
      secret: 'whsec_test_abc123',
      body: sampleBookingPayload(),
    });

    const res = await handleCalBookingWebhook(req, env);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.reservation).toBeDefined();
    expect(data.reservation.table_id).toBeDefined();
    expect(data.reservation.guest_count).toBe(4);
    expect(data.reservation.status).toBe('confirmed');
  });

  // ── Test 2: Missing webhook secret → 401 ──
  test('should return 401 when webhook secret is missing', async () => {
    if (!handleCalBookingWebhook) throw new Error('TDD RED: handler not implemented yet');

    const env = createMockEnv();
    const req = createRequest({ secret: null, body: sampleBookingPayload() });

    const res = await handleCalBookingWebhook(req, env);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
  });

  // ── Test 3: Invalid webhook secret → 401 ──
  test('should return 401 when webhook secret is wrong', async () => {
    if (!handleCalBookingWebhook) throw new Error('TDD RED: handler not implemented yet');

    const env = createMockEnv();
    const req = createRequest({ secret: 'wrong_secret', body: sampleBookingPayload() });

    const res = await handleCalBookingWebhook(req, env);
    expect(res.status).toBe(401);
  });

  // ── Test 4: Invalid payload → 400 ──
  test('should return 400 when payload is missing required fields', async () => {
    if (!handleCalBookingWebhook) throw new Error('TDD RED: handler not implemented yet');

    const env = createMockEnv();
    const req = createRequest({
      secret: 'whsec_test_abc123',
      body: { triggerEvent: 'BOOKING_CREATED', payload: null },
    });

    const res = await handleCalBookingWebhook(req, env);
    expect(res.status).toBe(400);
  });

  // ── Test 5: No available tables → 409 ──
  test('should return 409 when no tables available', async () => {
    if (!handleCalBookingWebhook) throw new Error('TDD RED: handler not implemented yet');

    const env = createMockEnv({
      AURA_DB: createMockD1({
        cafe_tables: [
          { id: 'T1', table_number: 1, zone: 'Trong nha', capacity: 4, status: 'Reserved' },
          { id: 'T2', table_number: 2, zone: 'Trong nha', capacity: 2, status: 'Reserved' },
        ],
      }),
      CAL_WEBHOOK_SECRET: 'whsec_test_abc123',
    });

    const req = createRequest({
      secret: 'whsec_test_abc123',
      body: sampleBookingPayload({
        uid: 'cal_booking_005',
        attendees: [{ name: 'A', email: 'a@x.com', phone: '', timeZone: 'Asia/Saigon' }],
        metadata: { guest_count: 2 },
      }),
    });

    const res = await handleCalBookingWebhook(req, env);
    expect(res.status).toBe(409);
  });

  // ── Test 6: Duplicate booking (idempotent) → 200 ──
  test('should handle duplicate webhook idempotently', async () => {
    if (!handleCalBookingWebhook) throw new Error('TDD RED: handler not implemented yet');

    const env = createMockEnv();
    const payload = sampleBookingPayload();
    const req1 = createRequest({ secret: 'whsec_test_abc123', body: payload });
    const req2 = createRequest({ secret: 'whsec_test_abc123', body: payload });

    const res1 = await handleCalBookingWebhook(req1, env);
    expect(res1.status).toBe(201);

    const res2 = await handleCalBookingWebhook(req2, env);
    expect(res2.status).toBe(200); // Already exists
    const data2 = await res2.json();
    expect(data2.idempotent).toBe(true);
  });

  // ── Test 7: Booking cancelled → updates status ──
  test('should cancel reservation on BOOKING_CANCELLED webhook', async () => {
    if (!handleCalBookingWebhook) throw new Error('TDD RED: handler not implemented yet');

    const env = createMockEnv();
    // First create
    const createReq = createRequest({
      secret: 'whsec_test_abc123',
      body: sampleBookingPayload(),
    });
    await handleCalBookingWebhook(createReq, env);

    // Then cancel
    const cancelReq = createRequest({
      secret: 'whsec_test_abc123',
      body: {
        triggerEvent: 'BOOKING_CANCELLED',
        payload: { uid: 'cal_booking_001' },
      },
    });

    const res = await handleCalBookingWebhook(cancelReq, env);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cancelled).toBe(true);
  });

  // ── Test 8: Table assignment prefers zone match ──
  test('should prefer table in matching zone', async () => {
    if (!handleCalBookingWebhook) throw new Error('TDD RED: handler not implemented yet');

    const env = createMockEnv();
    const req = createRequest({
      secret: 'whsec_test_abc123',
      body: sampleBookingPayload({
        uid: 'cal_booking_008',
        metadata: { guest_count: 6, zone: 'Ngoai troi' },
      }),
    });

    const res = await handleCalBookingWebhook(req, env);
    const data = await res.json();

    expect(res.status).toBe(201);
    // Should assign T3 (Ngoai troi, 6 seats) not T1 (Trong nha, 4 seats)
    expect(data.reservation.table_id).toBe('T3');
    expect(data.reservation.zone).toBe('Ngoai troi');
  });
});

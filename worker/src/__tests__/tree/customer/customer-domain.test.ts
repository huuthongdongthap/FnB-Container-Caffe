/** Customer domain — identifyCustomer / recordConsent / recordVisit / linkOrder */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Silence logger
vi.mock('../../../middleware/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => ({}) })
}));

import { identifyCustomer } from '../../../tree/customer/identify-customer';
import { recordConsent, hasActiveConsent } from '../../../tree/customer/record-consent';
import { recordVisit } from '../../../tree/customer/record-visit';
import { linkOrder } from '../../../tree/customer/link-order';
import { classifyIdentifier, normalizePhone, isPlausibleVnPhone } from '../../../tree/customer/helpers';

// ── Mock D1 (captures SQL + binds) ────────────────────────────────────────────
type Row = Record<string, unknown>;

function createMockDB(seed: Record<string, Row[]> = {}) {
  const store = new Map<string, Row[]>(Object.entries(seed));
  const executed: Array<{ sql: string; args: unknown[] }> = [];

  return {
    _store: store,
    executed,
    asD1() {
      const self = this;
      return {
        prepare(sql: string) {
          const entry = self.executed;
          return {
            bind(...args: unknown[]) {
              entry.push({ sql, args });
              return this;
            },
            first<T = unknown>(): Promise<T | null> {
              const rows = self._store.get(sql) || [];
              if (rows.length > 0) {
                return Promise.resolve(rows.shift() as T);
              }
              return Promise.resolve(null);
            },
            all<T = unknown>() {
              return Promise.resolve({ results: [] as T[], success: true } as never);
            },
            run() {
              return Promise.resolve({ success: true, changes: 1 } as never);
            }
          };
        },
        batch() {
          return Promise.resolve([{ success: true, changes: 1 }] as never);
        }
      } as never;
    }
  } as never;
}

const CUST_ID = 'cus_test_1';

function insertSqlFor(table: string): string {
  return expect.stringMatching(new RegExp(`INSERT INTO ${table}`));
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── helpers ──────────────────────────────────────────────────────────────────
describe('customer helpers', () => {
  it('normalizes phone to digits', () => {
    expect(normalizePhone(' 0909-123-456 ')).toBe('0909123456');
    expect(normalizePhone('+84909123456')).toBe('84909123456');
    expect(normalizePhone(null)).toBe('');
  });

  it('accepts plausible VN phone lengths only', () => {
    expect(isPlausibleVnPhone('0909123456')).toBe(true);
    expect(isPlausibleVnPhone('12345')).toBe(false);
    expect(isPlausibleVnPhone('090912345678999')).toBe(false);
  });

  it('classifies phone over email, skips synthetic loyalty emails', () => {
    expect(classifyIdentifier('0909123456', null, null)).toEqual({ type: 'phone', value: '0909123456' });
    expect(classifyIdentifier(null, 'Real@Mail.com', null)).toEqual({ type: 'email', value: 'real@mail.com' });
    expect(classifyIdentifier('0909123456', '0909123456@loyalty.aura', null))
      .toEqual({ type: 'phone', value: '0909123456' });
    expect(classifyIdentifier(null, null, null)).toBeNull();
    expect(classifyIdentifier('123', null, null)).toBeNull();
  });
});

// ── identifyCustomer ──────────────────────────────────────────────────────────
describe('identifyCustomer', () => {
  it('captures a new phone identity as primary and emits CustomerIdentified', async () => {
    const mock = createMockDB(); // empty store: no existing identity, no prior row
    const db = mock.asD1();

    const identity = await identifyCustomer({
      db, customerId: CUST_ID, phone: '0909-123-456', source: 'checkout'
    });

    expect(identity).not.toBeNull();
    expect(identity!.identifier_type).toBe('phone');
    expect(identity!.identifier_value).toBe('0909123456');
    expect(identity!.is_primary).toBe(1);
    expect(identity!.created).toBe(true);

    const inserts = mock.executed.filter(e => e.sql.includes('INSERT INTO customer_identities'));
    expect(inserts.length).toBe(1);

    const events = mock.executed.filter(e => e.sql.includes('INSERT INTO customer_events'));
    expect(events.length).toBe(1);
    expect(String(events[0].args[2])).toBe('CustomerIdentified');
  });

  it('returns existing identity without duplicate write (idempotent)', async () => {
    const existingSql = 'SELECT id, is_primary FROM customer_identities WHERE customer_id = ? AND identifier_type = ? AND identifier_value = ? LIMIT 1';
    const mock = createMockDB({
      [existingSql]: [{ id: 'cid_exists', is_primary: 1 }]
    });
    const db = mock.asD1();

    const identity = await identifyCustomer({
      db, customerId: CUST_ID, phone: '0909123456', source: 'checkout'
    });

    expect(identity!.id).toBe('cid_exists');
    expect(identity!.created).toBe(false);
    expect(mock.executed.filter(e => e.sql.includes('INSERT INTO customer_identities')).length).toBe(0);
  });

  it('second identifier for same customer is not primary', async () => {
    // First SELECT (existing pair) → null; second SELECT (any row) → found → is_primary = 0
    const pairSql = 'SELECT id, is_primary FROM customer_identities WHERE customer_id = ? AND identifier_type = ? AND identifier_value = ? LIMIT 1';
    const anySql = 'SELECT id FROM customer_identities WHERE customer_id = ? LIMIT 1';
    const mock = createMockDB({
      [pairSql]: [],            // no existing pair
      [anySql]: [{ id: 'cid_first' }] // customer already has one identity
    });
    const db = mock.asD1();

    const identity = await identifyCustomer({
      db, customerId: CUST_ID, email: 'real@mail.com', source: 'checkout'
    });

    expect(identity!.is_primary).toBe(0);
    expect(identity!.created).toBe(true);
  });

  it('returns null when no plausible identifier (anonymous checkout)', async () => {
    const mock = createMockDB();
    const identity = await identifyCustomer({
      db: mock.asD1(), customerId: CUST_ID, source: 'checkout'
    });
    expect(identity).toBeNull();
    expect(mock.executed.length).toBe(0);
  });

  it('swallows DB errors (never breaks checkout)', async () => {
    const db = {
      prepare() {
        return {
          bind() { return this; },
          first() { return Promise.reject(new Error('D1 down')); },
          run() { return Promise.reject(new Error('D1 down')); }
        };
      }
    } as never;
    const identity = await identifyCustomer({
      db, customerId: CUST_ID, phone: '0909123456', source: 'checkout'
    });
    expect(identity).toBeNull(); // logged, not thrown
  });
});

// ── recordConsent ─────────────────────────────────────────────────────────────
describe('recordConsent', () => {
  const activeSql = 'SELECT id, granted FROM consents WHERE customer_id = ? AND purpose = ? AND revoked_at IS NULL ORDER BY granted_at DESC LIMIT 1';

  it('writes a granted consent + ConsentGiven event', async () => {
    const mock = createMockDB();
    const result = await recordConsent({
      db: mock.asD1(), customerId: CUST_ID,
      purpose: 'marketing', granted: true, source: 'checkout'
    });
    expect(result.ok).toBe(true);

    const consentInserts = mock.executed.filter(e => e.sql.includes('INSERT INTO consents'));
    expect(consentInserts.length).toBe(1);
    expect(consentInserts[0].args[2]).toBe('marketing');
    expect(consentInserts[0].args[3]).toBe(1);   // granted
    expect(consentInserts[0].args[4]).toBe('checkout');

    const events = mock.executed.filter(e => e.sql.includes('INSERT INTO customer_events'));
    expect(String(events[0].args[2])).toBe('ConsentGiven');
  });

  it('is idempotent when same grant state already active', async () => {
    const mock = createMockDB({
      [activeSql]: [{ id: 'con_1', granted: 1 }]
    });
    const result = await recordConsent({
      db: mock.asD1(), customerId: CUST_ID,
      purpose: 'marketing', granted: true, source: 'checkout'
    });
    expect(result.ok).toBe(true);
    expect(result.consentId).toBe('con_1');
    expect(mock.executed.filter(e => e.sql.includes('INSERT INTO consents')).length).toBe(0);
  });

  it('revokes active consent then inserts a new revoked row + ConsentRevoked event', async () => {
    const mock = createMockDB({
      [activeSql]: [{ id: 'con_1', granted: 1 }]
    });
    const result = await recordConsent({
      db: mock.asD1(), customerId: CUST_ID,
      purpose: 'marketing', granted: false, source: 'setting'
    });
    expect(result.ok).toBe(true);

    const revokeUpdate = mock.executed.find(e => e.sql.includes('UPDATE consents SET revoked_at'));
    expect(revokeUpdate).toBeDefined();
    expect(revokeUpdate!.args[1]).toBe('con_1');

    const insert = mock.executed.filter(e => e.sql.includes('INSERT INTO consents'))[0];
    expect(insert.args[3]).toBe(0);   // granted = 0

    const events = mock.executed.filter(e => e.sql.includes('INSERT INTO customer_events'));
    expect(String(events[0].args[2])).toBe('ConsentRevoked');
  });

  it('hasActiveConsent reads granted+active row only', async () => {
    const checkSql = 'SELECT id FROM consents WHERE customer_id = ? AND purpose = ? AND granted = 1 AND revoked_at IS NULL LIMIT 1';
    const yes = createMockDB({ [checkSql]: [{ id: 'con_1' }] });
    const no = createMockDB({ [checkSql]: [] });
    expect(await hasActiveConsent(yes.asD1(), CUST_ID, 'crm')).toBe(true);
    expect(await hasActiveConsent(no.asD1(), CUST_ID, 'crm')).toBe(false);
  });
});

// ── recordVisit ───────────────────────────────────────────────────────────────
describe('recordVisit', () => {
  it('writes visit + VisitRecorded event with defaults', async () => {
    const mock = createMockDB();
    const result = await recordVisit({
      db: mock.asD1(), customerId: CUST_ID
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);

    const visitInsert = mock.executed.filter(e => e.sql.includes('INSERT INTO visits'))[0];
    expect(visitInsert.args[1]).toBe(CUST_ID);
    expect(visitInsert.args[3]).toBe('in_store');   // default channel
    expect(visitInsert.args[5]).toBe(null);        // spent optional

    const events = mock.executed.filter(e => e.sql.includes('INSERT INTO customer_events'));
    expect(String(events[0].args[2])).toBe('VisitRecorded');
  });

  it('is idempotent per order_id (skip when visit exists)', async () => {
    const dupSql = 'SELECT id FROM visits WHERE order_id = ? LIMIT 1';
    const mock = createMockDB({ [dupSql]: [{ id: 'vis_1' }] });
    const result = await recordVisit({
      db: mock.asD1(), customerId: CUST_ID, orderId: 'ORD_1', spent: 55000, channel: 'qr_table'
    });
    expect(result.created).toBe(false);
    expect(result.visitId).toBe('vis_1');
    expect(mock.executed.filter(e => e.sql.includes('INSERT INTO visits')).length).toBe(0);
  });
});

// ── linkOrder ─────────────────────────────────────────────────────────────────
describe('linkOrder', () => {
  it('appends an OrderLinked event once', async () => {
    const mock = createMockDB();
    const result = await linkOrder({
      db: mock.asD1(), customerId: CUST_ID, orderId: 'ORD_1', total: 55000, orderType: 'dine_in'
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);

    const events = mock.executed.filter(e => e.sql.includes('INSERT INTO customer_events'));
    expect(events.length).toBe(1);
    expect(String(events[0].args[2])).toBe('OrderLinked');
    const payload = JSON.parse(String(events[0].args[3]));
    expect(payload.order_id).toBe('ORD_1');
    expect(payload.total).toBe(55000);
  });

  it('skips when the pair is already linked (idempotent)', async () => {
    const dupSql = "SELECT id FROM customer_events WHERE customer_id = ? AND event_type = 'OrderLinked' AND payload LIKE ? LIMIT 1";
    const mock = createMockDB({ [dupSql]: [{ id: 'cev_1' }] });
    const result = await linkOrder({
      db: mock.asD1(), customerId: CUST_ID, orderId: 'ORD_1'
    });
    expect(result.created).toBe(false);
    expect(mock.executed.filter(e => e.sql.includes('INSERT INTO customer_events')).length).toBe(0);
  });
});

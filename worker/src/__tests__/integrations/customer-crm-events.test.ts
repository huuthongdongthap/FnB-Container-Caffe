/**
 * Customer / CRM Event Contract Integration Tests
 * Canonical Flow: ORDER → CUSTOMER IDENTITY → DOMAIN EVENT → CUSTOMER EVENT → CRM
 * Verifies all 8 Invariant Requirements.
 */
import { describe, it, expect } from 'vitest';
import {
  dispatchCustomerEvent,
  sanitizeCustomerEventPayload,
  createCanonicalCustomerEvent,
} from '@aura/domain-customer';
import { consumeCrmEvent, replayCustomerEvents } from '@aura/domain-crm';

describe('Customer / CRM Event Contract', () => {
  function createMockDb() {
    const events: any[] = [];
    const visits: any[] = [];
    const transactions: any[] = [];

    const db = {
      events, visits, transactions,
      prepare: (sql: string) => {
        let binds: unknown[] = [];
        const stmt = {
          bind: (...args: unknown[]) => { binds = args; return stmt; },
          first: async <T = unknown>() => {
            if (sql.includes('FROM customer_events WHERE payload LIKE')) {
              const k = (binds[0] as string).replace(/%/g, '').split(':')[1] || '';
              const found = events.find(e => e.payload.includes(k));
              return (found ? { id: found.id } : null) as T;
            }
            if (sql.includes('FROM visits WHERE order_id =')) {
              const found = visits.find(v => v.order_id === binds[0]);
              return (found ? { id: found.id } : null) as T;
            }
            if (sql.includes('FROM cashback_transactions WHERE order_id =')) {
              return (transactions.find(t => t.order_id === binds[0]) ? { id: 'tx_1' } : null) as T;
            }
            if (sql.includes('FROM loyalty_tiers')) return { name: 'bronze', cashback_rate: 0.03 } as T;
            if (sql.includes('FROM customers WHERE id =')) return { id: binds[0], total_points: 10 } as T;
            return null as T;
          },
          all: async () => ({ results: [] }),
          run: async () => {
            if (sql.includes('INSERT INTO customer_events')) events.push({ id: binds[0], customer_id: binds[1], event_type: binds[2], payload: binds[3], recorded_at: binds[4] });
            if (sql.includes('INSERT INTO visits')) visits.push({ id: binds[0], customer_id: binds[1], visited_at: binds[2], channel: binds[3], order_id: binds[4], spent: binds[5] });
            if (sql.includes('UPDATE visits SET customer_id = ? WHERE order_id = ?')) {
              const v = visits.find(x => x.order_id === binds[1]);
              if (v) v.customer_id = binds[0];
            }
            return { success: true };
          },
        };
        return stmt as any;
      },
    };
    return db;
  }

  it('1. order → event: Emits canonical order_created event with server timestamp', async () => {
    const db = createMockDb();
    const res = await dispatchCustomerEvent({
      db: db as any, eventType: 'order_created', customerId: 'cust_alice', orderId: 'ORD_001',
      payload: { orderId: 'ORD_001', totalAmount: 55000, channel: 'in_store' },
      idempotencyKey: 'order_created:ORD_001:cust_alice',
    });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(true);
    expect(db.events[0].event_type).toBe('order_created');
    expect(db.events[0].customer_id).toBe('cust_alice');
  });

  it('2. guest → customer event: Guest order tracks anonymously, claims via customer_linked', async () => {
    const db = createMockDb();
    await dispatchCustomerEvent({
      db: db as any, eventType: 'order_created', customerId: null, orderId: 'ORD_GUEST_1',
      payload: { orderId: 'ORD_GUEST_1', totalAmount: 40000, channel: 'qr_table' },
      idempotencyKey: 'order_created:ORD_GUEST_1:guest',
    });
    expect(db.events[0].customer_id).toBe('guest');

    const claimRes = await dispatchCustomerEvent({
      db: db as any, eventType: 'customer_linked', customerId: 'cust_bob', orderId: 'ORD_GUEST_1',
      payload: { orderId: 'ORD_GUEST_1', customerId: 'cust_bob', previousCustomerId: null, totalAmount: 40000 },
      idempotencyKey: 'customer_linked:ORD_GUEST_1:cust_bob',
    });
    expect(claimRes.ok).toBe(true);
    expect(db.events[1].event_type).toBe('customer_linked');
    expect(db.events[1].customer_id).toBe('cust_bob');
  });

  it('3. completed order → CRM activity: Triggers visit recording & loyalty', async () => {
    const db = createMockDb();
    const res = await dispatchCustomerEvent({
      db: db as any, eventType: 'order_completed', customerId: 'cust_carol', orderId: 'ORD_COMP_1',
      payload: { orderId: 'ORD_COMP_1', totalAmount: 75000, channel: 'in_store' },
    });
    expect(res.ok).toBe(true);
    expect(db.visits).toHaveLength(1);
    expect(db.visits[0].spent).toBe(75000);
  });

  it('4. duplicate event: Idempotency key prevents duplicate event logging', async () => {
    const db = createMockDb();
    const input = {
      db: db as any, eventType: 'order_paid' as const, customerId: 'cust_dave', orderId: 'ORD_DUP_1',
      payload: { orderId: 'ORD_DUP_1', totalAmount: 60000 }, idempotencyKey: 'order_paid:ORD_DUP_1',
    };
    const first = await dispatchCustomerEvent(input);
    expect(first.created).toBe(true);
    const second = await dispatchCustomerEvent(input);
    expect(second.created).toBe(false);
    expect(db.events).toHaveLength(1);
  });

  it('5. replay/reprocess: Replaying events does not duplicate visits', async () => {
    const db = createMockDb();
    const ev = createCanonicalCustomerEvent({
      eventType: 'order_completed', customerId: 'cust_eve', orderId: 'ORD_REPLAY_1',
      payload: { orderId: 'ORD_REPLAY_1', totalAmount: 80000, channel: 'in_store' },
    });
    await consumeCrmEvent({ db: db as any, event: ev });
    expect(db.visits).toHaveLength(1);

    const replayRes = await replayCustomerEvents({ db: db as any, events: [ev] });
    expect(replayRes.total).toBe(1);
    expect(db.visits).toHaveLength(1);
  });

  it('6. CRM failure isolation: CRM failure does not throw or abort transaction', async () => {
    const db = createMockDb();
    const failingDb = {
      ...db,
      prepare: (sql: string) => {
        if (sql.includes('INSERT INTO visits') || sql.includes('FROM loyalty_tiers')) throw new Error('D1 timeout');
        return db.prepare(sql);
      },
    };
    const res = await dispatchCustomerEvent({
      db: failingDb as any, eventType: 'order_completed', customerId: 'cust_frank', orderId: 'ORD_FAIL_1',
      payload: { orderId: 'ORD_FAIL_1', totalAmount: 50000 },
    });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(true);
    expect(res.crmResult?.ok).toBe(false);
  });

  it('7. event payload safety: Strips internal cost and secrets', () => {
    const raw = {
      orderId: 'ORD_SAFE_1', totalAmount: 100000, cost_price: 35000, margin: 65000,
      secret_token: 'leak_token_xyz', supplier: 'Viva Star',
    };
    const clean = sanitizeCustomerEventPayload('order_created', raw as any);
    expect(clean.orderId).toBe('ORD_SAFE_1');
    expect(clean.v).toBe(1);
    expect((clean as any).cost_price).toBeUndefined();
    expect((clean as any).margin).toBeUndefined();
    expect((clean as any).secret_token).toBeUndefined();
  });

  it('8. historical immutability: Append-only event log retains all mutations', async () => {
    const db = createMockDb();
    await dispatchCustomerEvent({
      db: db as any, eventType: 'order_created', customerId: 'cust_grace', orderId: 'ORD_HIST_1',
      payload: { totalAmount: 90000 }, idempotencyKey: 'hist_created',
    });
    await dispatchCustomerEvent({
      db: db as any, eventType: 'order_paid', customerId: 'cust_grace', orderId: 'ORD_HIST_1',
      payload: { totalAmount: 90000 }, idempotencyKey: 'hist_paid',
    });
    await dispatchCustomerEvent({
      db: db as any, eventType: 'order_completed', customerId: 'cust_grace', orderId: 'ORD_HIST_1',
      payload: { totalAmount: 90000 }, idempotencyKey: 'hist_completed',
    });

    expect(db.events.length).toBeGreaterThanOrEqual(3);
    const eventTypes = db.events.map(e => e.event_type);
    expect(eventTypes).toContain('order_created');
    expect(eventTypes).toContain('order_paid');
    expect(eventTypes).toContain('order_completed');
  });
});

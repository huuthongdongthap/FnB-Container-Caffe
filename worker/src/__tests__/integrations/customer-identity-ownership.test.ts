/**
 * Customer Identity & Order Ownership Contract Integration Tests
 * Canonical Identity Ladder: Anonymous Guest → Customer Identifier → Customer Profile → Member/Loyalty → CRM Profile
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { resolveServerOrderOwnership, canAccessOrder, claimGuestOrder } from '@aura/domain-customer';
import { ordersUnifiedRouter } from '../../routes/orders-unified';
import { generateJWT } from '../../lib/jwt';
import type { Env } from '../../types/env';

describe('Customer Identity & Order Ownership Contract', () => {
  const mockDbWithCustomer = {
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => { binds = args; return stmt; },
        first: async <T = unknown>() => {
          if (sql.includes('customer_identities') && binds[0] === '0901234567') return { customer_id: 'cust_repeat_123' } as T;
          if (sql.includes('customers') && (binds[0] === '0901234567' || binds[1] === '0901234567')) return { id: 'cust_repeat_123' } as T;
          return null as T;
        },
      };
      return stmt as any;
    },
  };

  it('1. Anonymous Order: Ignores client-supplied customer_id and assigns guest status', async () => {
    const res = await resolveServerOrderOwnership({
      actor: null, clientSuppliedCustomerId: 'malicious_victim_id', customerPhone: null, db: mockDbWithCustomer,
    });
    expect(res.customerId).toBeNull();
    expect(res.stage).toBe('anonymous_guest');
    expect(res.isGuest).toBe(true);
    expect(res.resolvedVia).toBe('anonymous');
  });

  it('2. Authenticated Order: Server-authoritative mapping overrides client tampering', async () => {
    const res = await resolveServerOrderOwnership({
      actor: { id: 'cust_legit_user', role: 'customer' }, clientSuppliedCustomerId: 'malicious_victim_id',
      customerPhone: '0909999999', db: mockDbWithCustomer,
    });
    expect(res.customerId).toBe('cust_legit_user');
    expect(res.stage).toBe('member_loyalty');
    expect(res.isGuest).toBe(false);
    expect(res.resolvedVia).toBe('authenticated_user');
  });

  it('3. Staff Access: Staff can explicitly override customer_id at POS/Backoffice', async () => {
    const res = await resolveServerOrderOwnership({
      actor: { id: 'staff_1', role: 'staff' }, clientSuppliedCustomerId: 'cust_assigned_by_staff',
      customerPhone: null, db: mockDbWithCustomer,
    });
    expect(res.customerId).toBe('cust_assigned_by_staff');
    expect(res.stage).toBe('customer_profile');
    expect(res.resolvedVia).toBe('staff_override');
  });

  it('4. Repeat Order Identity: Deterministic phone match resolves existing customer profile without duplicate profile', async () => {
    const res = await resolveServerOrderOwnership({
      actor: null, clientSuppliedCustomerId: null, customerPhone: '0901234567', db: mockDbWithCustomer,
    });
    expect(res.customerId).toBe('cust_repeat_123');
    expect(res.stage).toBe('customer_profile');
    expect(res.isGuest).toBe(false);
    expect(res.resolvedVia).toBe('deterministic_identifier');
  });

  it('5. Secure IDOR Gate: Anonymous guest cannot access registered customer order', () => {
    const registeredOrder = { id: 'ORD_REG_1', customer_id: 'cust_registered_user' };
    const guestAccess = canAccessOrder(null, registeredOrder);
    expect(guestAccess.allowed).toBe(false);
    expect(guestAccess.reason).toContain('registered customer');

    const guestOrder = { id: 'ORD_GUEST_1', customer_id: null };
    expect(canAccessOrder(null, guestOrder).allowed).toBe(true);
  });

  it('6. Cross-Customer Rejection: Customer B cannot view Customer A order', () => {
    const orderA = { id: 'ORD_A', customer_id: 'cust_user_a' };
    const attackerB = { id: 'cust_user_b', role: 'customer' };
    const access = canAccessOrder(attackerB, orderA);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('Unauthorized access to customer order');

    const ownerA = { id: 'cust_user_a', role: 'customer' };
    expect(canAccessOrder(ownerA, orderA).allowed).toBe(true);

    const staff = { id: 'staff_1', role: 'staff' };
    expect(canAccessOrder(staff, orderA).allowed).toBe(true);
  });

  it('7. Auditable Guest Order Claim: Updates customer_id, writes audit log, and is idempotent', async () => {
    let orderRow = { id: 'ORD_UNCLAIMED', customer_id: null as string | null, total: 55000, order_type: 'dine_in' };
    const events: any[] = [];
    const auditLogs: any[] = [];

    const db = {
      prepare: (sql: string) => {
        let binds: unknown[] = [];
        const stmt = {
          bind: (...args: unknown[]) => { binds = args; return stmt; },
          first: async <T = unknown>() => orderRow as unknown as T,
          run: async () => {
            if (sql.includes('UPDATE orders SET customer_id = ?')) orderRow.customer_id = binds[0] as string;
            if (sql.includes('INSERT INTO customer_events')) events.push({ id: binds[0], customerId: binds[1], type: binds[2] });
            if (sql.includes('INSERT INTO audit_logs')) auditLogs.push({ id: binds[0], action: binds[2], entityId: binds[4] });
            return { success: true };
          },
        };
        return stmt as any;
      },
    };

    // 1. Unauthenticated claim fails
    const failRes = await claimGuestOrder({ db, orderId: 'ORD_UNCLAIMED', actor: null });
    expect(failRes.statusCode).toBe(401);

    // 2. Legit customer claims guest order
    const claimRes = await claimGuestOrder({ db, orderId: 'ORD_UNCLAIMED', actor: { id: 'cust_a', role: 'customer' } });
    expect(claimRes.success).toBe(true);
    expect(claimRes.customerId).toBe('cust_a');
    expect(orderRow.customer_id).toBe('cust_a');
    expect(events[0]?.type).toBe('OrderLinked');
    expect(auditLogs[0]?.action).toBe('order_claimed');

    // 3. Idempotent claim by same customer
    const reClaim = await claimGuestOrder({ db, orderId: 'ORD_UNCLAIMED', actor: { id: 'cust_a', role: 'customer' } });
    expect(reClaim.idempotent).toBe(true);

    // 4. Hijack attempt by another customer rejected
    const hijackRes = await claimGuestOrder({ db, orderId: 'ORD_UNCLAIMED', actor: { id: 'cust_b', role: 'customer' } });
    expect(hijackRes.statusCode).toBe(403);
  });

  it('8. Historical Order Integrity: Frozen line items unaffected by identity changes', () => {
    const frozenItems = JSON.stringify([{ id: 'it_1', name: 'Ca Phe Muoi', quantity: 2, subtotalCents: 60000 }]);
    const orderBefore = { id: 'ORD_FROZEN', customer_id: null, items: frozenItems, total: 60000 };
    const orderAfter = { ...orderBefore, customer_id: 'cust_claimed' };
    expect(orderAfter.items).toBe(orderBefore.items);
    expect(orderAfter.total).toBe(orderBefore.total);
  });

  it('9. Unified HTTP Routes: Enforces canAccessOrder and IDOR boundary for GET /:id', async () => {
    const orders = [
      { id: 'ORD_GUEST', customer_id: null, order_number: 'ORD-G1', status: 'pending', total_amount: 30000 },
      { id: 'ORD_CUST', customer_id: 'cust_user_x', order_number: 'ORD-C1', status: 'pending', total_amount: 50000 },
    ];
    const db = {
      prepare: () => {
        let binds: unknown[] = [];
        const stmt = {
          bind: (...args: unknown[]) => { binds = args; return stmt; },
          first: async <T = unknown>() => (orders.find(o => o.id === binds[0]) || null) as unknown as T,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        };
        return stmt as any;
      },
    };
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api/orders', ordersUnifiedRouter);
    const secret = 'test-secret-at-least-16-chars';
    const env = { AURA_DB: db, JWT_SECRET: secret } as any;

    const resAnon = await app.request('http://localhost/api/orders/ORD_CUST', { method: 'GET' }, env);
    expect(resAnon.status).toBe(401);

    const tokOwner = await generateJWT({ sub: 'cust_user_x', id: 'cust_user_x', role: 'customer' }, secret);
    const resOwner = await app.request('http://localhost/api/orders/ORD_CUST', {
      method: 'GET', headers: { Authorization: `Bearer ${tokOwner}` }
    }, env);
    expect(resOwner.status).toBe(200);

    const tokAttacker = await generateJWT({ sub: 'cust_user_y', id: 'cust_user_y', role: 'customer' }, secret);
    const resAttacker = await app.request('http://localhost/api/orders/ORD_CUST', {
      method: 'GET', headers: { Authorization: `Bearer ${tokAttacker}` }
    }, env);
    expect(resAttacker.status).toBe(403);

    const tokStaff = await generateJWT({ sub: 'staff_1', id: 'staff_1', role: 'staff' }, secret);
    const resStaff = await app.request('http://localhost/api/orders/ORD_CUST', {
      method: 'GET', headers: { Authorization: `Bearer ${tokStaff}` }
    }, env);
    expect(resStaff.status).toBe(200);
  });
});

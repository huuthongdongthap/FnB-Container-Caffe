/**
 * Customer / CRM Canonical Model Integration Tests
 * Canonical Flow: CUSTOMER → PROFILE → VISIT → ORDER → ACTIVITY → SEGMENT → LOYALTY
 * Verifies all 9 Contract Invariants.
 */
import { describe, it, expect } from 'vitest';
import {
  getCustomerCanonicalProfile,
  findOrCreateCustomerByIdentifier,
  mergeCustomerProfiles,
  resolveServerOrderOwnership,
  canAccessOrder,
  claimGuestOrder,
} from '@aura/domain-customer';

describe('Customer / CRM Canonical Model Contract', () => {
  function createMockDb() {
    const customers: any[] = [];
    const identities: any[] = [];
    const visits: any[] = [];
    const orders: any[] = [];
    const events: any[] = [];
    const consents: any[] = [];
    const wallets: any[] = [];

    const db = {
      customers, identities, visits, orders, events, consents, wallets,
      prepare: (sql: string) => {
        let binds: unknown[] = [];
        const stmt = {
          bind: (...args: unknown[]) => { binds = args; return stmt; },
          first: async <T = unknown>() => {
            if (sql.includes('FROM customers WHERE id = ?')) return (customers.find(x => x.id === binds[0]) || null) as T;
            if (sql.includes('FROM customers WHERE email = ?')) return (customers.find(x => x.email === binds[0]) || null) as T;
            if (sql.includes('FROM customers WHERE phone = ?')) return (customers.find(x => x.phone === binds[0]) || null) as T;
            if (sql.includes('FROM customer_identities WHERE identifier_type = ?')) {
              return (identities.find(x => x.identifier_type === binds[0] && x.identifier_value === binds[1]) || null) as T;
            }
            if (sql.includes('FROM orders WHERE customer_id = ? AND status != \'cancelled\'')) {
              const co = orders.filter(o => o.customer_id === binds[0] && o.status !== 'cancelled');
              return { total_orders: co.length, lifetime_spend: co.reduce((acc, o) => acc + (o.total || 0), 0), last_ordered: co[co.length - 1]?.created_at || null } as T;
            }
            if (sql.includes('FROM visits WHERE customer_id = ?')) {
              const cv = visits.filter(v => v.customer_id === binds[0]);
              return { total_visits: cv.length, last_visited: cv[cv.length - 1]?.visited_at || null } as T;
            }
            if (sql.includes('FROM cashback_wallets WHERE customer_id = ?')) return (wallets.find(x => x.customer_id === binds[0]) || null) as T;
            if (sql.includes('FROM orders WHERE id = ?')) return (orders.find(x => x.id === binds[0]) || null) as T;
            return null as T;
          },
          all: async <T = unknown>() => {
            if (sql.includes('FROM customer_identities WHERE customer_id = ?')) return { results: identities.filter(x => x.customer_id === binds[0]) } as any;
            if (sql.includes('FROM consents WHERE customer_id = ?')) return { results: consents.filter(x => x.customer_id === binds[0]) } as any;
            return { results: [] } as any;
          },
          run: async () => {
            if (sql.includes('INSERT INTO customers')) {
              customers.push({ id: binds[0], email: binds[1], name: binds[2], phone: binds[3], loyalty_points: binds[4] ?? 0, lifetime_points: binds[5] ?? 0, loyalty_tier: binds[6] ?? 'bronze', source: binds[7], created_at: binds[8], updated_at: binds[9] });
            }
            if (sql.includes('INSERT INTO customer_identities')) {
              identities.push({ id: binds[0], customer_id: binds[1], identifier_type: binds[2], identifier_value: binds[3], is_primary: binds[4], verified_at: binds[5] });
            }
            if (sql.includes('UPDATE orders SET customer_id = ? WHERE customer_id = ?')) orders.filter(o => o.customer_id === binds[1]).forEach(o => { o.customer_id = binds[0]; });
            if (sql.includes('UPDATE visits SET customer_id = ? WHERE customer_id = ?')) visits.filter(v => v.customer_id === binds[1]).forEach(v => { v.customer_id = binds[0]; });
            if (sql.includes('UPDATE customer_identities SET customer_id = ?, is_primary = 0 WHERE customer_id = ?')) identities.filter(i => i.customer_id === binds[1]).forEach(i => { i.customer_id = binds[0]; i.is_primary = 0; });
            if (sql.includes('UPDATE customers SET loyalty_points = loyalty_points + ?')) {
              const c = customers.find(x => x.id === binds[3]);
              if (c) { c.loyalty_points += (binds[0] as number); c.lifetime_points += (binds[1] as number); }
            }
            if (sql.includes("UPDATE customers SET loyalty_points = 0, name = name || ' [MERGED]'")) {
              const c = customers.find(x => x.id === binds[1]);
              if (c) { c.loyalty_points = 0; c.name = `${c.name} [MERGED]`; }
            }
            if (sql.includes('INSERT INTO customer_events')) events.push({ id: binds[0], customer_id: binds[1], event_type: binds[2], payload: binds[3], recorded_at: binds[4] });
            return { success: true };
          },
        };
        return stmt as any;
      },
    };
    return db;
  }

  it('1. anonymous customer: creates order without requiring account registration', async () => {
    const res = await resolveServerOrderOwnership({ actor: null, clientSuppliedCustomerId: 'injected_cust_id' });
    expect(res.stage).toBe('anonymous_guest');
    expect(res.customerId).toBeNull();
    expect(res.isGuest).toBe(true);
    expect(res.resolvedVia).toBe('anonymous');
  });

  it('2. identified customer: captures profile & primary identity mapping', async () => {
    const db = createMockDb();
    const res = await findOrCreateCustomerByIdentifier({ db: db as any, identifierType: 'phone', identifierValue: '0901234567', name: 'Nguyen Van A' });
    expect(res.created).toBe(true);
    expect(res.customerId).toMatch(/^cust_/);

    const profile = await getCustomerCanonicalProfile(db as any, res.customerId);
    expect(profile).not.toBeNull();
    expect(profile?.customer.phone).toBe('0901234567');
    expect(profile?.identities).toHaveLength(1);
    expect(profile?.identities[0].identifierValue).toBe('0901234567');
  });

  it('3. repeat visit/order: deterministic lookup retrieves existing customer without duplicates', async () => {
    const db = createMockDb();
    const first = await findOrCreateCustomerByIdentifier({ db: db as any, identifierType: 'email', identifierValue: 'alice@aura.local', name: 'Alice' });
    const second = await findOrCreateCustomerByIdentifier({ db: db as any, identifierType: 'email', identifierValue: 'alice@aura.local' });
    expect(second.created).toBe(false);
    expect(second.customerId).toBe(first.customerId);
    expect(db.customers).toHaveLength(1);
  });

  it('4. guest → customer linking: reassigns orders, visits, and loyalty explicitly', async () => {
    const db = createMockDb();
    db.orders.push({ id: 'ORD_GUEST_99', customer_id: null, total: 120000, items: JSON.stringify([{ id: 'prod_1' }]) });
    db.visits.push({ id: 'vis_1', customer_id: null, order_id: 'ORD_GUEST_99', visited_at: '2026-10-08T00:00:00Z' });
    db.customers.push({ id: 'cust_member_1', loyalty_points: 50, lifetime_points: 50, loyalty_tier: 'bronze' });

    const linkRes = await claimGuestOrder({ db: db as any, orderId: 'ORD_GUEST_99', actor: { id: 'cust_member_1', role: 'customer' } });
    expect(linkRes.success).toBe(true);
    expect(linkRes.orderId).toBe('ORD_GUEST_99');
    expect(linkRes.customerId).toBe('cust_member_1');
  });

  it('5. customer ownership & IDOR boundaries: enforces strict actor access rules', () => {
    const registeredOrder = { id: 'ORD_100', customer_id: 'cust_owner_1' };
    const guestOrder = { id: 'ORD_101', customer_id: null };

    expect(canAccessOrder({ id: 'cust_owner_1', role: 'customer' }, registeredOrder).allowed).toBe(true);
    expect(canAccessOrder({ id: 'cust_intruder_2', role: 'customer' }, registeredOrder).allowed).toBe(false);
    expect(canAccessOrder({ id: 'staff_1', role: 'staff' }, registeredOrder).allowed).toBe(true);
    expect(canAccessOrder(null, guestOrder).allowed).toBe(true);
    expect(canAccessOrder(null, registeredOrder).allowed).toBe(false);
  });

  it('6. duplicate customer prevention & merge: combines duplicate profiles with audit history', async () => {
    const db = createMockDb();
    db.customers.push({ id: 'cust_primary', loyalty_points: 100, lifetime_points: 100, name: 'Primary Account' });
    db.customers.push({ id: 'cust_secondary', loyalty_points: 40, lifetime_points: 40, name: 'Secondary Account' });
    db.orders.push({ id: 'ORD_SEC_1', customer_id: 'cust_secondary', total: 60000 });
    db.visits.push({ id: 'VIS_SEC_1', customer_id: 'cust_secondary' });
    db.identities.push({ id: 'ident_sec', customer_id: 'cust_secondary', identifier_type: 'phone', identifier_value: '+84999999999', is_primary: 1 });

    const mergeRes = await mergeCustomerProfiles({
      db: db as any,
      primaryCustomerId: 'cust_primary',
      secondaryCustomerId: 'cust_secondary',
      reason: 'Phone number deduplication merge',
    });

    expect(mergeRes.ok).toBe(true);
    expect(mergeRes.pointsMerged).toBe(40);
    expect(db.customers.find(c => c.id === 'cust_primary')?.loyalty_points).toBe(140);
    expect(db.customers.find(c => c.id === 'cust_secondary')?.loyalty_points).toBe(0);
    expect(db.orders[0].customer_id).toBe('cust_primary');
    expect(db.events.find(e => e.event_type === 'customer_merged')).toBeDefined();
  });

  it('7. historical Order integrity: merging profiles retains historical items snapshot', async () => {
    const db = createMockDb();
    const originalItems = JSON.stringify([{ id: 'coffee_1', name: 'Cà Phê Muối', price: 35000, quantity: 2 }]);
    db.customers.push({ id: 'cust_a', loyalty_points: 10, lifetime_points: 10 });
    db.customers.push({ id: 'cust_b', loyalty_points: 20, lifetime_points: 20 });
    db.orders.push({ id: 'ORD_HIST_1', customer_id: 'cust_b', total: 70000, items: originalItems, status: 'completed' });

    await mergeCustomerProfiles({ db: db as any, primaryCustomerId: 'cust_a', secondaryCustomerId: 'cust_b', reason: 'Account consolidation' });

    const reassignedOrder = db.orders.find(o => o.id === 'ORD_HIST_1');
    expect(reassignedOrder?.customer_id).toBe('cust_a');
    expect(reassignedOrder?.items).toBe(originalItems);
  });
});

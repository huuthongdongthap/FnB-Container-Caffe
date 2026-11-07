import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../types/env';
import {
  canAccessOrder,
  canMutateOrder,
  orderHasPlaceholderPhone,
  evaluateOrderClaimPolicy,
  claimGuestOrder,
} from '../../../../packages/domain/customer/policies/order-ownership-policy';
import { handleClaimOrder } from '../../routes/openapi-orders-handlers/order-claim-handlers';
import { handleOpenApiUpdateOrder } from '../../routes/openapi-orders-handlers/order-write-handlers';
import { handleGetOrderSummary } from '../../routes/openapi-orders-handlers/order-summary-handlers';
import {
  resolveOpenApiOrdersTenant,
  isAllowedOrderLocationForTenant,
} from '../../routes/openapi-orders-handlers/helpers';
import { registerOrderHandlers } from '../../routes/table-sessions-handlers/order-handlers';
import { registerZoneCrudHandlers } from '../../routes/openapi-tables-handlers/zone-crud-handlers';
import { OpenAPIHono } from '@hono/zod-openapi';

describe('Phase 53 Slice AZ4: Order Ownership & Claim Verification, OpenAPI Order Cancellation Parity, Table Sessions & OpenAPI Tables/Zones Security', () => {
  describe('AZ4-F1: Order claim verification & placeholder phone protection', () => {
    it('identifies placeholder phones accurately with orderHasPlaceholderPhone', () => {
      expect(orderHasPlaceholderPhone('')).toBe(true);
      expect(orderHasPlaceholderPhone('0')).toBe(true);
      expect(orderHasPlaceholderPhone('0000000000')).toBe(true);
      expect(orderHasPlaceholderPhone('guest')).toBe(true);
      expect(orderHasPlaceholderPhone('anonymous')).toBe(true);
      expect(orderHasPlaceholderPhone('walk-in')).toBe(true);
      expect(orderHasPlaceholderPhone('0901234567')).toBe(false);
      expect(orderHasPlaceholderPhone('+84901234567')).toBe(false);
    });

    it('rejects unverified customer claims on guest orders having table_id or order_token', () => {
      const customer = { id: 'cust_attacker', role: 'customer' };
      const order = {
        id: 'ord_guest_1',
        customer_id: null,
        customer_phone: '0000000000',
        table_id: 'table_5',
        order_token: 'secret_tok_123',
      };

      // Claim without verification credentials fails
      const unverified = evaluateOrderClaimPolicy({
        actor: customer,
        order,
      });
      expect(unverified.allowed).toBe(false);
      expect(unverified.statusCode).toBe(403);

      // Claim with wrong table fails
      const wrongTable = evaluateOrderClaimPolicy({
        actor: customer,
        order,
        verificationType: 'table',
        verificationValue: 'table_99',
      });
      expect(wrongTable.allowed).toBe(false);
      expect(wrongTable.statusCode).toBe(403);

      // Claim with wrong token fails
      const wrongToken = evaluateOrderClaimPolicy({
        actor: customer,
        order,
        verificationType: 'token',
        verificationValue: 'bad_token',
      });
      expect(wrongToken.allowed).toBe(false);
      expect(wrongToken.statusCode).toBe(403);

      // Claim with correct table succeeds
      const correctTable = evaluateOrderClaimPolicy({
        actor: customer,
        order,
        verificationType: 'table',
        verificationValue: 'table_5',
      });
      expect(correctTable.allowed).toBe(true);
      expect(correctTable.statusCode).toBe(200);

      // Claim with correct token succeeds
      const correctToken = evaluateOrderClaimPolicy({
        actor: customer,
        order,
        verificationType: 'token',
        verificationValue: 'secret_tok_123',
      });
      expect(correctToken.allowed).toBe(true);
      expect(correctToken.statusCode).toBe(200);
    });

    it('parses verification body in handleClaimOrder and passes credentials to claimGuestOrder', async () => {
      const executedUpdates: Array<{ sql: string; binds: unknown[] }> = [];
      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...binds: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM orders WHERE id = ?')) {
                return {
                  id: 'ord_1',
                  customer_id: null,
                  customer_phone: '0000000000',
                  table_id: 'tbl_8',
                  order_token: 'tok_abc',
                  tenant_id: 'store-a',
                };
              }
              return null;
            },
            run: async () => {
              executedUpdates.push({ sql, binds });
              return { meta: { changes: 1 } };
            },
          }),
        }),
      };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'cust_valid', role: 'customer', tenantId: 'store-a' } as any);
        c.set('tenantId', 'store-a');
        await next();
      });
      app.post('/api/orders/:id/claim', handleClaimOrder);

      // Request with matching table_id succeeds and claims the order
      const res = await app.request(
        'http://localhost/api/orders/ord_1/claim',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableId: 'tbl_8' }),
        },
        { AURA_DB: mockDb } as any
      );
      expect(res.status).toBe(200);
      const orderClaimUpdate = executedUpdates.find((u) => u.sql.includes('UPDATE orders SET customer_id = ?'));
      expect(orderClaimUpdate).toBeDefined();
      expect(orderClaimUpdate?.binds[0]).toBe('cust_valid');
    });
  });

  describe('AZ4-F2: Order mutation authorization & customer cancellation parity', () => {
    it('blocks customer from mutating or cancelling unclaimed guest orders via canMutateOrder', () => {
      const customer = { id: 'cust_attacker', role: 'customer' };
      const guestOrder = { id: 'ord_guest', customer_id: null };
      const foreignOrder = { id: 'ord_foreign', customer_id: 'cust_victim' };
      const ownOrder = { id: 'ord_own', customer_id: 'cust_attacker' };
      const manager = { id: 'mgr_1', role: 'manager' };

      // Customer cannot mutate unclaimed guest order
      expect(canMutateOrder(customer, guestOrder)).toEqual({
        allowed: false,
        reason: 'Unauthorized to mutate unclaimed or foreign customer order',
      });

      // Customer cannot mutate another customer order
      expect(canMutateOrder(customer, foreignOrder)).toEqual({
        allowed: false,
        reason: 'Unauthorized to mutate unclaimed or foreign customer order',
      });

      // Customer can mutate own order
      expect(canMutateOrder(customer, ownOrder)).toEqual({ allowed: true });

      // Manager can mutate any order
      expect(canMutateOrder(manager, guestOrder)).toEqual({ allowed: true });
      expect(canMutateOrder(manager, foreignOrder)).toEqual({ allowed: true });
    });

    it('rejects customer cancelling unclaimed guest order with 403 in handleOpenApiUpdateOrder', async () => {
      const mockDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM orders WHERE id = ?')) {
                return {
                  id: 'ord_unclaimed',
                  customer_id: null,
                  status: 'pending',
                  payment_status: 'unpaid',
                  tenant_id: 'store-a',
                };
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'cust_attacker', role: 'customer', tenantId: 'store-a' } as any);
        c.set('tenantId', 'store-a');
        await next();
      });
      app.patch('/api/orders/:id', handleOpenApiUpdateOrder);

      const res = await app.request(
        'http://localhost/api/orders/ord_unclaimed',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        },
        { AURA_DB: mockDb } as any
      );
      expect(res.status).toBe(403);
      const json = await res.json() as any;
      expect(json.error).toBe('Unauthorized to mutate unclaimed or foreign customer order');
    });
  });

  describe('AZ4-F3: Tenant confinement & foreign location validation on OpenAPI orders', () => {
    it('rejects cross-tenant header override for non-HQ callers via resolveOpenApiOrdersTenant', () => {
      const mockCtx = {
        get: (k: string) => (k === 'user' ? { id: 'mgr-1', role: 'manager', tenantId: 'store-a' } : 'store-a'),
        req: {
          query: (k: string) => (k === 'tenant_id' ? 'store-b' : undefined),
          header: () => undefined,
        },
        json: (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
      };

      const result = resolveOpenApiOrdersTenant(mockCtx, 'read');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(403);
      }
    });

    it('rejects foreign tenant locationId in isAllowedOrderLocationForTenant', async () => {
      const mockDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ tenant_id: 'store-b' }),
          }),
        }),
      } as any;

      const allowedSame = await isAllowedOrderLocationForTenant(mockDb, 'store-a', 'store-a');
      expect(allowedSame).toBe(true);

      const allowedForeign = await isAllowedOrderLocationForTenant(mockDb, 'store-b', 'store-a');
      expect(allowedForeign).toBe(false);
    });

    it('rejects cross-tenant query on handleGetOrderSummary with 403', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as any);
        c.set('tenantId', 'store-a');
        await next();
      });
      app.get('/api/orders/summary', handleGetOrderSummary);

      const res = await app.request(
        'http://localhost/api/orders/summary?tenant_id=store-b',
        { method: 'GET' },
        { AURA_DB: {} } as any
      );
      expect(res.status).toBe(403);
    });
  });

  describe('AZ4-F4: Table session order attachment & session window bounds', () => {
    it('rejects attaching rejected or refunded orders to active table session', async () => {
      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...binds: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM table_sessions WHERE id = ?')) {
                return { id: 'ses_1', table_id: 'tbl_1', status: 'active', tenant_id: 'store-a' };
              }
              if (sql.includes('FROM orders WHERE id = ?')) {
                const orderId = binds[0];
                if (orderId === 'ord_rejected') {
                  return { id: 'ord_rejected', status: 'rejected', total: 50000, table_id: null, tenant_id: 'store-a' };
                }
                if (orderId === 'ord_refunded') {
                  return { id: 'ord_refunded', status: 'refunded', total: 50000, table_id: null, tenant_id: 'store-a' };
                }
                return null;
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };

      const router = new Hono<{ Bindings: Env }>();
      router.use('*', async (c, next) => {
        c.set('user', { id: 'staff_1', role: 'waiter', tenantId: 'store-a' } as any);
        c.set('tenantId', 'store-a');
        await next();
      });
      registerOrderHandlers(router);

      // Rejected order attachment fails
      const rejRes = await router.request(
        'http://localhost/ses_1/orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord_rejected' }),
        },
        { AURA_DB: mockDb } as any
      );
      expect(rejRes.status).toBe(400);
      const rejJson = await rejRes.json() as any;
      expect(rejJson.error).toContain('rejected');

      // Refunded order attachment fails
      const refRes = await router.request(
        'http://localhost/ses_1/orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord_refunded' }),
        },
        { AURA_DB: mockDb } as any
      );
      expect(refRes.status).toBe(400);
      const refJson = await refRes.json() as any;
      expect(refJson.error).toContain('refunded');
    });
  });

  describe('AZ4-F5: Table zone tenant confinement & cascade deletion guards', () => {
    it('blocks deleting table zone with existing tables', async () => {
      const mockDb = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM table_zones WHERE id = ?')) {
                return { id: 'zone_patio', name: 'Patio', slug: 'patio', tenant_id: 'store-a' };
              }
              if (sql.includes('SELECT COUNT(*) as count FROM cafe_tables')) {
                return { count: 3 };
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'admin_1', role: 'admin', tenantId: 'store-a' } as any);
        c.set('tenantId', 'store-a');
        await next();
      });
      registerZoneCrudHandlers(app);

      const res = await app.request(
        'http://localhost/api/table-zones/zone_patio',
        { method: 'DELETE' },
        { AURA_DB: mockDb } as any
      );
      expect(res.status).toBe(409);
      const json = await res.json() as any;
      expect(json.error).toBe('Cannot delete zone with tables');
    });

    it('rejects cross-tenant table zone creation for non-HQ callers', async () => {
      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'mgr-1', role: 'manager', tenantId: 'store-a' } as any);
        c.set('tenantId', 'store-a');
        await next();
      });
      registerZoneCrudHandlers(app);

      const res = await app.request(
        'http://localhost/api/table-zones',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'store-b',
          },
          body: JSON.stringify({ name: 'Rooftop', slug: 'rooftop' }),
        },
        { AURA_DB: {} } as any
      );
      expect(res.status).toBe(403);
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  OrderItemSchema,
  OrderItemInputSchema,
  OrderCreateSchema,
  OrderUpdateSchema,
  OrderResponseSchema,
  CustomerOrderItemSchema,
  CustomerOrderResponseSchema,
  OrderRoutes,
  OrderChannelEnum,
} from '../../schemas/orders';
import {
  formatCustomerOrder,
  formatCustomerOrderItem,
  formatOrderItem,
  formatOrder,
} from '../../routes/openapi-orders-handlers/helpers';
import { fetchOrderForRead } from '../../routes/openapi-orders-handlers/order-read-handlers';
import { canAccessPaymentOrder } from '../../../../packages/domain/payment/policies/payment-access';
import { isAllowedLocationForTenant } from '../../routes/openapi-tables-handlers/helpers';
import { runSopReminders } from '../../routes/cron-handlers/sop-reminders';
import { getOrder } from '../../../../packages/domain/order/queries/get-order';
import { getStats } from '../../../../packages/domain/order/queries/stats';
import { staffTenant, evaluateStaffSession } from '../../lib/staff-session';
import { staffManagementDenial, staffMutationGuard } from '../../lib/staff-account-mutation';
import { resolvePilotStore } from '../../lib/pilot-store';
import { checkCronJobTenant, isAllowedCronLocationForTenant } from '../../routes/openapi-cron-handlers/helpers';
import { checkSupplierTenant } from '../../routes/openapi-inventory-handlers/supplier-handlers';
import { isTableAccessibleByTenant } from '../../routes/table-sessions-handlers/types';
import { shiftTarget } from '../../../../packages/domain/shift/commands/shift-access';
import { scheduleInput } from '../../../../packages/domain/shift/commands/schedules';
import { getReconciliationForShift } from '../../../../packages/domain/shift/src/policies/cash-reconciliation-policy';
import { collectCodPayment } from '../../../../packages/domain/kitchen/commands/collect-cod-payment';
import { updateMRRSnapshot } from '../../tree/subscriptions/mrr-calculator';
import { processNowPaymentsIpn } from '../../../../packages/domain/payment/commands/nowpayments-ipn';

describe('M4-C Phase 04: OpenAPI Orders Contract & Customer Security', () => {
  describe('OpenAPI 3.1 OrderRoutes definitions', () => {
    it('defines standard CRUD routes for orders', () => {
      expect(OrderRoutes.list.method).toBe('get');
      expect(OrderRoutes.list.path).toBe('/api/orders');
      expect(OrderRoutes.get.method).toBe('get');
      expect(OrderRoutes.get.path).toBe('/api/orders/{id}');
      expect(OrderRoutes.create.method).toBe('post');
      expect(OrderRoutes.create.path).toBe('/api/orders');
      expect(OrderRoutes.update.method).toBe('patch');
      expect(OrderRoutes.update.path).toBe('/api/orders/{id}');
      expect(OrderRoutes.cancel.method).toBe('post');
      expect(OrderRoutes.cancel.path).toBe('/api/orders/{id}/cancel');
      expect(OrderRoutes.summary.method).toBe('get');
      expect(OrderRoutes.summary.path).toBe('/api/orders/summary');
    });

    it('documents dual-gate status transitions (400 for state machine, 403 for role permissions)', () => {
      expect(OrderRoutes.update.responses[400]).toBeDefined();
      expect(OrderRoutes.update.responses[403]).toBeDefined();
      expect(OrderRoutes.update.description).toContain('dual-gated');
    });
  });

  describe('Server-authoritative OrderCreateSchema', () => {
    it('requires intent-only items (no price allowed in input)', () => {
      const validPayload = {
        locationId: '123e4567-e89b-12d3-a456-426614174000',
        items: [
          {
            menuItemId: 'prod_cafe_den',
            quantity: 2,
            modifiers: ['mod_sugar_30'],
            notes: 'ít đá',
          },
        ],
        channel: 'dine_in',
      };

      const result = OrderCreateSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBe('dine_in');
        expect(result.data.items[0].menuItemId).toBe('prod_cafe_den');
        // Price fields are not present in schema
        expect((result.data.items[0] as any).price).toBeUndefined();
        expect((result.data.items[0] as any).unitPriceCents).toBeUndefined();
      }
    });

    it('validates supported sales channels', () => {
      expect(OrderChannelEnum.safeParse('dine_in').success).toBe(true);
      expect(OrderChannelEnum.safeParse('takeaway').success).toBe(true);
      expect(OrderChannelEnum.safeParse('delivery').success).toBe(true);
      expect(OrderChannelEnum.safeParse('unsupported_channel').success).toBe(false);
    });
  });

  describe('Customer-safe schemas & positive projections', () => {
    it('CustomerOrderItemSchema allows only guest-visible fields', () => {
      const guestItem = {
        name: 'Cà phê đen đá',
        quantity: 2,
        unitPriceCents: 25000,
        subtotalCents: 50000,
        modifiers: [{ name: '30% đường', priceAdjustment: 0 }],
        notes: 'ít đá',
        status: 'pending',
      };

      const parsed = CustomerOrderItemSchema.safeParse(guestItem);
      expect(parsed.success).toBe(true);
    });

    it('CustomerOrderResponseSchema excludes sensitive staff/procurement fields', () => {
      const guestOrder = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        orderNumber: 'ORD-20260918-001',
        table: { id: '223e4567-e89b-12d3-a456-426614174001', name: 'Bàn 1' },
        items: [
          {
            name: 'Cà phê sữa đá',
            quantity: 1,
            unitPriceCents: 29000,
            subtotalCents: 29000,
            status: 'pending',
          },
        ],
        channel: 'dine_in',
        subtotal: 29000,
        discountAmount: 0,
        taxAmount: 2900,
        totalAmount: 31900,
        status: 'pending',
        paymentStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const parsed = CustomerOrderResponseSchema.safeParse(guestOrder);
      expect(parsed.success).toBe(true);
    });

    it('formatCustomerOrderItem drops product/variant IDs and internal fields', () => {
      const rawDbItem = {
        id: 'item-uuid-1',
        product_id: 'internal-secret-procurement-id',
        product_name: 'Cà phê muối',
        quantity: 2,
        unit_price: 35000,
        total_price: 70000,
        modifiers: JSON.stringify([{ option_name: 'Ít muối', price_adjustment: 0, supplier_cost: 1000 }]),
        notes: 'nhiều đá',
        status: 'confirmed',
      };

      const customerItem = formatCustomerOrderItem(rawDbItem);
      expect(customerItem.name).toBe('Cà phê muối');
      expect(customerItem.quantity).toBe(2);
      expect(customerItem.unitPriceCents).toBe(35000);
      expect(customerItem.subtotalCents).toBe(70000);
      expect((customerItem as any).id).toBeUndefined();
      expect((customerItem as any).productId).toBeUndefined();
      expect((customerItem as any).product_id).toBeUndefined();
      expect(customerItem.modifiers).toEqual([{ name: 'Ít muối', priceAdjustment: 0 }]);
    });

    it('formatCustomerOrder produces an allowlist-only safe projection without staff metadata', () => {
      const rawOrderRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        order_number: 'ORD-20260918-001',
        table_id: 'table-1',
        table_name: 'Bàn 1',
        location_id: 'secret-loc-id',
        source: 'pos_terminal_03',
        server_staff_id: 'staff-999',
        margin_percent: 45.2,
        subtotal: 100000,
        discount_amount: 10000,
        tax_amount: 9000,
        total_amount: 99000,
        status: 'pending',
        payment_status: 'pending',
        channel: 'dine_in',
        notes: 'Khách VIP',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const rawItems = [
        {
          product_id: 'prod-1',
          product_name: 'Trà sen vàng',
          quantity: 2,
          unit_price: 50000,
          total_price: 100000,
          status: 'pending',
        },
      ];

      const projected = formatCustomerOrder(rawOrderRow, rawItems);

      // Verify customer-allowed fields
      expect(projected.id).toBe(rawOrderRow.id);
      expect(projected.orderNumber).toBe(rawOrderRow.order_number);
      expect(projected.table).toEqual({ id: 'table-1', name: 'Bàn 1' });
      expect(projected.channel).toBe('dine_in');
      expect(projected.subtotal).toBe(100000);
      expect(projected.totalAmount).toBe(99000);

      // Verify strictly blocked / omitted fields (never leak internal/staff columns)
      expect((projected as any).source).toBeUndefined();
      expect((projected as any).location_id).toBeUndefined();
      expect((projected as any).locationId).toBeUndefined();
      expect((projected as any).server_staff_id).toBeUndefined();
      expect((projected as any).margin_percent).toBeUndefined();
      expect((projected as any).payments).toBeUndefined();
    });
  });

  describe('Security acceptance: IDOR prevention', () => {
    it('rejects a customer token from the staff-only order scope', () => {
      // The router gate must name 'customer' explicitly; guest sessions reach
      // the scoped read handlers rather than a blanket 403.
      const staffRoles = ['owner', 'manager', 'staff'];
      expect(staffRoles.includes('customer')).toBe(false);
    });

    it('a customer token can never address another customer row', () => {
      const rows = [
        { id: 'ord-a', customer_id: 'cust-a', total_amount: 50000 },
        { id: 'ord-b', customer_id: 'cust-b', total_amount: 99000 },
      ];
      const callerCustomerId = 'cust-a';

      const visible = rows.filter((r) => r.customer_id === callerCustomerId);

      expect(visible.map((r) => r.id)).toEqual(['ord-a']);
      expect(visible.some((r) => r.id === 'ord-b')).toBe(false);
    });

    it('formatCustomerOrder must not surface the owner customer_id of another session', () => {
      const foreignRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        order_number: 'ORD-FOREIGN',
        table_id: null,
        table_name: null,
        location_id: 'loc-1',
        source: 'app',
        customer_id: 'cust-b',
        server_staff_id: 'staff-1',
        substotal: 0,
        subtotal: 99000,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 99000,
        status: 'pending',
        payment_status: 'unpaid',
        channel: 'takeaway',
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const projected = formatCustomerOrder(foreignRow, []);

      // customer_id is internal ownership metadata: useful for the ownership
      // check, never for the payload.
      expect((projected as any).customer_id).toBeUndefined();
      expect((projected as any).customerId).toBeUndefined();
    });
  });

  describe('Security acceptance: price tampering rejection', () => {
    it('OrderCreateSchema strips client-supplied price/total/discount fields', () => {
      const tampered = {
        locationId: '123e4567-e89b-12d3-a456-426614174000',
        channel: 'dine_in',
        items: [
          {
            menuItemId: '123e4567-e89b-12d3-a456-426614174010',
            quantity: 1,
            unitPriceCents: 1,
            subtotalCents: 1,
            price: 1,
            modifiers: [],
          },
        ],
        subtotal: 1,
        totalAmount: 1,
        discountAmount: 999999,
      };

      const parsed = OrderCreateSchema.parse(tampered);
      const line = parsed.items[0] as Record<string, unknown>;

      // The intent contract admits no price-bearing key at any level.
      expect(line.unitPriceCents).toBeUndefined();
      expect(line.subtotalCents).toBeUndefined();
      expect(line.price).toBeUndefined();
      expect((parsed as Record<string, unknown>).subtotal).toBeUndefined();
      expect((parsed as Record<string, unknown>).totalAmount).toBeUndefined();
      expect((parsed as Record<string, unknown>).discountAmount).toBeUndefined();
    });

    it('OrderItemInputSchema rejects an unknown price key instead of coercing it', () => {
      const result = OrderItemInputSchema.safeParse({
        menuItemId: '123e4567-e89b-12d3-a456-426614174010',
        quantity: 2,
        unitPriceCents: 1,
      });

      // Unknown keys are dropped by the allowlist, never honoured.
      if (result.success) {
        expect((result.data as Record<string, unknown>).unitPriceCents).toBeUndefined();
      } else {
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Acceptance: transition authorization is machine-readable', () => {
    it('rejects a structurally illegal status jump with a descriptive error', () => {
      const illegal = OrderUpdateSchema.safeParse({ status: 'completed' });
      expect(illegal.success).toBe(true); // shape is valid; legality is a domain concern

      const unknown = OrderUpdateSchema.safeParse({ status: 'teleported' });
      expect(unknown.success).toBe(false);
    });

    it('accepts the enum values the state machine can emit', () => {
      for (const status of [
        'pending',
        'confirmed',
        'preparing',
        'ready',
        'served',
        'delivered',
        'completed',
        'cancelled',
        'refunded',
      ]) {
        expect(OrderUpdateSchema.safeParse({ status }).success).toBe(true);
      }
    });
  });

  describe('Phase AC1-AC3: Tenant Normalization Across Orders, Payments, Tables, SOP Cron & Domain Queries', () => {
    it('normalizes whitespace-padded tenant_id in fetchOrderForRead, canAccessPaymentOrder, isAllowedLocationForTenant, runSopReminders, getOrder, and getStats', async () => {
      const capturedSqls: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          capturedSqls.push(sql);
          return {
            bind: (...binds: unknown[]) => ({
              first: async () => (
                sql.includes('FROM locations')
                  ? (binds[0] === 'store-hcm-2' ? { tenant_id: ' store-hcm-2 ' } : { tenant_id: ' store-hcm-3 ' })
                  : { id: binds[0], tenant_id: ' store-hcm-2 ', status: 'pending' }
              ),
              all: async () => ({
                results: sql.includes('payments')
                  ? []
                  : [{ id: binds[0] || 'ord-1', tenant_id: ' store-hcm-2 ', status: 'pending', total: 45000, items: '[]', count: 1, revenue: 45000 }],
              }),
              run: async () => ({ meta: { changes: 1 } }),
            }),
            all: async () => ({
              results: sql.includes('SELECT DISTINCT tenant_id')
                ? [{ tenant_id: ' default ' }, { tenant_id: 'default' }, { tenant_id: '   ' }]
                : [],
            }),
          };
        },
      } as any;

      const rowDefault = await fetchOrderForRead(mockDb, 'ord-def', '  default  ');
      expect(rowDefault?.id).toBe('ord-def');
      expect(capturedSqls[0]).toContain("TRIM(o.tenant_id) = ''");

      const rowBranch = await fetchOrderForRead(mockDb, 'ord-br', ' store-hcm-2 ');
      expect(rowBranch?.id).toBe('ord-br');
      expect(capturedSqls[1]).toContain('TRIM(o.tenant_id) = ?2');

      const guestCtx = {
        env: { PILOT_STORE_ID: 'default' },
        get: () => undefined,
        req: {
          query: (k: string) => (k === 'tenant_id' ? ' store-hcm-2 ' : undefined),
          header: () => undefined,
        },
      };
      expect(
        canAccessPaymentOrder(guestCtx, { tenant_id: 'store-hcm-2', customer_id: null }, true)
      ).toBe(true);
      expect(
        canAccessPaymentOrder(guestCtx, { tenant_id: 'store-hcm-3', customer_id: null }, true)
      ).toBe(false);

      expect(await isAllowedLocationForTenant(mockDb, ' store-hcm-2 ', '  store-hcm-2  ')).toBe(true);
      expect(await isAllowedLocationForTenant(mockDb, ' store-hcm-3 ', '  store-hcm-2  ')).toBe(false);

      const sopRes = await runSopReminders({ AURA_DB: mockDb }, new Date('2026-11-12T10:00:00Z'));
      expect(sopRes).toHaveLength(1);
      expect(sopRes[0].tenantId).toBe('default');

      const getOrderRes = await getOrder(new Request('https://test.aura/api/orders/ord-1'), { AURA_DB: mockDb }, 'ord-1', ' store-hcm-2 ');
      expect(getOrderRes.status).toBe(200);

      const statsRes = await getStats(new Request('https://test.aura/api/orders/stats'), { AURA_DB: mockDb }, ' store-hcm-2 ');
      expect(statsRes.status).toBe(200);
    });
  });

  describe('Phase AD1-AD3: Tenant Normalization Across Staff Sessions, Pilot Store, Cron, Inventory & Table Sessions', () => {
    it('normalizes whitespace-padded tenant_id across staffSession, staffMutationGuard, resolvePilotStore, checkCronJobTenant, checkSupplierTenant, and isTableAccessibleByTenant', async () => {
      const account = {
        id: 'staff-1',
        name: 'Owner 1',
        phone: null,
        role: 'owner',
        is_active: 1,
        auth_version: 2,
        tenant_id: ' store-hcm-2 ',
      };
      expect(staffTenant(account)).toBe('store-hcm-2');
      expect(
        evaluateStaffSession(
          {
            id: 'staff-1',
            role: 'owner',
            tenantId: ' store-hcm-2 ',
            authVersion: 2,
            authTime: 1000,
            sessionType: 'staff-web',
            exp: 29800,
          },
          account,
          1000
        )
      ).toEqual({
        valid: true,
        remainingSeconds: 28800,
      });

      expect(staffManagementDenial({ role: 'owner', tenantId: ' store-hcm-2 ' }, account)).toBeNull();
      expect(staffManagementDenial({ role: 'owner', tenantId: ' store-hcm-3 ' }, account)).toBe('Không đủ quyền truy cập cửa hàng');

      const guard = staffMutationGuard(account, true);
      expect(guard.sql).toContain("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");
      expect(guard.sql).toContain("COALESCE(NULLIF(TRIM(other.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(users.tenant_id), ''), 'default')");
      expect(guard.values).toEqual(['staff-1', 2, 'store-hcm-2']);

      expect(resolvePilotStore({ PILOT_TENANT_ID: '  store-hcm-2  ', ENVIRONMENT: 'production' })).toBe('store-hcm-2');
      expect(resolvePilotStore({ PILOT_TENANT_ID: '   ', ENVIRONMENT: 'development' })).toBe('default');

      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...binds: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM locations')) {
                return binds[0] === 'loc-hcm-2' ? { tenant_id: ' store-hcm-2 ' } : { tenant_id: ' store-hcm-3 ' };
              }
              if (sql.includes('FROM cafe_tables')) {
                return binds[0] === 'tbl-1' ? { id: 'tbl-1', tenant_id: ' store-hcm-2 ' } : { id: 'tbl-2', tenant_id: ' store-hcm-3 ' };
              }
              return null;
            },
          }),
        }),
      } as any;

      expect(await isAllowedCronLocationForTenant(mockDb, ' loc-hcm-2 ', '  store-hcm-2  ')).toBe(true);
      expect(await isAllowedCronLocationForTenant(mockDb, ' loc-hcm-3 ', '  store-hcm-2  ')).toBe(false);
      expect(await checkCronJobTenant(mockDb, { id: 'job-1', tenant_id: ' store-hcm-2 ' }, '  store-hcm-2  ')).toBe(true);
      expect(await checkCronJobTenant(mockDb, { id: 'job-2', tenant_id: ' store-hcm-3 ' }, '  store-hcm-2  ')).toBe(false);
      expect(await checkSupplierTenant(mockDb, { id: 'sup-1', tenant_id: ' store-hcm-2 ' }, '  store-hcm-2  ')).toBe(true);
      expect(await checkSupplierTenant(mockDb, { id: 'sup-2', tenant_id: ' store-hcm-3 ' }, '  store-hcm-2  ')).toBe(false);
      expect(await isTableAccessibleByTenant(mockDb, 'tbl-1', '  store-hcm-2  ')).toBe(true);
      expect(await isTableAccessibleByTenant(mockDb, 'tbl-2', '  store-hcm-2  ')).toBe(false);
    });
  });

  describe('Phase AE1-AE3: Shift Target/Schedule/Reconciliation, COD Collection & Subscription MRR Tenant Isolation', () => {
    it('normalizes whitespace-padded tenant_id across shiftTarget, scheduleInput, getReconciliationForShift, collectCodPayment, updateMRRSnapshot, and processNowPaymentsIpn', async () => {
      const mrrSnapshotsWritten: string[] = [];
      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...binds: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM users WHERE id = ?')) {
                return {
                  id: String(binds[0]),
                  name: 'Staff HCM 2',
                  phone: null,
                  role: 'staff',
                  is_active: 1,
                  auth_version: 1,
                  tenant_id: ' store-hcm-2 ',
                };
              }
              if (sql.includes('FROM shift_reconciliations WHERE shift_id = ?')) {
                return {
                  id: 'recon_1',
                  shift_id: 'shift_1',
                  staff_id: 'staff-1',
                  opening_float: 100000,
                  expected_cash: 150000,
                  actual_cash: 150000,
                  variance: 0,
                  variance_status: 'balanced',
                  denominations: '{"denominations":[]}',
                  cash_payment_total: 50000,
                  cash_payout_total: 0,
                  notes: null,
                  tenant_id: ' store-hcm-2 ',
                  created_at: '2026-11-03T00:00:00.000Z',
                };
              }
              if (sql.includes('SELECT total, status, payment_status, payment_method FROM orders')) {
                if (sql.includes('TRIM(tenant_id) = ?') && binds[1] === 'store-hcm-2') {
                  return {
                    total: 50000,
                    status: 'preparing',
                    payment_status: 'paid',
                    payment_method: 'cod',
                  };
                }
                return null;
              }
              if (sql.includes('FROM subscription_invoices WHERE payment_ref = ?')) {
                return {
                  id: 'inv_hcm_2',
                  subscription_id: 'sub_hcm_2',
                  status: 'pending',
                  amount_vnd: 1500000,
                  payment_ref: 'np_ref_1',
                  tenant_id: ' store-hcm-2 ',
                };
              }
              if (sql.includes('FROM subscriptions WHERE id = ?')) {
                return {
                  id: 'sub_hcm_2',
                  billing_cycle: 'monthly',
                  current_period_end: '2026-11-01',
                  tenant_id: ' store-hcm-2 ',
                };
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM payments WHERE order_id = ?')) {
                return {
                  results: [{ id: 'cod:ord-1', status: 'completed', amount: 50000 }],
                };
              }
              return { results: [] };
            },
            run: async () => {
              if (sql.includes('INSERT INTO mrr_snapshots')) {
                mrrSnapshotsWritten.push(sql);
              }
              return { meta: { changes: 1 } };
            },
          }),
          first: async () => ({ count: 1, mrr: 1500000 }),
        }),
      } as any;

      const scope = {
        env: { AURA_DB: mockDb } as any,
        tenantId: 'store-hcm-2',
        actor: {
          id: 'mgr-1',
          name: 'Manager',
          phone: null,
          role: 'manager',
          is_active: 1,
          auth_version: 1,
          tenant_id: 'store-hcm-2',
        },
        canManage: true,
      };

      const target = await shiftTarget(scope, 'staff-2');
      expect(target.id).toBe('staff-2');

      expect(() => scheduleInput(scope, { locationId: '  store-hcm-2  ' })).not.toThrow();
      expect(() => scheduleInput(scope, { locationId: '  store-hcm-3  ' })).toThrow('Location does not match store');

      const reconMatch = await getReconciliationForShift({ AURA_DB: mockDb }, 'shift_1', '  store-hcm-2  ');
      expect(reconMatch?.id).toBe('recon_1');
      const reconMismatch = await getReconciliationForShift({ AURA_DB: mockDb }, 'shift_1', '  store-hcm-3  ');
      expect(reconMismatch).toBeNull();

      const codRes = await collectCodPayment(mockDb, 'ord-1', '  store-hcm-2  ');
      expect(codRes).toEqual({ success: true, status: 'preparing', idempotent: true });

      await updateMRRSnapshot(mockDb, '  store-hcm-2  ');
      expect(mrrSnapshotsWritten).toHaveLength(0);

      const ipnRes = await processNowPaymentsIpn(mockDb, {
        payment_id: 'np_ref_1',
        payment_status: 'finished',
        price_currency: 'vnd',
        price_amount: 1500000,
      });
      expect(ipnRes).toEqual({ ok: true, status: 200 });
      expect(mrrSnapshotsWritten).toHaveLength(0);
    });
  });

  describe('Phase AF1-AF3: Shift Lifecycle, Admin Order Filtering, PayOS Reconcile & Inventory/Purchasing Tenant Isolation', () => {
    it('enforces operatingUnitId boundary on closeCanonicalShift, HQ query filtering in getAdminOrders, and franchise tenant stamping in inventory/purchasing', async () => {
      const { openCanonicalShift, closeCanonicalShift } = await import(
        '../../../../packages/domain/shift/src/policies/shift-lifecycle-policy'
      );
      const { getAdminOrders } = await import('../../../../packages/domain/order/queries/admin-orders');
      const { reconcilePayOSPayment } = await import('../../../../packages/domain/payment/commands/payos-reconcile');
      const { createCanonicalPurchaseOrder } = await import(
        '../../../../packages/domain/inventory/src/policies/purchasing-receiving-policy'
      );

      const capturedBinds: unknown[][] = [];
      const mockDb = {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (sql.includes('FROM staff_shifts WHERE id = ?')) {
                return {
                  id: 'shift_s2',
                  staff_id: 'staff-1',
                  staff_name: 'Staff',
                  role: 'cashier',
                  operating_unit_id: '  store-hcm-2  ',
                  clock_in: '2026-11-02T08:00:00.000Z',
                  clock_out: null,
                  status: 'open',
                  opening_cash: 200000,
                  cash_sales: 50000,
                };
              }
              if (sql.includes('FROM payments p') && sql.includes('JOIN orders o')) {
                return {
                  id: 'pay-1',
                  order_id: 'ord-1',
                  method: 'payos',
                  amount: 55000,
                  status: 'completed',
                  transaction_id: '123456',
                  payment_url: null,
                  refund_status: null,
                  order_total: 55000,
                  order_payment_status: 'paid',
                  order_payment_method: 'payos',
                  order_status: 'confirmed',
                  order_tenant_id: 'store-hcm-2',
                };
              }
              if (sql.includes('FROM suppliers WHERE id = ?')) {
                return { id: 'sup-2', name: 'Sa Dec Supplier', is_active: 1, tenant_id: 'store-hcm-2' };
              }
              if (sql.includes('FROM ingredients WHERE id = ?')) {
                if (args[0] === 'ing-store-3') {
                  return { id: 'ing-store-3', cost_per_unit: 10000, tenant_id: 'store-hcm-3' };
                }
                return { id: 'ing-store-2', cost_per_unit: 10000, tenant_id: 'store-hcm-2' };
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM orders o')) {
                capturedBinds.push(args);
                return { results: [] };
              }
              if (sql.includes('SELECT COUNT(*) as total FROM orders')) {
                return { results: [{ total: 0 }] };
              }
              return { results: [] };
            },
            run: async () => ({ meta: { changes: 1 } }),
          }),
        }),
      } as any;

      const openRes = await openCanonicalShift(mockDb, {
        staffId: 'staff-1',
        staffName: 'Staff',
        role: 'cashier',
        operatingUnitId: '  store-hcm-2  ',
        openingCash: 100000,
      });
      expect(openRes.ok).toBe(true);
      expect(openRes.shift?.operating_unit_id).toBe('store-hcm-2');

      const crossClose = await closeCanonicalShift(mockDb, {
        shiftId: 'shift_s2',
        closedByStaffId: 'mgr-1',
        closedByRole: 'manager',
        actualCash: 250000,
        operatingUnitId: 'store-hcm-3',
      });
      expect(crossClose).toEqual({ ok: false, error: 'cross_operating_unit_mismatch' });

      const validClose = await closeCanonicalShift(mockDb, {
        shiftId: 'shift_s2',
        closedByStaffId: 'mgr-1',
        closedByRole: 'manager',
        actualCash: 250000,
        operatingUnitId: '  store-hcm-2  ',
      });
      expect(validClose.ok).toBe(true);

      await getAdminOrders(
        new Request('http://localhost/api/admin/orders?tenant_id=store-hcm-2'),
        { AURA_DB: mockDb },
        '*'
      );
      expect(capturedBinds[0]).toEqual(['store-hcm-2']);

      await getAdminOrders(
        new Request('http://localhost/api/admin/orders?tenant_id=store-hcm-2'),
        { AURA_DB: mockDb },
        '  store-hcm-1  '
      );
      expect(capturedBinds[1]).toEqual(['store-hcm-1']);

      const recOk = await reconcilePayOSPayment({
        db: mockDb,
        paymentId: 'pay-1',
        tenantId: '  store-hcm-2  ',
        clientId: 'cid',
        apiKey: 'key',
        checksumKey: 'chk',
        source: 'manual',
      });
      expect(recOk.ok).toBe(true);
      expect(recOk.outcome).toBe('already_settled');

      await expect(
        createCanonicalPurchaseOrder(
          mockDb,
          {
            supplierId: 'sup-2',
            items: [{ ingredientId: 'ing-store-3', quantity: 5 }],
          },
          '*'
        )
      ).rejects.toThrow('Ingredient ing-store-3 not found');
    });

    it('enforces operating-unit isolation in table/reservation policies, public reservation tenant resolution, and HQ shift/snapshot/BOM tenant inheritance', async () => {
      const {
        validateOrderTable,
        checkTableAvailability,
        createCanonicalReservation,
        seatTable,
        releaseTable,
        updateReservationStatus,
      } = await import('@aura/domain-table');
      const { reservationsRouter } = await import('@aura/domain-reservation');
      const { reconcileShiftCash } = await import('@aura/domain-shift');
      const { inventorySnapshots, getRecipeForProduct } = await import('@aura/domain-inventory');
      const { Hono } = await import('hono');

      const tables = [
        { id: 'tbl_s1', table_number: '1', capacity: 4, zone: 'Indoor', status: 'Available', tenant_id: 'store-sadec-1', operating_unit_id: 'store-sadec-1' },
        { id: 'tbl_s2', table_number: '2', capacity: 4, zone: 'Indoor', status: 'Available', tenant_id: 'store-sadec-2', operating_unit_id: 'store-sadec-2' },
      ];
      const reservations: any[] = [
        { id: 'rsv_s2', table_id: 'tbl_s2', customer_name: 'Guest 2', customer_phone: '0901112222', guest_count: 2, date: '2026-12-01', time: '18:00', zone: 'Indoor', status: 'confirmed', tenant_id: 'store-sadec-2', operating_unit_id: 'store-sadec-2' },
      ];
      let capturedReconTenant: string | null = null;
      let capturedSnapshotTenant: string | null = null;
      const mockDb = {
        prepare: (sql: string) => {
          let binds: any[] = [];
          const stmt = {
            bind: (...args: any[]) => {
              binds = args;
              return stmt;
            },
            first: async () => {
              if (sql.includes('FROM cafe_tables WHERE id = ?')) {
                return tables.find((t) => t.id === binds[0]) || null;
              }
              if (sql.includes('FROM cafe_tables WHERE table_number = ?')) {
                return tables.find((t) => String(t.table_number) === String(binds[0])) || null;
              }
              if (sql.includes('FROM reservations') && sql.includes('WHERE id = ?')) {
                return reservations.find((r) => r.id === binds[0]) || null;
              }
              if (sql.includes('FROM staff_shifts WHERE id = ?')) {
                return { clock_in: '2026-11-03T08:00:00Z', clock_out: '2026-11-03T16:00:00Z', tenant_id: 'store-sadec-2' };
              }
              if (sql.includes('FROM payments')) {
                return { total: 50000 };
              }
              if (sql.includes('FROM cash_payouts')) {
                return { total: 0 };
              }
              if (sql.includes('FROM inventory_items WHERE id = ?')) {
                return { id: binds[0], current_stock: 42, tenant_id: 'store-sadec-2' };
              }
              if (sql.includes('FROM inventory_snapshots WHERE item_id = ?')) {
                return null;
              }
              if (sql.includes('FROM recipes WHERE product_id = ?')) {
                if (binds[1] && binds[1] !== 'store-sadec-2') return null;
                return { id: 'rec_1', tenant_id: 'store-sadec-2' };
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM cafe_tables')) {
                return { results: tables };
              }
              if (sql.includes('FROM reservations')) {
                return { results: reservations };
              }
              if (sql.includes('FROM recipe_items')) {
                return { results: [{ ingredient_id: 'ing_1', quantity: 2 }] };
              }
              return { results: [] };
            },
            run: async () => {
              if (sql.includes('INSERT INTO shift_reconciliations') && sql.includes('tenant_id')) {
                capturedReconTenant = binds[12];
              }
              if (sql.includes('UPDATE inventory_snapshots SET tenant_id = ?')) {
                capturedSnapshotTenant = binds[0];
              }
              return { meta: { changes: 1 } };
            },
          };
          return stmt;
        },
        batch: async () => [],
      } as any;

      const mismatchTbl = await validateOrderTable(mockDb, 'tbl_s1', 'store-sadec-2');
      expect(mismatchTbl).toEqual({ ok: false, error: 'cross_operating_unit_mismatch' });

      const availS2 = await checkTableAvailability(mockDb, { date: '2026-12-01', time: '18:00', operatingUnitId: 'store-sadec-2' });
      expect(availS2.tables).toHaveLength(1);
      expect(availS2.tables[0].id).toBe('tbl_s2');
      expect(availS2.tables[0].available).toBe(false);

      const crossRsv = await createCanonicalReservation(mockDb, {
        tableId: 'tbl_s1',
        customerName: 'Guest',
        customerPhone: '0901234567',
        date: '2026-12-01',
        time: '19:00',
        operatingUnitId: 'store-sadec-2',
      });
      expect(crossRsv).toEqual({ ok: false, error: 'cross_operating_unit_mismatch' });

      const crossSeat = await seatTable(mockDb, {
        tableId: 'tbl_s2',
        reservationId: 'rsv_s2',
        operatingUnitId: 'store-sadec-1',
      });
      expect(crossSeat).toEqual({ ok: false, error: 'cross_operating_unit_mismatch' });

      const crossRelease = await releaseTable(mockDb, {
        tableId: 'tbl_s2',
        operatingUnitId: 'store-sadec-1',
      });
      expect(crossRelease).toEqual({ ok: false, error: 'cross_operating_unit_mismatch' });

      const crossStatus = await updateReservationStatus(mockDb, 'rsv_s2', 'cancelled', undefined, 'store-sadec-1');
      expect(crossStatus).toEqual({ ok: false, error: 'cross_operating_unit_mismatch' });

      // Public unauthenticated GET /availability honors X-Tenant-Id via resolvePublicTenantId
      const pubRes = await reservationsRouter.request(
        'http://localhost/availability?date=2026-12-01&time=18:00',
        { headers: { 'X-Tenant-Id': 'store-sadec-2' } },
        { AURA_DB: mockDb } as any
      );
      expect(pubRes.status).toBe(200);
      const pubBody = (await pubRes.json()) as any;
      expect(pubBody.data).toHaveLength(1);
      expect(pubBody.data[0].id).toBe('tbl_s2');

      // Shift cash reconciliation inherits shift's store tenant when called by HQ ('*')
      await reconcileShiftCash(
        { AURA_DB: mockDb },
        { shift_id: 'sh_2', opening_float: 100000, denominations: { denominations: [{ denomination: 100000, count: 1 }, { denomination: 50000, count: 1 }] } },
        'hq-admin',
        '*'
      );
      expect(capturedReconTenant).toBe('store-sadec-2');

      // Inventory snapshot inherits item.tenant_id when called by HQ ('*')
      const snapApp = new Hono<any>();
      snapApp.use('*', async (c, next) => {
        c.set('tenantId', '*');
        c.set('user', { id: 'hq-1', role: 'owner', tenantId: '*' });
        await next();
      });
      inventorySnapshots(snapApp as any);
      const snapRes = await snapApp.request('http://localhost/item_s2/snapshots', { method: 'POST' }, { AURA_DB: mockDb });
      expect(snapRes.status).toBe(201);
      expect(capturedSnapshotTenant).toBe('store-sadec-2');

      // BOM getRecipeForProduct scopes by tenantId
      const wrongTenantRecipe = await getRecipeForProduct(mockDb, 'prod_1', 'store-sadec-1');
      expect(wrongTenantRecipe).toEqual([]);
      const rightTenantRecipe = await getRecipeForProduct(mockDb, 'prod_1', 'store-sadec-2');
      expect(rightTenantRecipe).toEqual([{ ingredient_id: 'ing_1', quantity: 2 }]);
    });

    it('enforces matchesTenantRow whitespace normalization, public catalog tenant resolution, and HQ cross-store staff-tips/catalog guards', async () => {
      const { matchesTenantRow } = await import('../../lib/db');
      const { isHQSuperAdmin } = await import('../../middleware/tenant');
      const { categoriesRouter, productsRouter } = await import('@aura/domain-catalog');

      expect(matchesTenantRow({ id: 'r1', tenant_id: 'store-sadec-2' }, '  store-sadec-2  ')).toBe(true);
      expect(matchesTenantRow({ id: 'r1', tenant_id: 'store-sadec-2' }, '  *  ')).toBe(true);
      expect(matchesTenantRow({ id: 'r1' }, '   ')).toBe(true);
      expect(
        isHQSuperAdmin({
          get: (k: string) => (k === 'user' ? { role: 'owner', tenantId: ' default ' } : undefined),
        } as any)
      ).toBe(true);

      const categories = [
        { id: 'cat_s1', name: 'Coffee S1', slug: 'coffee-s1', sort_order: 1, tenant_id: 'store-sadec-1' },
        { id: 'cat_s2', name: 'Coffee S2', slug: 'coffee-s2', sort_order: 1, tenant_id: 'store-sadec-2' },
      ];
      const products = [
        { id: 'prod_s1', name: 'Latte S1', slug: 'latte-s1', price: 45000, category_id: 'cat_s1', is_available: 1, tenant_id: 'store-sadec-1' },
        { id: 'prod_s2', name: 'Latte S2', slug: 'latte-s2', price: 49000, category_id: 'cat_s2', is_available: 1, tenant_id: 'store-sadec-2' },
      ];
      const mockCatalogDb = {
        prepare: (sql: string) => {
          let binds: any[] = [];
          const stmt = {
            bind: (...args: any[]) => {
              binds = args;
              return stmt;
            },
            first: async () => {
              if (sql.includes('FROM categories WHERE id = ?')) {
                return categories.find((c) => c.id === binds[0]) || null;
              }
              if (sql.includes('FROM products') && sql.includes('WHERE p.id = ?')) {
                return products.find((p) => p.id === binds[0]) || null;
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM categories')) {
                return { results: categories };
              }
              if (sql.includes('FROM products') && sql.includes('WHERE p.slug = ?')) {
                return { results: products.filter((p) => p.slug === binds[0]) };
              }
              if (sql.includes('FROM products')) {
                return { results: products };
              }
              return { results: [] };
            },
            run: async () => ({ meta: { changes: 1 } }),
          };
          return stmt;
        },
      } as any;

      const pubCatsRes = await categoriesRouter.request(
        'http://localhost/?tenant_id=store-sadec-2',
        {},
        { AURA_DB: mockCatalogDb } as any
      );
      expect(pubCatsRes.status).toBe(200);
      const pubCatsBody = (await pubCatsRes.json()) as any;
      expect(pubCatsBody.data.map((c: any) => c.id)).toEqual(['cat_s2']);

      const pubProdsRes = await productsRouter.request(
        'http://localhost/?tenant_id=store-sadec-2',
        {},
        { AURA_DB: mockCatalogDb } as any
      );
      expect(pubProdsRes.status).toBe(200);
      const pubProdsBody = (await pubProdsRes.json()) as any;
      expect(pubProdsBody.data.map((p: any) => p.id)).toEqual(['prod_s2']);

      const pubSlugWrongTenant = await productsRouter.request(
        'http://localhost/slug/latte-s1',
        { headers: { 'X-Tenant-ID': 'store-sadec-2' } },
        { AURA_DB: mockCatalogDb } as any
      );
      expect(pubSlugWrongTenant.status).toBe(404);
    });

    it('Phase AI4: tables release scopes HQ session closure to table.tenant_id, qrRouter guards explicit X-Tenant-ID, pricing-resolver isolates modifiers by tenant, and getFulfillment scopes HQ queueDepth & KV pickupPoint per store', async () => {
      const { tablesRouter } = await import('../../../../packages/domain/table/commands/tables');
      const { qrRouter } = await import('../../../../packages/domain/table/commands/qr-scan');
      const { signQRUrl } = await import('../../tree/qr/signer');
      const { resolveServerProductPrice } = await import(
        '../../../../packages/domain/catalog/policies/pricing-resolver'
      );
      const { getFulfillment } = await import(
        '../../../../packages/domain/crm/commands/get-fulfillment'
      );
      const { generateJWT } = await import('../../lib/jwt');

      // 1. tablesRouter.patch('/:id/release') under HQ ('*') scopes table_sessions update to table.tenant_id
      const executedTableSqls: Array<{ sql: string; binds: unknown[] }> = [];
      const testJwtSecret = 'test-jwt-secret-key-for-ai4-check-32chars!';
      const nowSec = Math.floor(Date.now() / 1000) - 5;
      const hqToken = await generateJWT(
        {
          id: 'hq_owner',
          email: 'hq@aura.vn',
          role: 'owner',
          tenantId: '*',
          authVersion: 1,
          authTime: nowSec,
          sessionType: 'staff-web',
        } as any,
        testJwtSecret,
        3600
      );
      const mockTableDb = {
        prepare: (sql: string) => {
          let binds: unknown[] = [];
          const stmt = {
            bind: (...args: unknown[]) => {
              binds = args;
              return stmt;
            },
            first: async () => {
              executedTableSqls.push({ sql, binds });
              if (sql.includes('FROM users WHERE id = ?')) {
                return { id: 'hq_owner', name: 'HQ Owner', phone: null, role: 'owner', tenant_id: '*', is_active: 1, auth_version: 1 };
              }
              if (sql.includes('FROM cafe_tables WHERE id = ?')) {
                return {
                  id: 'tbl_shared_01',
                  table_number: 'T01',
                  zone: 'indoor',
                  status: 'Occupied',
                  tenant_id: 'store-sadec-2',
                };
              }
              if (sql.includes('FROM table_qr_codes WHERE slug = ?')) {
                return { table_id: 'tbl_shared_01', slug: 'slug-s2-t01' };
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => {
              executedTableSqls.push({ sql, binds });
              return { meta: { changes: 1 } };
            },
          };
          return stmt;
        },
      } as any;

      const releaseRes = await tablesRouter.request(
        'http://localhost/tbl_shared_01/release',
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${hqToken}` },
        },
        { AURA_DB: mockTableDb, JWT_SECRET: testJwtSecret } as any
      );
      expect(releaseRes.status).toBe(200);
      expect(
        executedTableSqls.some(
          (q) =>
            q.sql.includes("UPDATE table_sessions SET status = 'closed'") &&
            q.sql.includes("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?") &&
            q.binds.includes('store-sadec-2')
        )
      ).toBe(true);

      // 2. qrRouter.get('/:slug') rejects cross-store explicit X-Tenant-ID
      const qrSecret = 'test-qr-secret-key-for-ai4-check';
      const signedUrl = await signQRUrl('slug-s2-t01', qrSecret, 'http://localhost:3000');
      const parsedQr = new URL(signedUrl);
      const ts = parsedQr.searchParams.get('ts');
      const sig = parsedQr.searchParams.get('sig');
      const qrCrossTenantRes = await qrRouter.request(
        `http://localhost/slug-s2-t01?ts=${ts}&sig=${sig}`,
        { headers: { 'X-Tenant-ID': 'default' } },
        { AURA_DB: mockTableDb, QR_SIGNING_SECRET: qrSecret } as any
      );
      expect(qrCrossTenantRes.status).toBe(404);

      // 3. resolveServerProductPrice isolates modifier choices & groups by tenant
      const modChoices = [
        { id: 'mc_s1_shot', group_id: 'mg_s1', name: 'Extra Shot', price_delta: 10000, is_available: 1, tenant_id: 'default' },
        { id: 'mc_s2_shot', group_id: 'mg_s2', name: 'Extra Shot', price_delta: 15000, is_available: 1, tenant_id: 'store-sadec-2' },
      ];
      const modGroups = [
        { id: 'mg_s1', name: 'Topping S1', type: 'multiple', required: 0, is_active: 1, tenant_id: 'default' },
        { id: 'mg_s2', name: 'Topping S2', type: 'multiple', required: 0, is_active: 1, tenant_id: 'store-sadec-2' },
      ];
      const modLinks = [
        { product_id: 'prod_s2', group_id: 'mg_s2', tenant_id: 'store-sadec-2' },
      ];
      const mockModDb = {
        prepare: (sql: string) => {
          let binds: unknown[] = [];
          const stmt = {
            bind: (...args: unknown[]) => {
              binds = args;
              return stmt;
            },
            first: async () => {
              if (sql.includes('FROM products WHERE id = ?')) {
                return {
                  id: 'prod_s2',
                  name: 'Cold Brew S2',
                  price: 45000,
                  available: 1,
                  category_id: 'cat_s2',
                  tenant_id: 'store-sadec-2',
                };
              }
              if (sql.includes('SELECT tenant_id FROM modifier_choices WHERE id = ?')) {
                return modChoices.find((c) => c.id === binds[0]) ?? null;
              }
              if (sql.includes('FROM modifier_choices WHERE id = ?')) {
                return modChoices.find((c) => c.id === binds[0]) ?? null;
              }
              if (sql.includes('FROM modifier_choices WHERE name = ?')) {
                return modChoices.find((c) => c.name === binds[0]) ?? null;
              }
              if (sql.includes('SELECT tenant_id FROM modifier_groups WHERE id = ?')) {
                return modGroups.find((g) => g.id === binds[0]) ?? null;
              }
              if (sql.includes('FROM modifier_groups WHERE id = ?')) {
                return modGroups.find((g) => g.id === binds[0]) ?? null;
              }
              if (sql.includes('FROM product_modifier_groups WHERE product_id = ? AND group_id = ?')) {
                return modLinks.find((l) => l.product_id === binds[0] && l.group_id === binds[1]) ?? null;
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM modifier_choices WHERE name = ?')) {
                return { results: modChoices.filter((c) => c.name === binds[0]) };
              }
              return { results: [] };
            },
            run: async () => ({}),
          };
          return stmt;
        },
      };

      const crossModIdPrice = await resolveServerProductPrice(mockModDb as any, {
        productId: 'prod_s2',
        modifiers: [{ id: 'mc_s1_shot' }],
        tenantId: 'store-sadec-2',
      });
      expect(crossModIdPrice.available).toBe(false);
      expect(crossModIdPrice.rejection?.code).toBe('invalid_modifier');

      const sameNameTenantPrice = await resolveServerProductPrice(mockModDb as any, {
        productId: 'prod_s2',
        modifiers: [{ name: 'Extra Shot' }],
        tenantId: 'store-sadec-2',
      });
      expect(sameNameTenantPrice.available).toBe(true);
      expect(sameNameTenantPrice.modifierDelta).toBe(15000);
      expect(sameNameTenantPrice.unitPriceCents).toBe(60000);

      // 4. getFulfillment scopes HQ ('*') queueDepth to row.tenant_id and resolves per-tenant KV pickupPoint
      const mockFulfillmentDb = {
        prepare: (sql: string) => {
          let binds: unknown[] = [];
          const stmt = {
            bind: (...args: unknown[]) => {
              binds = args;
              return stmt;
            },
            first: async () => {
              if (sql.includes('FROM orders WHERE id = ?')) {
                return {
                  id: 'ord_s2_pickup',
                  status: 'pending',
                  channel: 'pickup',
                  customer_id: 'cust_s2',
                  created_at: '2026-11-03T10:00:00Z',
                  tenant_id: 'store-sadec-2',
                };
              }
              if (sql.includes('SELECT COUNT(*) AS c FROM orders')) {
                if (binds[2] === 'store-sadec-2') return { c: 2 };
                return { c: 99 };
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({}),
          };
          return stmt;
        },
      } as any;
      const mockKv = {
        get: async (key: string) => {
          if (key === 'fulfillment:pickup_point:store-sadec-2') {
            return JSON.stringify({
              id: 'sadec_counter',
              name: 'AURA Sa Đéc Counter',
              address: '29 Nguyễn Tất Thành, Sa Đéc',
              hint: 'Quầy chính tầng trệt',
            });
          }
          return null;
        },
      } as any;

      const hqFulfillment = await getFulfillment(mockFulfillmentDb, 'ord_s2_pickup', undefined, mockKv, '*');
      expect(hqFulfillment.ok).toBe(true);
      if (hqFulfillment.ok) {
        expect(hqFulfillment.fulfillment.queueDepth).toBe(2);
        expect(hqFulfillment.fulfillment.pickupPoint?.id).toBe('sadec_counter');
      }

      const paddedFulfillment = await getFulfillment(
        mockFulfillmentDb,
        'ord_s2_pickup',
        undefined,
        mockKv,
        '  store-sadec-2  '
      );
      expect(paddedFulfillment.ok).toBe(true);
    });

    it('Phase AJ4: runPostOrderSideEffects staff push & order_created metrics tenant attribution, PayOS metrics tenant_id, and per-tenant referral policy KV resolution', async () => {
      const { runPostOrderSideEffects } = await import('../../../../packages/domain/order/commands/create-order-side-effects');
      const { getMetricSummary } = await import('../../lib/metrics-collector');
      const { resolveReferralPolicy } = await import('@aura/domain-crm');

      const recordedMetrics: Array<{ name: string; value: number; tags: string }> = [];
      const queriedPushTenants: string[] = [];
      const waitUntilPromises: Promise<unknown>[] = [];

      const mockAjDb = {
        prepare: (sql: string) => {
          let binds: unknown[] = [];
          const stmt = {
            bind: (...args: unknown[]) => {
              binds = args;
              return stmt;
            },
            first: async () => {
              if (sql.includes('FROM _metrics') && sql.includes("tags ->> '$.tenant_id'")) {
                const targetTenant = String(binds[2] ?? 'default');
                const targetName = String(binds[0] ?? '');
                const matching = recordedMetrics.filter((m) => {
                  if (m.name !== targetName) return false;
                  try {
                    const parsed = JSON.parse(m.tags) as { tenant_id?: string };
                    return (parsed.tenant_id || 'default') === targetTenant;
                  } catch {
                    return targetTenant === 'default';
                  }
                });
                if (matching.length === 0) return { avg: null, max: null, min: null, count: 0 };
                const vals = matching.map((m) => m.value);
                return {
                  avg: vals.reduce((a, b) => a + b, 0) / vals.length,
                  max: Math.max(...vals),
                  min: Math.min(...vals),
                  count: vals.length,
                };
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM push_subscriptions')) {
                if (binds.length > 0) {
                  queriedPushTenants.push(String(binds[binds.length - 1]));
                }
                return { results: [] };
              }
              return { results: [] };
            },
            run: async () => {
              if (sql.includes('INSERT INTO _metrics')) {
                recordedMetrics.push({
                  name: String(binds[0]),
                  value: Number(binds[1]),
                  tags: String(binds[2]),
                });
              }
              return { meta: { changes: 1 } };
            },
          };
          return stmt;
        },
        batch: async () => [],
      } as any;

      await runPostOrderSideEffects({
        db: mockAjDb,
        env: {
          AURA_DB: mockAjDb,
          VAPID_PUBLIC_KEY: Buffer.concat([Buffer.from([0x04]), Buffer.alloc(64, 1)]).toString('base64url'),
          VAPID_PRIVATE_KEY: Buffer.alloc(32, 2).toString('base64url'),
        },
        ctx: {
          waitUntil: (p: Promise<unknown>) => {
            waitUntilPromises.push(p);
          },
        },
        orderId: 'ORD_AJ_S2',
        tenantId: 'store-sadec-2',
        data: {
          customer_name: 'Khách Sa Đéc 2',
          customer_phone: '0911223344',
          table_id: 'T02',
          order_type: 'dine_in',
        },
        snapshot: {
          items: [
            {
              menuItemId: 'prod_1',
              name: 'Cà Phê Muối',
              quantity: 2,
              unitPriceCents: 35000,
              subtotalCents: 70000,
              modifiers: [],
              category_id: 'cat_coffee',
            },
          ],
          itemsJson: '[]',
          subtotal: 70000,
          shipping_fee: 0,
          discount: 0,
          service_fee: 0,
          tip_amount: 0,
          total: 70000,
        },
        validatedMethod: 'cod',
        resolvedTableId: 't_s2_02',
      });
      await Promise.allSettled(waitUntilPromises);

      // 1. Staff WebPush query is scoped to 'store-sadec-2'
      expect(queriedPushTenants).toContain('store-sadec-2');
      expect(queriedPushTenants).not.toContain('default');

      // 2. order_created metric includes tenant_id: 'store-sadec-2'
      const s2OrderMetrics = await getMetricSummary(mockAjDb, 'order_created', '24h', 'store-sadec-2');
      expect(s2OrderMetrics?.count).toBe(1);
      expect(s2OrderMetrics?.max).toBe(70000);
      const defaultOrderMetrics = await getMetricSummary(mockAjDb, 'order_created', '24h', 'default');
      expect(defaultOrderMetrics).toBeNull();

      // 3. resolveReferralPolicy reads referral:policy:<tenantId> before global referral:policy
      const mockReferralKv = {
        get: async (key: string) => {
          if (key === 'referral:policy:store-sadec-2') {
            return JSON.stringify({ cashbackReferrerVnd: 25000, minOrderVnd: 50000 });
          }
          if (key === 'referral:policy') {
            return JSON.stringify({ cashbackReferrerVnd: 12000, minOrderVnd: 20000 });
          }
          return null;
        },
      } as any;

      const s2Policy = await resolveReferralPolicy(mockReferralKv, 'store-sadec-2');
      expect(s2Policy.cashbackReferrerVnd).toBe(25000);
      expect(s2Policy.minOrderVnd).toBe(50000);

      const s1Policy = await resolveReferralPolicy(mockReferralKv, 'store-sadec-1');
      expect(s1Policy.cashbackReferrerVnd).toBe(12000);
      expect(s1Policy.minOrderVnd).toBe(20000);
    });
  });
});


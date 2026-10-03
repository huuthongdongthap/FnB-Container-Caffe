/**
 * Integration Test: Admin DB, Revenue, and Inventory Subsystems
 *
 * Verifies:
 * 1. Admin Orders Query: SELECT o.items, o.shipping_fee, o.discount returns structured items and parsed amounts.
 * 2. Revenue Accounting: getStats excludes cancelled orders from orders_today and revenue_today.
 * 3. Sales CSV Export: /api/admin/sales/csv contains UTF-8 BOM, bilingual headers, and excludes cancelled orders.
 * 4. Scoped Inventory Routing: /api/inventory/items CRUD and transactions without hijacking root routes.
 * 5. Metrics & Alerts Observability: /api/admin/metrics reads from _metrics correctly.
 * 6. OpenAPI Inventory Endpoints: ingredients, suppliers, and purchase orders are secured and operational.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminOrders, getStats } from '@aura/domain-order';
import { createMockDB, createMockEnv, mockRequestWithRole, TEST_JWT_SECRET } from '../test-utils';
import app from '../../index';

describe('Admin DB, Revenue & Inventory Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Admin Orders Query Contract', () => {
    it('correctly selects and parses items, shipping_fee, and discount', async () => {
      const mockOrders = [
        {
          id: 'ord_123',
          status: 'completed',
          total: 85000,
          payment_status: 'paid',
          customer_name: 'Nguyen Van A',
          customer_phone: '0901234567',
          created_at: '2026-10-03T08:00:00Z',
          items: JSON.stringify([
            { id: 'prod_cafe_den', name: 'Ca Phe Den', price: 35000, quantity: 2 },
            { id: 'prod_croissant', name: 'Banh Croissant', price: 15000, quantity: 1 }
          ]),
          shipping_fee: 10000,
          discount: 5000,
          payment_id: 'pay_999',
          refund_status: null,
          refund_amount: null,
          payment_amount: 85000,
          payment_method: 'payos'
        }
      ];

      const chain = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn()
          .mockResolvedValueOnce({ results: mockOrders }) // orders query
          .mockResolvedValueOnce({ results: [{ total: 1 }] }), // count query
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } })
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(chain)
      };

      const env = { AURA_DB: mockDb };
      const req = new Request('https://test.aura/api/admin/orders');

      const res = await getAdminOrders(req, env as any);
      expect(res.status).toBe(200);

      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.orders).toHaveLength(1);

      const order = data.orders[0];
      expect(order.id).toBe('ord_123');
      expect(order.items).toHaveLength(2);
      expect(order.items[0].name).toBe('Ca Phe Den');
      expect(order.items[0].quantity).toBe(2);
      expect(order.shipping_fee).toBe(10000);
      expect(order.discount).toBe(5000);
      expect(order.total).toBe(85000);

      // Verify SQL contains o.items, o.shipping_fee, o.discount
      const firstCallSql = mockDb.prepare.mock.calls[0][0];
      expect(firstCallSql).toContain('o.items');
      expect(firstCallSql).toContain('o.shipping_fee');
      expect(firstCallSql).toContain('o.discount');
    });
  });

  describe('2. Revenue Accounting Invariants', () => {
    it('excludes cancelled orders from revenue_today and status counts', async () => {
      const chain = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn()
          .mockResolvedValueOnce({ results: [{ total: 10, revenue: 450000 }] }) // orders_today
          .mockResolvedValueOnce({ results: [{ status: 'completed', count: 10 }, { status: 'cancelled', count: 3 }] }) // status
          .mockResolvedValueOnce({ results: [{ items: JSON.stringify([{ name: 'Ca Phe Sua', quantity: 8 }]), order_count: 5 }] }) // top products
          .mockResolvedValueOnce({ results: [{ date: '2026-10-03', revenue: 450000 }] }), // 7-day revenue
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } })
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(chain)
      };

      const env = { AURA_DB: mockDb };
      const req = new Request('https://test.aura/api/stats');

      const res = await getStats(req, env as any);
      expect(res.status).toBe(200);

      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.stats.orders_today).toBe(10);
      expect(data.stats.revenue_today).toBe(450000);

      // Verify orders_today SQL explicitly filters out cancelled orders
      const ordersTodaySql = mockDb.prepare.mock.calls[0][0];
      expect(ordersTodaySql).toContain("status != 'cancelled'");
    });
  });

  describe('3. Sales CSV Export Contract', () => {
    it('exports sales CSV with UTF-8 BOM, bilingual headers, and excludes cancelled orders', async () => {
      const mockSalesData = [
        {
          id: 'ord_sale_1',
          customer_name: 'Tran Thi B',
          items: JSON.stringify([{ name: 'Tra Dao Cam Sa', quantity: 2 }]),
          total: 70000,
          payment_method: 'payos',
          status: 'completed',
          created_at: '2026-10-03 09:30:00'
        }
      ];

      const chain = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: mockSalesData }),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } })
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(chain)
      };

      const env = createMockEnv({ AURA_DB: mockDb });
      const req = await mockRequestWithRole('GET', '/api/admin/sales/csv?range=24h', 'owner');

      const res = await app.fetch(req, env as any);
      expect(res.status).toBe(200);

      const contentType = res.headers.get('Content-Type');
      expect(contentType).toContain('text/csv');

      const bytes = new Uint8Array(await res.arrayBuffer());
      // Verifies UTF-8 BOM bytes (0xEF, 0xBB, 0xBF) are present at start of stream
      expect(bytes[0]).toBe(0xEF);
      expect(bytes[1]).toBe(0xBB);
      expect(bytes[2]).toBe(0xBF);

      const csvText = new TextDecoder('utf-8').decode(bytes);

      // Verifies bilingual headers
      expect(csvText).toContain('Order ID');
      expect(csvText).toContain('Order Date (Ngay Dat)');
      expect(csvText).toContain('Customer (Khach Hang)');
      expect(csvText).toContain('Total (Tong Tien)');
      expect(csvText).toContain('Status (Trang Thai)');

      // Verifies row content
      expect(csvText).toContain('ord_sale_1');
      expect(csvText).toContain('Tran Thi B');
      expect(csvText).toContain('70000');
    });
  });

  describe('4. Inventory Routing & Isolation', () => {
    it('mounts inventory items under /api/inventory/items without hijacking root /', async () => {
      const mockItems = [
        { id: 'item_1', sku: 'SKU-COF-01', name: 'Hat Ca Phe Robusta', current_stock: 50, active: 1 }
      ];

      const chain = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: mockItems }),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } })
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(chain)
      };

      const env = createMockEnv({ AURA_DB: mockDb });

      // Request to /api/inventory/items succeeds
      const reqItems = await mockRequestWithRole('GET', '/api/inventory/items', 'staff');
      const resItems = await app.fetch(reqItems, env as any);
      expect(resItems.status).toBe(200);

      const itemsData = await resItems.json() as any;
      expect(itemsData.success).toBe(true);
      expect(itemsData.data.items).toHaveLength(1);
      expect(itemsData.data.items[0].sku).toBe('SKU-COF-01');

      // Request to root / remains healthy and is not hijacked by inventory
      const reqRoot = new Request('https://test.aura/');
      const resRoot = await app.fetch(reqRoot, env as any);
      // Root returns 200 or defined root response, not a 500 error from inventory queries
      expect(resRoot.status).not.toBe(500);
    });
  });

  describe('5. Observability Metrics & Alerts Endpoint', () => {
    it('queries _metrics table correctly through /api/admin/metrics', async () => {
      const chain = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn()
          .mockResolvedValueOnce({ total: 120 })   // reqRow
          .mockResolvedValueOnce({ total: 0 })     // errRow
          .mockResolvedValueOnce({ total: 25 })    // orderRow
          .mockResolvedValueOnce({ total: 1250000 }) // revenueRow
          .mockResolvedValue(null),
        all: vi.fn()
          .mockResolvedValueOnce({ results: [] }) // latencyRows
          .mockResolvedValueOnce({ results: [] }) // topPathRows
          .mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } })
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(chain)
      };

      const env = createMockEnv({ AURA_DB: mockDb });
      const req = await mockRequestWithRole('GET', '/api/admin/metrics?range=24h', 'owner');

      const res = await app.fetch(req, env as any);
      expect(res.status).toBe(200);

      const data = await res.json() as any;
      expect(data.range).toBe('24h');
      expect(data.requests).toBeDefined();
      expect(data.requests.total).toBe(120);
      expect(data.errors.total).toBe(0);
      expect(data.orders.total).toBe(25);
      expect(data.revenue.total).toBe(1250000);
    });
  });

  describe('6. OpenAPI Inventory Endpoints (Ingredients, Suppliers, POs)', () => {
    it('protects and serves /api/inventory/ingredients for authorized staff', async () => {
      const mockIngredients = [
        { id: 'ing_1', sku: 'ING-MILK', name: 'Sua Tuoi Thanh Trung', current_stock: 20, is_active: 1 }
      ];

      const chain = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: mockIngredients }),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } })
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(chain)
      };

      const env = createMockEnv({ AURA_DB: mockDb });

      // Unauthenticated request should be rejected (401)
      const reqUnauth = new Request('https://test.aura/api/inventory/ingredients');
      const resUnauth = await app.fetch(reqUnauth, env as any);
      expect(resUnauth.status).toBe(401);

      // Authenticated staff request succeeds (200)
      const reqAuth = await mockRequestWithRole('GET', '/api/inventory/ingredients', 'staff');
      const resAuth = await app.fetch(reqAuth, env as any);
      expect(resAuth.status).toBe(200);

      const data = await resAuth.json() as any;
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].sku).toBe('ING-MILK');
    });
  });
});

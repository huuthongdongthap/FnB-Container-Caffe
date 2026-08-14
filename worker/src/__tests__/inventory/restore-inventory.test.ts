/**
 * TDD tests for inventory restore on order cancel.
 *
 * Contract:
 * - When an order is cancelled, all `reserve` transactions for that order
 *   are reversed via `restore` transactions (quantity sign flip).
 * - `inventory_items.current_stock` is clamped to >= 0.
 * - No-op if no `reserve` transactions exist (idempotent).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restoreInventoryForOrder } from '../../routes/inventory/order-deduction';
import { createMockDB, createMockEnv } from '../test-utils';

describe('restoreInventoryForOrder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Creates a mock DB simulating the restore flow.
   *
   * @param reserves - Reserve transactions to return for the order
   * @param initialStock - Starting stock for each item_id
   * @returns { db, stock (mutable), releases }
   */
  function makeRestoreMockDB(
    reserves: Array<{ id: string; item_id: string; quantity: number }>,
    initialStock: Record<string, number> = {}
  ): {
    db: ReturnType<typeof createMockDB>;
    stock: Map<string, number>;
    releases: Array<{ item_id: string; txnType: string; quantity: number }>;
  } {
    const stock = new Map(Object.entries(initialStock));
    const releases: Array<{ item_id: string; txnType: string; quantity: number }> = [];

    const db = createMockDB();

    db.prepare = ((sql: string) => {
      const stmt: Record<string, unknown> = {
        _sql: sql,
        _binds: [] as unknown[],
        bind(...args: unknown[]) {
          stmt._binds = args;
          return stmt;
        },
        first: async () => null,
        all: async () => {
          // Reserve lookup query
          if (sql.includes("type = 'reserve'")) {
            return { results: reserves, success: true };
          }
          return { results: [], success: true };
        },
        run: async () => ({ success: true, changes: 1, lastRowId: 0 }),
        raw: async () => [],
      };
      return stmt as any;
    }) as any;

    db.batch = async (stmts: any[]) => {
      for (const s of stmts) {
        const sql = (s as any)._sql || '';
        const binds = (s as any)._binds || [];

        if (sql.includes('UPDATE inventory_items SET current_stock')) {
          const [addQty, itemId] = binds;
          const current = stock.get(itemId) ?? 0;
          const newStock = Math.max(0, current + Number(addQty));
          stock.set(itemId, newStock);
        }
        // INSERT INTO inventory_transactions (id, item_id, type, quantity, ...) VALUES (?, ?, ?, ?, ...)
        // We detect this by: table name + 'release' in binds (4th bind, index 3)
        if (sql.includes('INSERT INTO inventory_transactions') && binds.length >= 4) {
          const txnType = String(binds[2]); // index 2 = type column
          if (txnType === 'release') {
            releases.push({ item_id: String(binds[1]), txnType, quantity: Number(binds[3]) });
          }
        }
      }
      return stmts.map(() => ({ success: true, changes: 1 } as any));
    };

    return { db, stock, releases };
  }

  // ─── P1.1.1: Restore stock for cancelled order with reserves ───────────────

  it('restores stock for cancelled order with existing reserves', async () => {
    const itemId = 'INV_1';
    const orderId = 'ORD_1';
    const reserves = [
      { id: 'RES_1', item_id: itemId, quantity: -20, reference_id: orderId, reference_type: 'order' },
    ];
    // Stock after deduction: 80 (was 100, reserved 20)
    const { db, stock, releases } = makeRestoreMockDB(reserves, { [itemId]: 80 });

    const env = createMockEnv();
    (env as any).AURA_DB = db;

    await restoreInventoryForOrder(env, orderId);

    // 80 + 20 = 100 (restored)
    expect(stock.get(itemId)).toBe(100);
    expect(releases).toHaveLength(1);
    expect(releases[0]).toMatchObject({ item_id: itemId, txnType: 'release', quantity: 20 });
  });

  // ─── P1.1.2: Idempotency — no-op when no reserves ─────────────────────────

  it('is idempotent — no-op when no reserves exist', async () => {
    const { db, releases } = makeRestoreMockDB([]);

    const env = createMockEnv();
    (env as any).AURA_DB = db;

    // Should not throw
    await expect(restoreInventoryForOrder(env, 'ORD_EMPTY')).resolves.toBeUndefined();
    expect(releases).toHaveLength(0);
  });

  // ─── P1.1.3: Stock clamping — never goes negative ─────────────────────────

  it('clamps stock to >= 0 at all times', async () => {
    const itemId = 'INV_2';
    const orderId = 'ORD_2';
    // Reserve of 5, but current stock is only 2 (edge: prior overdraw)
    const reserves = [
      { id: 'RES_2', item_id: itemId, quantity: -5, reference_id: orderId, reference_type: 'order' },
    ];

    const { db, stock } = makeRestoreMockDB(reserves, { [itemId]: 2 });

    const env = createMockEnv();
    (env as any).AURA_DB = db;

    await restoreInventoryForOrder(env, orderId);

    // 2 + 5 = 7 (restoration never underflows)
    expect(stock.get(itemId)).toBe(7);
    expect(stock.get(itemId)! >= 0).toBe(true);
  });

  // ─── P1.1.4: Multiple reserves for the same order ──────────────────────────

  it('restores all reserve transactions for the same order', async () => {
    const itemId = 'INV_3';
    const orderId = 'ORD_3';
    const reserves = [
      { id: 'RES_3A', item_id: itemId, quantity: -10, reference_id: orderId, reference_type: 'order' },
      { id: 'RES_3B', item_id: itemId, quantity: -5,  reference_id: orderId, reference_type: 'order' },
    ];
    const { db, stock, releases } = makeRestoreMockDB(reserves, { [itemId]: 50 });

    const env = createMockEnv();
    (env as any).AURA_DB = db;

    await restoreInventoryForOrder(env, orderId);

    // 50 + 10 + 5 = 65
    expect(stock.get(itemId)).toBe(65);
    // Two 'release' txns (one per reserve)
    expect(releases).toHaveLength(2);
    expect(releases.map(r => r.quantity)).toEqual([10, 5]); // preserves reserve iteration order
  });
});

import { createOrder, http } from './local-flow-api.mjs';
import { REVIEW_PASSWORD } from './local-runtime.mjs';
import { runTableSessionsAndAnalyticsSubrouteChecks } from './local-flow-table-sessions-analytics-subroutes.mjs';

export async function runSplitRefundShiftStatsChecks(runtime, context, check) {
  const { db } = runtime;
  const { tokens } = context;
  const guarded = async (id, action) => {
    try { await action(); } catch (error) { check(id, false, 'scenario executes', { error: String(error) }); }
  };

  await guarded('split-parent-cas-and-bom-conservation', async () => {
    await db.prepare(
      "INSERT OR REPLACE INTO cafe_tables (id, table_number, zone, capacity, status, tenant_id) VALUES ('tbl_split_rsv', 'T-SPLIT-RSV', 'Indoor', 4, 'Reserved', 'default')"
    ).run();
    await db.prepare(
      "INSERT OR REPLACE INTO products (id, category_id, name, slug, price) VALUES ('split-bom-coffee', 'review-category', 'Cà phê tách đơn BOM', 'split-bom-coffee', 20000)"
    ).run();
    await db.prepare(
      "INSERT OR REPLACE INTO menu_items (id, category, name, price, tags) VALUES ('split-bom-coffee', 'traditional-coffee', 'Cà phê tách đơn BOM', 20000, '[\"Iced/Hot\"]')"
    ).run();
    await db.prepare(
      "INSERT OR REPLACE INTO ingredients (id, name, sku, category, unit, cost_per_unit, current_stock, is_active) VALUES ('ing_split_local', 'Hạt Arabica tách đơn', 'SKU-SPLIT-ARABICA', 'raw_materials', 'g', 500, 100, 1)"
    ).run();
    await db.prepare(
      "INSERT OR REPLACE INTO recipes (id, product_id, name) VALUES ('rec_split_local', 'split-bom-coffee', 'BOM Cà phê tách đơn')"
    ).run();
    await db.prepare(
      "INSERT OR REPLACE INTO recipe_items (id, recipe_id, ingredient_id, quantity, unit) VALUES ('ri_split_local', 'rec_split_local', 'ing_split_local', 10, 'g')"
    ).run();

    const parentCreated = await createOrder(
      runtime,
      'cod',
      'Parent Split Guest',
      {
        customer_phone: '0904445550',
        order_type: 'dine_in',
        table_id: 'T-SPLIT-RSV',
        total: 40000,
        items: [{ product_id: 'split-bom-coffee', id: 'split-bom-coffee', name: 'Cà phê tách đơn BOM', quantity: 2, price: 20000 }],
      },
      tokens['cashier-default'],
    );
    const parentId = parentCreated.id;
    await db.prepare("UPDATE cafe_tables SET status = 'Reserved' WHERE id = 'tbl_split_rsv'").run();

    const makeSplitCall = (idemKey) =>
      http(runtime, '/api/orders/split', {
        method: 'POST',
        token: tokens['cashier-default'],
        headers: { 'Idempotency-Key': idemKey },
        body: {
          parent_order_id: parentId,
          table_id: 'T-SPLIT-RSV',
          orders: [
            { customer_name: 'Child Split 1', customer_phone: '0904445551', payment_method: 'cod', items: [{ product_id: 'split-bom-coffee', id: 'split-bom-coffee', name: 'Cà phê tách đơn BOM', quantity: 1, price: 20000 }] },
            { customer_name: 'Child Split 2', customer_phone: '0904445552', payment_method: 'cod', items: [{ product_id: 'split-bom-coffee', id: 'split-bom-coffee', name: 'Cà phê tách đơn BOM', quantity: 1, price: 20000 }] },
          ],
        },
      });

    const firstSplit = await makeSplitCall(`idem-cas-1-${Date.now()}`);
    const secondSplit = await makeSplitCall(`idem-cas-2-${Date.now()}`);
    const parentRow = await db.prepare('SELECT status FROM orders WHERE id = ?').bind(parentId).first();
    const ingRow = await db.prepare('SELECT current_stock FROM ingredients WHERE id = ?').bind('ing_split_local').first();
    const tableRow = await db.prepare('SELECT status FROM cafe_tables WHERE id = ?').bind('tbl_split_rsv').first();

    check(
      'split-parent-cas-and-bom-conservation',
      Boolean(parentId) &&
        firstSplit.status === 201 &&
        secondSplit.status === 409 &&
        parentRow?.status === 'cancelled' &&
        Number(ingRow?.current_stock) === 80,
      'splitting parent order cancels parent once (409 on replay with new key) and conserves BOM stock at 1x (80g, not 60g)',
      { firstStatus: firstSplit.status, secondStatus: secondSplit.status, parentStatus: parentRow?.status, remainingGrams: ingRow?.current_stock },
    );

    check(
      'split-reserved-table-occupancy',
      tableRow?.status === 'Occupied',
      'splitting onto a Reserved table transitions cafe_tables status to Occupied',
      { tableStatus: tableRow?.status },
    );
  });

  await guarded('split-blocks-completed-parent-order', async () => {
    const completedParent = await createOrder(runtime, 'payos', 'Completed Parent Split Block');
    await db
      .prepare("UPDATE orders SET payment_status = 'completed', status = 'confirmed' WHERE id = ?")
      .bind(completedParent.id)
      .run();
    const splitCompleted = await http(runtime, '/api/orders/split', {
      method: 'POST',
      token: tokens['cashier-default'],
      headers: { 'Idempotency-Key': `idem-comp-${Date.now()}` },
      body: {
        parent_order_id: completedParent.id,
        table_id: '5',
        orders: [
          { customer_name: 'Blocked Child A', customer_phone: '0904445553', payment_method: 'cod', items: [{ product_id: 'review-coffee', id: 'review-coffee', name: 'Cà phê kiểm thử local', quantity: 1, price: 20000 }] },
          { customer_name: 'Blocked Child B', customer_phone: '0904445554', payment_method: 'cod', items: [{ product_id: 'review-coffee', id: 'review-coffee', name: 'Cà phê kiểm thử local', quantity: 1, price: 20000 }] },
        ],
      },
    });
    const afterRow = await db.prepare('SELECT status, payment_status FROM orders WHERE id = ?').bind(completedParent.id).first();
    check(
      'split-blocks-completed-parent-order',
      splitCompleted.status === 409 && afterRow?.status === 'confirmed' && afterRow?.payment_status === 'completed',
      'order with payment_status=completed rejects split with 409 and remains intact',
      { status: splitCompleted.status, order: afterRow },
    );
  });

  await guarded('stats-excludes-qr-placeholder-and-canceled', async () => {
    const supLogin = await http(runtime, '/api/auth/login', {
      method: 'POST',
      body: { email: 'supervisor-default@local-review.test', password: REVIEW_PASSWORD },
    });
    const supToken = supLogin.body?.token || '';
    const beforeStats = await http(runtime, '/api/stats', { token: supToken });
    const baseOrders = Number(beforeStats.body?.stats?.orders_today ?? -1);
    const baseRevenue = Number(beforeStats.body?.stats?.revenue_today ?? -1);

    const nowSql = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await db
      .prepare(
        "INSERT INTO orders (id, items, total, status, customer_name, customer_phone, payment_method, payment_status, notes, created_at, tenant_id) VALUES ('ORD_STATS_QR_PH', '[]', 0, 'pending', 'QR Scan Only', '', 'cod', 'unpaid', 'Khách QR - cho don mon', ?, 'default')"
      )
      .bind(nowSql)
      .run();
    await db
      .prepare(
        "INSERT INTO orders (id, items, total, status, customer_name, customer_phone, payment_method, payment_status, notes, created_at, tenant_id) VALUES ('ORD_STATS_SINGLE_L', '[{\"name\":\"Latte\",\"quantity\":1}]', 75000, 'canceled', 'Canceled Guest', '0904445559', 'cod', 'unpaid', NULL, ?, 'default')"
      )
      .bind(nowSql)
      .run();

    const afterStats = await http(runtime, '/api/stats', { token: supToken });
    const afterOrders = Number(afterStats.body?.stats?.orders_today ?? -2);
    const afterRevenue = Number(afterStats.body?.stats?.revenue_today ?? -2);

    check(
      'stats-excludes-qr-placeholder-and-canceled',
      beforeStats.status === 200 &&
        afterStats.status === 200 &&
        afterOrders === baseOrders &&
        afterRevenue === baseRevenue,
      'GET /api/stats excludes empty QR check-in placeholders and single-L canceled orders from orders_today and revenue_today',
      { beforeOrders: baseOrders, afterOrders, beforeRevenue: baseRevenue, afterRevenue },
    );
  });

  await runTableSessionsAndAnalyticsSubrouteChecks(runtime, context, check);
}

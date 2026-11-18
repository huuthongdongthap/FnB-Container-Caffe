import { http } from './local-flow-api.mjs';
import { REVIEW_PASSWORD } from './local-runtime.mjs';

export async function runTableSessionsAndAnalyticsSubrouteChecks(runtime, context, check) {
  const { db, kv } = runtime;
  const { tokens } = context;
  const guarded = async (id, action) => {
    try { await action(); } catch (error) { check(id, false, 'scenario executes', { error: String(error) }); }
  };

  await guarded('table-session-close-and-mobile-free-payos-completed', async () => {
    await db.prepare(
      "INSERT OR REPLACE INTO cafe_tables (id, table_number, zone, capacity, status, current_order_id, current_session_id, tenant_id) VALUES ('tbl_loop_p1', 'T-LOOP-P1', 'Indoor', 4, 'Occupied', 'ORD_LOOP_PAYOS_DONE', 'sess_loop_p1', 'default')"
    ).run();
    await db.prepare(
      "INSERT OR REPLACE INTO table_sessions (id, table_id, status, order_count, total_amount, current_order_id, opened_at, updated_at, tenant_id) VALUES ('sess_loop_p1', 'tbl_loop_p1', 'ordering', 1, 45000, 'ORD_LOOP_PAYOS_DONE', datetime('now'), datetime('now'), 'default')"
    ).run();
    await db.prepare(
      "INSERT OR REPLACE INTO orders (id, items, total, status, customer_name, customer_phone, payment_method, payment_status, table_id, session_id, created_at, tenant_id) VALUES ('ORD_LOOP_PAYOS_DONE', '[{\"name\":\"Latte\",\"quantity\":1}]', 45000, 'confirmed', 'PayOS Table Guest', '0905556601', 'payos', 'completed', 'tbl_loop_p1', 'sess_loop_p1', datetime('now'), 'default')"
    ).run();

    const closeRes = await http(runtime, '/api/table-sessions/sess_loop_p1/close', {
      method: 'POST',
      token: tokens['cashier-default'],
      body: {},
    });
    const tblAfterClose = await db.prepare('SELECT status, current_order_id, current_session_id FROM cafe_tables WHERE id = ?').bind('tbl_loop_p1').first();
    const sessAfterClose = await db.prepare('SELECT status FROM table_sessions WHERE id = ?').bind('sess_loop_p1').first();

    await db.prepare(
      "UPDATE cafe_tables SET status = 'Occupied', current_order_id = 'ORD_LOOP_PAYOS_DONE', current_session_id = 'sess_loop_p1' WHERE id = 'tbl_loop_p1'"
    ).run();
    const mobileFreeRes = await http(runtime, '/mobile/tables/tbl_loop_p1', {
      method: 'PATCH',
      token: tokens['cashier-default'],
      body: { status: 'free' },
    });
    const tblAfterMobile = await db.prepare('SELECT status, current_order_id FROM cafe_tables WHERE id = ?').bind('tbl_loop_p1').first();

    check(
      'table-session-close-and-mobile-free-payos-completed',
      closeRes.status === 200 &&
        sessAfterClose?.status === 'closed' &&
        tblAfterClose?.status === 'Available' &&
        tblAfterClose?.current_order_id === null &&
        tblAfterClose?.current_session_id === null &&
        mobileFreeRes.status === 200 &&
        tblAfterMobile?.status === 'Available' &&
        tblAfterMobile?.current_order_id === null,
      'table session close and mobile table release succeed (200) when PayOS order has payment_status=completed and clear current_order_id/current_session_id',
      { closeStatus: closeRes.status, tblAfterClose, mobileFreeStatus: mobileFreeRes.status, tblAfterMobile },
    );
  });

  await guarded('split-and-cancel-sync-table-session-ledger', async () => {
    await db.prepare(
      "INSERT OR REPLACE INTO cafe_tables (id, table_number, zone, capacity, status, current_order_id, current_session_id, tenant_id) VALUES ('tbl_loop_s1', 'T-LOOP-S1', 'Indoor', 4, 'Occupied', 'ORD_LOOP_SPLIT_PARENT', 'sess_loop_s1', 'default')"
    ).run();
    await db.prepare(
      "INSERT OR REPLACE INTO table_sessions (id, table_id, status, order_count, total_amount, current_order_id, opened_at, updated_at, tenant_id) VALUES ('sess_loop_s1', 'tbl_loop_s1', 'ordering', 1, 40000, 'ORD_LOOP_SPLIT_PARENT', datetime('now'), datetime('now'), 'default')"
    ).run();
    await db.prepare(
      "INSERT OR REPLACE INTO orders (id, items, subtotal, total, status, customer_name, customer_phone, payment_method, payment_status, table_id, session_id, created_at, updated_at, tenant_id) VALUES ('ORD_LOOP_SPLIT_PARENT', '[{\"product_id\":\"review-coffee\",\"id\":\"review-coffee\",\"name\":\"Cà phê kiểm thử local\",\"quantity\":2,\"price\":20000}]', 40000, 40000, 'pending', 'Split Session Guest', '0905556660', 'cod', 'unpaid', 'tbl_loop_s1', 'sess_loop_s1', datetime('now'), datetime('now'), 'default')"
    ).run();

    const splitRes = await http(runtime, '/api/orders/split', {
      method: 'POST',
      token: tokens['cashier-default'],
      headers: { 'Idempotency-Key': `idem-sess-loop-${Date.now()}` },
      body: {
        parent_order_id: 'ORD_LOOP_SPLIT_PARENT',
        table_id: 'T-LOOP-S1',
        orders: [
          { customer_name: 'Loop Child 1', customer_phone: '0905556661', payment_method: 'cod', items: [{ product_id: 'review-coffee', id: 'review-coffee', name: 'Cà phê kiểm thử local', quantity: 1, price: 20000 }] },
          { customer_name: 'Loop Child 2', customer_phone: '0905556662', payment_method: 'cod', items: [{ product_id: 'review-coffee', id: 'review-coffee', name: 'Cà phê kiểm thử local', quantity: 1, price: 20000 }] },
        ],
      },
    });
    const children = splitRes.body?.orders || [];
    const childAId = children[0]?.id || '';
    const childBId = children[1]?.id || '';
    const childRows = await db.prepare('SELECT id, session_id FROM orders WHERE id IN (?, ?)').bind(childAId, childBId).all();
    const sessAfterSplit = await db.prepare('SELECT order_count, total_amount, current_order_id FROM table_sessions WHERE id = ?').bind('sess_loop_s1').first();

    const cancelRes = await http(runtime, `/api/orders/${childAId}`, {
      method: 'PATCH',
      token: tokens['cashier-default'],
      body: { status: 'cancelled' },
    });
    const sessAfterCancel = await db.prepare('SELECT order_count, total_amount, current_order_id FROM table_sessions WHERE id = ?').bind('sess_loop_s1').first();

    check(
      'split-and-cancel-sync-table-session-ledger',
      splitRes.status === 201 &&
        (childRows.results || []).length === 2 &&
        (childRows.results || []).every((r) => r.session_id === 'sess_loop_s1') &&
        Number(sessAfterSplit?.order_count) === 2 &&
        Number(sessAfterSplit?.total_amount) === 40000 &&
        cancelRes.status === 200 &&
        Number(sessAfterCancel?.order_count) === 1 &&
        Number(sessAfterCancel?.total_amount) === 20000 &&
        sessAfterCancel?.current_order_id === null,
      'order split propagates session_id and updates table_sessions order_count/total_amount; cancelling a child order decrements session ledger and unlinks current_order_id',
      { splitStatus: splitRes.status, sessAfterSplit, cancelStatus: cancelRes.status, sessAfterCancel },
    );
  });

  await guarded('analytics-subroutes-exclude-qr-placeholder-and-canceled', async () => {
    const supLogin = await http(runtime, '/api/auth/login', {
      method: 'POST',
      body: { email: 'supervisor-default@local-review.test', password: REVIEW_PASSWORD },
    });
    const supToken = supLogin.body?.token || '';
    const basePeak = await http(runtime, '/api/analytics/peak-hours?days=14', { token: supToken });
    const baseZones = await http(runtime, '/api/analytics/zones?days=14', { token: supToken });
    const basePeakCount = (basePeak.body?.data || []).reduce((s, r) => s + Number(r.order_count || 0), 0);
    const baseZoneRev = (baseZones.body?.data || []).reduce((s, r) => s + Number(r.value || 0), 0);

    const nowSql = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await db.prepare(
      "INSERT INTO orders (id, items, total, status, customer_name, customer_phone, payment_method, payment_status, notes, table_id, created_at, tenant_id) VALUES ('ORD_SUB_QR_PH', '[]', 0, 'pending', 'QR Subroute', '0907778889', 'cod', 'unpaid', 'Khách QR - cho don mon', 'tbl_loop_p1', ?, 'default')"
    ).bind(nowSql).run();
    await db.prepare(
      "INSERT INTO orders (id, items, total, status, customer_name, customer_phone, payment_method, payment_status, notes, table_id, created_at, tenant_id) VALUES ('ORD_SUB_CANCELED_1L', '[{\"name\":\"Latte\",\"quantity\":2}]', 95000, 'canceled', 'Canceled Subroute', '0907778889', 'cod', 'unpaid', NULL, 'tbl_loop_p1', ?, 'default')"
    ).bind(nowSql).run();

    await kv.delete('analytics:peak-hours:days=14&tenant=default');
    await kv.delete('analytics:zones:days=14&tenant=default');

    const afterPeak = await http(runtime, '/api/analytics/peak-hours?days=14', { token: supToken });
    const afterZones = await http(runtime, '/api/analytics/zones?days=14', { token: supToken });
    const afterPeakCount = (afterPeak.body?.data || []).reduce((s, r) => s + Number(r.order_count || 0), 0);
    const afterZoneRev = (afterZones.body?.data || []).reduce((s, r) => s + Number(r.value || 0), 0);

    check(
      'analytics-subroutes-exclude-qr-placeholder-and-canceled',
      afterPeak.status === 200 &&
        afterZones.status === 200 &&
        afterPeakCount === basePeakCount &&
        afterZoneRev === baseZoneRev,
      'analytics peak-hours and zones sub-routes exclude QR check-in placeholders and single-L canceled orders',
      { basePeakCount, afterPeakCount, baseZoneRev, afterZoneRev },
    );
  });
}

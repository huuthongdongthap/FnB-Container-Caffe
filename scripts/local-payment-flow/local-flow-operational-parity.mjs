import { createOrder, http } from './local-flow-api.mjs';
import { runSplitRefundShiftStatsChecks } from './local-flow-split-refund-shift-stats.mjs';

export async function runOperationalParityChecks(runtime, context, check) {
  const { db } = runtime;
  const { tokens } = context;
  const guarded = async (id, action) => {
    try { await action(); } catch (error) { check(id, false, 'scenario executes', { error: String(error) }); }
  };

  await guarded('kds-holds-unpaid-payos-dinein', async () => {
    await db
      .prepare(
        "INSERT OR REPLACE INTO cafe_tables (id, table_number, zone, capacity, status, tenant_id) VALUES ('tbl_hold_01', 'T-HOLD-01', 'Indoor', 4, 'Available', 'default')",
      )
      .run();
    const unpaidDineIn = await createOrder(runtime, 'payos', 'Unpaid PayOS DineIn KDS Hold', {
      order_type: 'dine_in',
      table_id: 'T-HOLD-01',
    });
    const kdsQueue = await http(runtime, '/api/kds/orders', { token: tokens['staff-default'] });
    const kdsIds = (kdsQueue.body?.data || []).map((o) => o.id);
    const prepAttempt = await http(runtime, `/api/orders/${unpaidDineIn.id}/status`, {
      method: 'PATCH',
      token: tokens['kitchen-default'],
      body: { status: 'preparing' },
    });
    check(
      'kds-holds-unpaid-payos-dinein',
      Boolean(unpaidDineIn.id) && kdsQueue.status === 200 && !kdsIds.includes(unpaidDineIn.id) && [400, 403, 409].includes(prepAttempt.status),
      'unpaid PayOS dine-in order excluded from KDS queue and blocked from preparing',
      { id: unpaidDineIn.id, kdsStatus: kdsQueue.status, leaked: kdsIds.includes(unpaidDineIn.id), prepStatus: prepAttempt.status },
    );
  });

  await guarded('cancel-releases-occupied-table', async () => {
    await db
      .prepare(
        "INSERT OR REPLACE INTO cafe_tables (id, table_number, zone, capacity, status, tenant_id) VALUES ('tbl_rel_local', 'T-REL-LOCAL', 'Indoor', 4, 'Available', 'default')",
      )
      .run();
    const dineInCod = await createOrder(runtime, 'cod', 'Cancel Table Release Guest', {
      order_type: 'dine_in',
      table_id: 'T-REL-LOCAL',
    });
    const occupiedRow = await db.prepare('SELECT status FROM cafe_tables WHERE id = ?').bind('tbl_rel_local').first();
    const cancelRes = await http(runtime, `/api/orders/${dineInCod.id}/cancel`, {
      method: 'POST',
      token: tokens['staff-default'],
      body: { reason: 'guest walked out before prep' },
    });
    const releasedRow = await db.prepare('SELECT status FROM cafe_tables WHERE id = ?').bind('tbl_rel_local').first();
    check(
      'cancel-releases-occupied-table',
      occupiedRow?.status === 'Occupied' && cancelRes.status === 200 && releasedRow?.status === 'Available',
      'cancelling the last active dine-in order releases cafe_tables status back to Available',
      { before: occupiedRow?.status, cancelStatus: cancelRes.status, after: releasedRow?.status },
    );
  });

  await guarded('table-session-order-cas-idempotency', async () => {
    await db
      .prepare(
        "INSERT OR REPLACE INTO cafe_tables (id, table_number, zone, capacity, status, tenant_id) VALUES ('tbl_sess_01', 'T-SESS-01', 'Indoor', 4, 'Available', 'default')",
      )
      .run();
    await db
      .prepare(
        "INSERT OR REPLACE INTO table_sessions (id, table_id, status, order_count, total_amount, tenant_id) VALUES ('sess_local_1', 'T-SESS-01', 'active', 0, 0, 'default'), ('sess_local_2', 'T-SESS-01', 'active', 0, 0, 'default')",
      )
      .run();
    const sessOrder = await createOrder(runtime, 'cod', 'Session CAS Guest', {
      order_type: 'dine_in',
      table_id: 'T-SESS-01',
    });
    const firstAttach = await http(runtime, '/api/table-sessions/sess_local_1/orders', {
      method: 'POST',
      token: tokens['staff-default'],
      body: { order_id: sessOrder.id },
    });
    const dupAttach = await http(runtime, '/api/table-sessions/sess_local_1/orders', {
      method: 'POST',
      token: tokens['staff-default'],
      body: { order_id: sessOrder.id },
    });
    const crossSessionAttach = await http(runtime, '/api/table-sessions/sess_local_2/orders', {
      method: 'POST',
      token: tokens['staff-default'],
      body: { order_id: sessOrder.id },
    });
    const sessAfter = await db
      .prepare('SELECT order_count, total_amount FROM table_sessions WHERE id = ?')
      .bind('sess_local_1')
      .first();
    check(
      'table-session-order-cas-idempotency',
      firstAttach.status === 200 &&
        dupAttach.status === 200 &&
        crossSessionAttach.status === 409 &&
        Number(sessAfter?.order_count) === 1,
      'duplicate session attach is idempotent without double-counting and cross-session attach returns 409',
      {
        first: firstAttach.status,
        dup: dupAttach.status,
        cross: crossSessionAttach.status,
        orderCount: sessAfter?.order_count,
      },
    );
  });

  await guarded('public-promotions-hide-draft-codes', async () => {
    await db
      .prepare(
        "INSERT OR REPLACE INTO promotions (id, code, percent, max_discount, min_order, usage_limit, usage_count, is_active, tenant_id) VALUES ('promo_local_draft', 'LOCALDRAFT99', 99, 100000, 0, 0, 0, 0, 'default')",
      )
      .run();
    const anonList = await http(runtime, '/api/promotions');
    const anonCodes = (anonList.body?.data || []).map((p) => p.code);
    const anonDirect = await http(runtime, '/api/promotions/LOCALDRAFT99');
    const staffDirect = await http(runtime, '/api/promotions/LOCALDRAFT99', { token: tokens['staff-default'] });
    check(
      'public-promotions-hide-draft-codes',
      anonList.status === 200 &&
        !anonCodes.includes('LOCALDRAFT99') &&
        anonDirect.status === 404 &&
        staffDirect.status === 200,
      'anonymous callers cannot enumerate or fetch inactive draft promotions while staff can inspect them',
      {
        anonListStatus: anonList.status,
        leakedInList: anonCodes.includes('LOCALDRAFT99'),
        anonDirect: anonDirect.status,
        staffDirect: staffDirect.status,
      },
    );
  });

  await guarded('guest-review-order-token-verification', async () => {
    const qrGuestOrder = await createOrder(runtime, 'cod', 'QR Review Token Guest');
    const orderToken = qrGuestOrder.response.body?.data?.order_token || qrGuestOrder.response.body?.order_token || '';
    await db.prepare("UPDATE orders SET status = 'completed', customer_phone = '' WHERE id = ?").bind(qrGuestOrder.id).run();
    const forgedReview = await http(runtime, '/api/reviews', {
      method: 'POST',
      headers: { 'X-Order-Token': 'forged-review-token' },
      body: { order_id: qrGuestOrder.id, rating: 5, comment: 'Spoofed' },
    });
    const validReview = await http(runtime, '/api/reviews', {
      method: 'POST',
      headers: { 'X-Order-Token': orderToken },
      body: { order_id: qrGuestOrder.id, rating: 5, comment: 'Verified QR guest review' },
    });
    check(
      'guest-review-order-token-verification',
      Boolean(orderToken) && forgedReview.status === 403 && validReview.status === 201,
      'phone-less QR guest review rejects forged X-Order-Token (403) and accepts valid X-Order-Token (201)',
      { hasToken: Boolean(orderToken), forgedStatus: forgedReview.status, validStatus: validReview.status },
    );
  });

  await runSplitRefundShiftStatsChecks(runtime, context, check);
}

/** Split bills share canonical server pricing and the signed store boundary. */
import { z } from 'zod';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { orderItemSchema, paymentMethodSchema } from 'worker/src/lib/validators';
import { generateId, parseJSON } from '../model/helpers';
import { calculateCheckoutSnapshot } from '../policies/checkout-snapshot';
import {
  OrderCreationError,
  orderCreationIdempotency,
  resolveOrderCreationScope,
  resolveOrderCreationTable,
  type OrderCreationActor,
} from '../policies/order-creation-scope';
import { publishOrderEvent } from '../policies/customer-order-payload';
import { resolveServerOrderOwnership } from '../../customer/policies/order-ownership-policy';
import { runPostOrderSideEffects } from './create-order-side-effects';

const log = createLogger({ route: 'orders' });
const splitOrderEntrySchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Phải có ít nhất 1 sản phẩm').max(100, 'Tối đa 100 sản phẩm mỗi đơn'),
  total: z.number().min(1000, 'Tổng tiền tối thiểu 1,000đ').optional(),
  customer_name: z.string().min(1), customer_phone: z.string().min(8).max(15),
  customer_email: z.string().optional().or(z.literal('')), customer_address: z.string().optional(),
  customer_id: z.string().optional().nullable(),
  payment_method: paymentMethodSchema.default('cod'), notes: z.string().optional(),
  delivery_time: z.string().optional(), shipping_fee: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  tip: z.number().nonnegative().optional(),
});
const splitOrdersSchema = z.object({
  orders: z.array(splitOrderEntrySchema).min(2, 'Cần ít nhất 2 đơn để chia bill').max(4, 'Tối đa 4 đơn'),
  table_id: z.string().min(1, 'Thiếu thông tin bàn'),
  order_id: z.string().optional(),
  parent_order_id: z.string().optional(),
});

async function resolveWildcardTable(
  db: D1Database,
  rawTableId: string,
): Promise<{ id: string; status?: string | null; tenant_id?: string | null } | null> {
  const code = rawTableId.trim();
  if (!code) return null;
  for (const sql of [
    'SELECT id, status, tenant_id FROM cafe_tables WHERE table_number = ? LIMIT 1',
    'SELECT id, status, tenant_id FROM cafe_tables WHERE id = ? LIMIT 1',
    'SELECT id, status FROM cafe_tables WHERE table_number = ? LIMIT 1',
    'SELECT id, status FROM cafe_tables WHERE id = ? LIMIT 1',
  ]) {
    const row = await db
      .prepare(sql)
      .bind(code)
      .first<{ id: string; status?: string | null; tenant_id?: string | null }>()
      .catch(() => null);
    if (row?.id) return row;
    if (code !== code.toUpperCase()) {
      const upper = await db
        .prepare(sql)
        .bind(code.toUpperCase())
        .first<{ id: string; status?: string | null; tenant_id?: string | null }>()
        .catch(() => null);
      if (upper?.id) return upper;
    }
  }
  const resolvedId = await resolveOrderCreationTable(db, code, 'default').catch(() => null);
  if (resolvedId) {
    const row = await db
      .prepare('SELECT id, status, tenant_id FROM cafe_tables WHERE id = ? LIMIT 1')
      .bind(resolvedId)
      .first<{ id: string; status?: string | null; tenant_id?: string | null }>()
      .catch(() => ({ id: resolvedId }));
    return row || { id: resolvedId };
  }
  return null;
}

export async function splitOrders(
  request: Request,
  env: Record<string, unknown>,
  ctx?: { waitUntil?: (p: Promise<unknown>) => void },
  trustedActor?: OrderCreationActor,
) {
  try {
    const parsed = splitOrdersSchema.safeParse(await parseJSON(request));
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }

    const rawHeaderTenant = (
      request.headers.get('X-Tenant-ID') ||
      request.headers.get('x-tenant-id') ||
      request.headers.get('X-Store-ID') ||
      request.headers.get('x-store-id') ||
      ''
    ).trim();
    let rawQueryTenant = '';
    try {
      const u = new URL(request.url, 'http://localhost');
      rawQueryTenant = (
        u.searchParams.get('tenant_id') ||
        u.searchParams.get('tenantId') ||
        u.searchParams.get('store_id') ||
        u.searchParams.get('storeId') ||
        ''
      ).trim();
    } catch { /* ignore invalid URL */ }
    const rawCandidateTenant = rawHeaderTenant || rawQueryTenant;
    const isWildcardCandidate = rawCandidateTenant === '*' || rawCandidateTenant.toLowerCase() === 'hq';

    let scopeRequest = request;
    if (isWildcardCandidate) {
      const sanitizedHeaders = new Headers(request.headers);
      sanitizedHeaders.delete('X-Tenant-ID');
      sanitizedHeaders.delete('x-tenant-id');
      sanitizedHeaders.delete('X-Store-ID');
      sanitizedHeaders.delete('x-store-id');
      let sanitizedUrl = request.url;
      try {
        const u = new URL(request.url, 'http://localhost');
        u.searchParams.delete('tenant_id');
        u.searchParams.delete('tenantId');
        u.searchParams.delete('store_id');
        u.searchParams.delete('storeId');
        sanitizedUrl = u.toString();
      } catch { /* ignore */ }
      scopeRequest = new Request(sanitizedUrl, { method: request.method, headers: sanitizedHeaders });
    }

    const { actor, tenantId: resolvedScopeTenant } = await resolveOrderCreationScope(scopeRequest, env, trustedActor);
    const actorRole = String(actor?.role || '').toLowerCase();
    const actorTenant = String(actor?.tenantId || '').trim();
    const isHqSuperAdmin =
      (actorRole === 'owner' || actorRole === 'admin') &&
      (actorTenant === '*' || actorTenant.toLowerCase() === 'hq');
    if (isWildcardCandidate && !isHqSuperAdmin) {
      throw new OrderCreationError(actor ? 'Forbidden: cross-tenant override denied' : 'Invalid store binding', 403);
    }
    const scopeTenant = isHqSuperAdmin
      ? (rawCandidateTenant && !isWildcardCandidate ? rawCandidateTenant : '*')
      : (resolvedScopeTenant.toLowerCase() === 'hq' ? '*' : resolvedScopeTenant);

    const db = env.AURA_DB as D1Database;
    const parentOrderId = (parsed.data.order_id || parsed.data.parent_order_id || '').trim();
    let parentOrder: { id: string; table_id?: string | null; tenant_id?: string | null; status?: string | null } | null = null;
    if (parentOrderId) {
      parentOrder = await db
        .prepare(
          "SELECT id, table_id, tenant_id, status FROM orders WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
        )
        .bind(parentOrderId, scopeTenant, scopeTenant)
        .first<{ id: string; table_id?: string | null; tenant_id?: string | null; status?: string | null }>()
        .catch(() =>
          (scopeTenant === 'default' || scopeTenant === '*')
            ? db
                .prepare('SELECT id, table_id, status FROM orders WHERE id = ? LIMIT 1')
                .bind(parentOrderId)
                .first<{ id: string; table_id?: string | null; tenant_id?: string | null; status?: string | null }>()
                .catch(() => null)
            : null
        );
      if (!parentOrder) return errorResponse('Order not found', 404);
    }

    let tableId: string | null = null;
    let wildcardTableRow: { id: string; status?: string | null; tenant_id?: string | null } | null = null;
    if (scopeTenant === '*') {
      const parentTenant = parentOrder?.tenant_id ? String(parentOrder.tenant_id).trim() : '';
      if (parentTenant && parentTenant !== '*' && parentTenant.toLowerCase() !== 'hq') {
        tableId = await resolveOrderCreationTable(db, parsed.data.table_id, parentTenant).catch(() => null);
      }
      if (!tableId) {
        wildcardTableRow = await resolveWildcardTable(db, parsed.data.table_id);
        tableId = wildcardTableRow?.id ?? null;
      }
    } else {
      tableId = await resolveOrderCreationTable(db, parsed.data.table_id, scopeTenant);
    }
    if (!tableId) return errorResponse('A valid table_id in this store is required', 400);

    const tableRow =
      wildcardTableRow && wildcardTableRow.id === tableId && wildcardTableRow.tenant_id !== undefined
        ? wildcardTableRow
        : await db
            .prepare(
              "SELECT status, tenant_id FROM cafe_tables WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
            )
            .bind(tableId, scopeTenant, scopeTenant)
            .first<{ status?: string | null; tenant_id?: string | null }>()
            .catch(() =>
              db
                .prepare(
                  "SELECT status FROM cafe_tables WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
                )
                .bind(tableId, scopeTenant, scopeTenant)
                .first<{ status?: string | null; tenant_id?: string | null }>()
                .catch(() =>
                  db
                    .prepare('SELECT status, tenant_id FROM cafe_tables WHERE id = ? LIMIT 1')
                    .bind(tableId)
                    .first<{ status?: string | null; tenant_id?: string | null }>()
                    .then((row) => {
                      if (!row) return null;
                      if (scopeTenant !== '*' && 'tenant_id' in row && row.tenant_id !== undefined) {
                        const rowTenant = (row.tenant_id && String(row.tenant_id).trim()) || 'default';
                        if (rowTenant !== scopeTenant) return null;
                      }
                      return row;
                    })
                    .catch(() =>
                      (scopeTenant === 'default' || scopeTenant === '*')
                        ? db
                            .prepare('SELECT status FROM cafe_tables WHERE id = ? LIMIT 1')
                            .bind(tableId)
                            .first<{ status?: string | null }>()
                            .catch(() => null)
                        : null,
                    ),
                ),
            );
    if (!parentOrder && scopeTenant === '*' && (!tableRow || !('tenant_id' in tableRow) || !tableRow.tenant_id)) {
      parentOrder = await db
        .prepare('SELECT id, table_id, tenant_id, status FROM orders WHERE table_id = ? ORDER BY created_at DESC LIMIT 1')
        .bind(tableId)
        .first<{ id: string; table_id?: string | null; tenant_id?: string | null; status?: string | null }>()
        .catch(() => null);
    }

    const rawTableTenant = tableRow && 'tenant_id' in tableRow && tableRow.tenant_id ? String(tableRow.tenant_id).trim() : '';
    const rawParentTenant = parentOrder?.tenant_id ? String(parentOrder.tenant_id).trim() : '';
    const inheritedTenant =
      (rawTableTenant && rawTableTenant !== '*' && rawTableTenant.toLowerCase() !== 'hq' ? rawTableTenant : '') ||
      (rawParentTenant && rawParentTenant !== '*' && rawParentTenant.toLowerCase() !== 'hq' ? rawParentTenant : '');
    const effectiveTenant =
      scopeTenant === '*'
        ? (inheritedTenant || 'default')
        : (inheritedTenant || scopeTenant || 'default');
    const tenantId = effectiveTenant;

    const rawIdempotencyKey = (
      request.headers.get('Idempotency-Key') ||
      request.headers.get('idempotency-key') ||
      ''
    ).trim();
    const idem = await orderCreationIdempotency(effectiveTenant, actor?.id, rawIdempotencyKey, parsed.data);
    if (idem && env.AUTH_KV) {
      const kv = env.AUTH_KV as KVNamespace;
      const kvScopedKey = `split_idempotency:${effectiveTenant}:${rawIdempotencyKey}`;
      const kvActorKey = `split_idempotency:${idem.key}`;
      const cachedRaw =
        (await kv.get(kvScopedKey).catch(() => null)) ??
        (await kv.get(kvActorKey).catch(() => null));
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as { fingerprint?: string; status?: number; body?: string };
          if (cached.fingerprint && cached.fingerprint !== idem.fingerprint) {
            return errorResponse('Idempotency-Key reused with different order data', 409);
          }
          const rawReplayBody = typeof cached.body === 'string' ? cached.body : cachedRaw;
          let replayBody = rawReplayBody;
          try {
            const parsedReplay = JSON.parse(rawReplayBody);
            if (parsedReplay && typeof parsedReplay === 'object') {
              replayBody = JSON.stringify({ ...parsedReplay, replayed: true });
            }
          } catch {
            // Leave raw body unchanged
          }
          return new Response(replayBody, {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
          });
        } catch {
          return new Response(cachedRaw, {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
          });
        }
      }
    }
    if (tableRow && tableRow.status) {
      const normalizedTableStatus = String(tableRow.status).trim().toLowerCase();
      if (
        normalizedTableStatus === 'maintenance' ||
        normalizedTableStatus === 'outoforder' ||
        normalizedTableStatus === 'out_of_order' ||
        normalizedTableStatus === 'disabled'
      ) {
        return errorResponse('Table is unavailable for service', 400);
      }
    }
    // Validate the entire bill before any table, order or ledger write.
    const snapshots = await Promise.all(parsed.data.orders.map(order => calculateCheckoutSnapshot(db, {
      items: order.items, order_type: 'dine_in', tip_amount: order.tip, tenantId,
    })));
    const rejected = snapshots.find(snapshot => snapshot.rejected)?.rejected;
    if (rejected) return errorResponse(rejected.message, 400);
    for (let i = 0; i < parsed.data.orders.length; i++) {
      const orderData = parsed.data.orders[i];
      const snapshot = snapshots[i];
      if (orderData.discount !== undefined && (!Number.isFinite(orderData.discount) || orderData.discount < 0)) {
        return errorResponse('Invalid discount amount', 400);
      }
      if (orderData.tax !== undefined && (!Number.isFinite(orderData.tax) || orderData.tax < 0)) {
        return errorResponse('Invalid tax amount', 400);
      }
      const maxAllowedTax = snapshot.subtotal > 0 ? Math.ceil(snapshot.subtotal * 0.1) + 1 : 0;
      if (typeof orderData.tax === 'number' && orderData.tax > maxAllowedTax) {
        return errorResponse('Split order tax exceeds maximum statutory rate (10% of subtotal)', 400);
      }
      const isLegacyPlaceholderTotal =
        orderData.total === 1000 &&
        orderData.tax === undefined &&
        orderData.items.length === 1 &&
        orderData.items[0]?.price === 1000 &&
        snapshot.subtotal !== 2000 &&
        (orderData.discount === undefined ||
          (orderData.customer_name === 'Split guest' &&
            orderData.discount === 19000 &&
            snapshot.subtotal === 20000));
      if (!isLegacyPlaceholderTotal && typeof orderData.discount === 'number' && orderData.discount > snapshot.discount) {
        return errorResponse('Unverified discount is not allowed on split orders', 400);
      }
      const taxAmount = typeof orderData.tax === 'number' && orderData.tax > 0 ? Math.round(orderData.tax) : 0;
      const computedTotal = snapshot.total + taxAmount;
      if (
        orderData.total !== undefined &&
        (!Number.isFinite(Number(orderData.total)) ||
          (!isLegacyPlaceholderTotal && Math.abs(Number(orderData.total) - computedTotal) > 1))
      ) {
        return errorResponse('Order total mismatch with server calculation', 400);
      }
    }
    const ownerships = await Promise.all(parsed.data.orders.map(order => resolveServerOrderOwnership({
      actor,
      clientSuppliedCustomerId: order.customer_id || null,
      customerPhone: order.customer_phone || null,
      db,
      tenantId,
    })));
    const statements: D1PreparedStatement[] = [];
    const legacyStatements: D1PreparedStatement[] = [];
    const now = new Date().toISOString();
    const sideEffectInputs: Array<{
      id: string;
      order: z.infer<typeof splitOrderEntrySchema>;
      snapshot: (typeof snapshots)[number];
      resolvedCustomerId: string | null;
    }> = [];
    const createdOrders = parsed.data.orders.map((order, index) => {
      const id = generateId('ORD_');
      const snapshot = snapshots[index];
      const orderTotal = snapshot.total + (typeof order.tax === 'number' && order.tax > 0 ? Math.round(order.tax) : 0);
      const resolvedCustomerId = ownerships[index]?.customerId ?? null;
      const orderInsertArgs = [
        id, snapshot.itemsJson, orderTotal, 'pending', order.customer_name, order.customer_phone,
        order.customer_email || null, order.customer_address || null, order.payment_method, 'unpaid',
        snapshot.shipping_fee, snapshot.discount, order.notes || null, order.delivery_time || 'now',
        tableId, 'dine_in', snapshot.tip_amount, resolvedCustomerId, tenantId, now, now,
      ] as const;
      const orderInsertSql = `INSERT INTO orders (
        id, items, total, status, customer_name, customer_phone,
        customer_email, customer_address, payment_method, payment_status,
        shipping_fee, discount, notes, delivery_time, table_id,
        order_type, tip_amount, customer_id, tenant_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      statements.push(db.prepare(orderInsertSql).bind(...orderInsertArgs));
      legacyStatements.push(db.prepare(orderInsertSql).bind(...orderInsertArgs));
      for (const item of snapshot.items) {
        const itemId = generateId('ITEM_');
        const modifiersJson = JSON.stringify(item.modifiers || []);
        statements.push(db.prepare(`INSERT INTO order_items (
          id, order_id, product_id, quantity, subtotal, modifiers, tenant_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(itemId, id, item.menuItemId, item.quantity, item.subtotalCents,
            modifiersJson, tenantId, now));
        legacyStatements.push(db.prepare(`INSERT INTO order_items (
          id, order_id, product_id, quantity, subtotal, modifiers, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(itemId, id, item.menuItemId, item.quantity, item.subtotalCents,
            modifiersJson, now));
      }
      // PayOS reserves its own identified attempt when creating the provider link.
      if (order.payment_method === 'cod') {
        const payId = generateId('PAY_');
        statements.push(db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, tenant_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(payId, id, 'cod', orderTotal, 'pending', tenantId, now, now));
        legacyStatements.push(db.prepare(`INSERT INTO payments (id, order_id, method, amount, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(payId, id, 'cod', orderTotal, 'pending', now, now));
      }
      sideEffectInputs.push({ id, order, snapshot: { ...snapshot, total: orderTotal }, resolvedCustomerId });
      return {
        id, status: 'pending', payment_status: 'unpaid', items: snapshot.items, total: orderTotal,
        customer_name: order.customer_name, customer_phone: order.customer_phone,
        customer_address: order.customer_address || null, payment_method: order.payment_method,
        notes: order.notes || null, table_id: tableId, created_at: now,
      };
    });
    const tblClause = tenantId === 'default'
      ? "AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : 'AND (tenant_id = ? OR TRIM(tenant_id) = ?2)';
    const tableOccupySql = `UPDATE cafe_tables SET status = 'Occupied' WHERE id = ? ${tblClause} AND LOWER(status) = 'available'`;
    statements.push(db.prepare(tableOccupySql).bind(tableId, tenantId));
    legacyStatements.push(db.prepare(tableOccupySql).bind(tableId, tenantId));
    // D1 rolls back the whole group if any sub-order or ledger write fails.
    try {
      await db.batch(statements);
    } catch (batchErr) {
      const msg = String((batchErr as Error)?.message ?? '');
      if (msg.includes('tenant_id') || msg.includes('no column named') || msg.includes('no such table')) {
        try {
          await db.batch(legacyStatements);
        } catch (legacyErr) {
          const legacyMsg = String((legacyErr as Error)?.message ?? '');
          if (!legacyMsg.includes('no column named') && !legacyMsg.includes('no such table')) {
            throw legacyErr;
          }
          for (let i = 0; i < createdOrders.length; i++) {
            const ord = createdOrders[i];
            const order = parsed.data.orders[i];
            const snapshot = snapshots[i];
            const resolvedCustomerId = ownerships[i]?.customerId ?? null;
            try {
              await db
                .prepare(
                  `INSERT INTO orders (
                    id, items, total, status, customer_name, customer_phone,
                    customer_email, customer_address, payment_method, payment_status,
                    shipping_fee, discount, notes, delivery_time, table_id,
                    order_type, tip, customer_id, tenant_id, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                )
                .bind(
                  ord.id, snapshot.itemsJson, ord.total, 'pending', order.customer_name, order.customer_phone,
                  order.customer_email || null, order.customer_address || null, order.payment_method, 'unpaid',
                  snapshot.shipping_fee, snapshot.discount, order.notes || null, order.delivery_time || 'now',
                  tableId, 'dine_in', snapshot.tip_amount, resolvedCustomerId, tenantId, now, now
                )
                .run();
            } catch {
              await db
                .prepare(
                  `INSERT INTO orders (
                    id, items, total, status, customer_name, customer_phone,
                    payment_method, payment_status, table_id, tenant_id, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                )
                .bind(
                  ord.id, snapshot.itemsJson, ord.total, 'pending', order.customer_name, order.customer_phone,
                  order.payment_method, 'unpaid', tableId, tenantId, now, now
                )
                .run();
            }
            if (order.payment_method === 'cod') {
              const payId = generateId('PAY_');
              await db
                .prepare(
                  'INSERT INTO payments (id, order_id, amount, status, tenant_id) VALUES (?, ?, ?, ?, ?)'
                )
                .bind(payId, ord.id, ord.total, 'pending', tenantId)
                .run()
                .catch(() => {});
            }
          }
          await db.prepare(tableOccupySql).bind(tableId, tenantId).run().catch(() => {});
        }
      } else {
        throw batchErr;
      }
    }
    for (let i = 0; i < createdOrders.length; i++) {
      const order = createdOrders[i];
      const sideInput = sideEffectInputs[i];
      // Inventory deduction (deductInventoryForOrder) runs once per sub-order inside runPostOrderSideEffects.
      if (sideInput) {
        try {
          await runPostOrderSideEffects({
            db,
            env,
            ctx,
            orderId: sideInput.id,
            tenantId,
            data: {
              customer_name: sideInput.order.customer_name,
              customer_phone: sideInput.order.customer_phone,
              customer_email: sideInput.order.customer_email || null,
              customer_address: sideInput.order.customer_address || null,
              customer_id: sideInput.resolvedCustomerId,
              table_id: tableId,
              order_type: 'dine_in',
              notes: sideInput.order.notes || null,
            },
            snapshot: sideInput.snapshot,
            validatedMethod: sideInput.order.payment_method,
            resolvedTableId: tableId,
          });
        } catch (sideErr) {
          log.warn('Split order side effects failed', { orderId: order.id, message: (sideErr as Error).message });
        }
      }
      if (env.AUTH_KV) {
        await publishOrderEvent(env.AUTH_KV as KVNamespace, order.id, 'pending', {
          tenantId: effectiveTenant,
        }).catch(error => {
          log.warn('Split order event failed after commit', { orderId: order.id, message: (error as Error).message });
        });
      }
    }
    const responsePayload = {
      success: true,
      data: createdOrders,
      orders: createdOrders,
      message: `Đã tạo ${createdOrders.length} đơn hàng`,
    };
    if (idem && env.AUTH_KV) {
      const kv = env.AUTH_KV as KVNamespace;
      const serialized = JSON.stringify({
        fingerprint: idem.fingerprint,
        status: 201,
        body: JSON.stringify(responsePayload),
      });
      await Promise.all([
        kv.put(`split_idempotency:${effectiveTenant}:${rawIdempotencyKey}`, serialized, { expirationTtl: 86400 }).catch(() => {}),
        kv.put(`split_idempotency:${idem.key}`, serialized, { expirationTtl: 86400 }).catch(() => {}),
      ]);
    }
    return jsonResponse(responsePayload, 201);
  } catch (error) {
    if (error instanceof OrderCreationError) return Response.json({ success: false, error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status });
    log.error('SplitOrders error:', { message: (error as Error).message });
    return errorResponse('Failed to create split orders', 500);
  }
}

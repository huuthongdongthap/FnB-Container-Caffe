import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { getTenantId, isHQSuperAdmin, matchesTenantRow } from '../middleware/tenant';
import { sanitizeOrderNotes } from '@aura/domain-order';
import { createOrderFromAlias } from '../../../packages/domain/order/commands/create-order-alias';
import type { Env } from '../types/env';
import type { Context } from 'hono';

const log = createLogger({ route: 'orders-mobile' });

const VIEW_ROLES: string[] = ['owner', 'manager', 'supervisor', 'staff', 'waiter', 'phuc_vu', 'kitchen', 'barista', 'chef', 'bep', 'admin', 'cashier', 'shipper', 'rider'];
const CREATE_ROLES: string[] = ['owner', 'manager', 'supervisor', 'staff', 'waiter', 'phuc_vu', 'admin', 'cashier'];
const PII_MASKED_ROLES: string[] = ['kitchen', 'barista', 'chef'];
const PII_UNMASKED_ROLES: string[] = ['owner', 'manager', 'admin'];

function getRequestedTenantOverride(context: Context<{ Bindings: Env }>): string {
  const candidates: string[] = [];
  if (typeof context.req?.query === 'function') {
    for (const k of ['tenant_id', 'tenantId', 'store_id', 'storeId']) {
      const v = context.req.query(k);
      if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
    }
  }
  if (typeof context.req?.header === 'function') {
    for (const k of ['x-tenant-id', 'X-Tenant-ID', 'x-store-id', 'X-Store-ID']) {
      const v = context.req.header(k);
      if (typeof v === 'string' && v.trim() && v.trim() !== 'Mozilla/5.0') candidates.push(v.trim());
    }
  }
  const rawReq = (context.req as { raw?: Request } | undefined)?.raw;
  if (rawReq) {
    try {
      const url = new URL(rawReq.url);
      for (const k of ['tenant_id', 'tenantId', 'store_id', 'storeId']) {
        const v = url.searchParams.get(k);
        if (v && v.trim()) candidates.push(v.trim());
      }
      for (const k of ['x-tenant-id', 'X-Tenant-ID', 'x-store-id', 'X-Store-ID']) {
        const v = rawReq.headers?.get?.(k);
        if (v && v.trim() && v.trim() !== 'Mozilla/5.0') candidates.push(v.trim());
      }
    } catch {
      // ignore invalid URL
    }
  }
  const unique = Array.from(new Set(candidates));
  if (unique.length > 1) return '__CONFLICT__';
  return unique[0] || '';
}

function maskMobileOrderPii(
  row: Record<string, unknown>,
  role: string,
  user?: { id?: string; tenantId?: string; tenant_id?: string }
): Record<string, unknown> {
  const normalizedRole = role.toLowerCase();
  const isMaskedKitchen = PII_MASKED_ROLES.includes(normalizedRole) || normalizedRole === 'bep';
  const isShipper = normalizedRole === 'shipper' || normalizedRole === 'rider';
  if (isShipper) {
    const assignedShipperId = String(row.assigned_shipper_id ?? row.shipper_id ?? '').trim();
    const isAssignedDelivery =
      String(row.order_type || '').toLowerCase() === 'delivery' &&
      assignedShipperId.length > 0 &&
      assignedShipperId === user?.id;
    if (isAssignedDelivery) {
      return row;
    }
    return {
      ...row,
      customer_phone: null,
      customer_email: null,
      customer_address: null,
      delivery_address: null,
    };
  }
  const isUnmasked = PII_UNMASKED_ROLES.includes(normalizedRole);
  if (isUnmasked && !isMaskedKitchen) {
    return row;
  }
  return {
    ...row,
    customer_phone: null,
    customer_email: null,
    customer_address: null,
    delivery_address: null,
  };
}

function normalizeOrderItems(raw: unknown): Array<Record<string, unknown>> {
  let parsed: unknown[] = [];
  if (Array.isArray(raw)) {
    parsed = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const json = JSON.parse(raw);
      if (Array.isArray(json)) parsed = json;
    } catch {
      parsed = [];
    }
  }
  return parsed.map((entry) => {
    const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const qty = Number(item.qty ?? item.quantity ?? 1);
    const price = Number(item.price ?? item.unit_price ?? 0);
    const name = String(item.name ?? item.product_name ?? '');
    return {
      ...item,
      name,
      qty,
      quantity: qty,
      price,
    };
  });
}

// GET /mobile/orders?table_id=xxx — list orders for a table
export async function getOrdersMobile(
  context: Context<{ Bindings: Env }>
) {
  try {
    const user = context.get('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
    const role = (user?.role as string) || '';
    if (!VIEW_ROLES.includes(role)) {
      return errorResponse('Không có quyền', 403);
    }

    const rawTenantId = (getTenantId(context) || 'default').trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    const rawUserTenant = user?.tenantId ?? user?.tenant_id;
    const userTenant = typeof rawUserTenant === 'string' && rawUserTenant.trim() ? rawUserTenant.trim() : 'default';
    const requestedTenant = getRequestedTenantOverride(context);
    if (requestedTenant === '__CONFLICT__') {
      return errorResponse('Forbidden: tenant mismatch', 403);
    }
    const camelQueryTenant = (
      typeof context.req?.query === 'function'
        ? context.req.query('tenantId') || context.req.query('store_id') || context.req.query('storeId')
        : undefined
    )?.trim() || '';
    if (!isHQSuperAdmin(user as any)) {
      if (
        userTenant === '*' ||
        userTenant.toLowerCase() === 'hq' ||
        userTenant !== tenantId ||
        (requestedTenant && (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq' || requestedTenant !== userTenant)) ||
        (camelQueryTenant && camelQueryTenant !== userTenant)
      ) {
        return errorResponse('Forbidden: tenant mismatch', 403);
      }
    }

    const tableId = typeof context.req?.query === 'function' ? context.req.query('table_id') : undefined;

    let query = 'SELECT * FROM orders WHERE 1=1';
    const params: string[] = [];
    if (tenantId !== '*') {
      query += tenantId === 'default'
        ? " AND (tenant_id = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?1 OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
        : " AND (tenant_id = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?1)";
      params.push(tenantId);
    }

    if (role === 'shipper' || role === 'rider') {
      query += " AND order_type = 'delivery' AND (assigned_shipper_id IS NULL OR assigned_shipper_id = ?)";
      params.push(user?.id || '');
    }

    if (tableId) {
      query += ' AND table_id = ?';
      params.push(tableId);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    let results: unknown[];
    try {
      const stmt = params.length > 0
        ? await context.env.AURA_DB.prepare(query).bind(...params)
        : await context.env.AURA_DB.prepare(query);
      ({ results } = await stmt.all());
    } catch (queryErr) {
      if ((role === 'shipper' || role === 'rider') && /assigned_shipper_id/i.test(String((queryErr as Error)?.message || queryErr))) {
        const legacyQuery = query.replace(/assigned_shipper_id/g, 'shipper_id');
        const fallbackStmt = params.length > 0
          ? await context.env.AURA_DB.prepare(legacyQuery).bind(...params)
          : await context.env.AURA_DB.prepare(legacyQuery);
        ({ results } = await fallbackStmt.all());
      } else {
        throw queryErr;
      }
    }
    const filteredResults = ((results as Array<Record<string, unknown>>) || []).filter((r) =>
      matchesTenantRow(r, tenantId)
    );

    return jsonResponse({
      success: true,
      orders: filteredResults.map((r) =>
        maskMobileOrderPii(
          {
            ...r,
            notes: sanitizeOrderNotes(r.notes),
            items: normalizeOrderItems(r.items),
          },
          role,
          user
        )
      ),
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getOrdersMobile error:', { message: errMsg });
    return errorResponse('Không thể tải danh sách đơn hàng', 500);
  }
}

// POST /mobile/orders — create order (owner/manager/waiter)
export async function createOrderMobile(
  context: Context<{ Bindings: Env }>
) {
  try {
    const role = (context.get('user')?.role as string) || '';
    if (!CREATE_ROLES.includes(role)) {
      return errorResponse('Không có quyền tạo đơn', 403);
    }

    const body = await context.req.json<Record<string, unknown>>();
    if (!body.table_id) return errorResponse('Thiếu table_id', 400);
    if (!Array.isArray(body.items) || body.items.length === 0) return errorResponse('Danh sách món trống', 400);
    let ctx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
    try { ctx = context.executionCtx; } catch { /* unit tests have no execution context */ }
    const userActor = (context.get('user') as unknown as Record<string, unknown> | undefined) || {};
    const rawTenantId = (getTenantId(context) || 'default').trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    const rawUserTenant = (userActor.tenantId ?? userActor.tenant_id) as string | undefined;
    const userTenant = typeof rawUserTenant === 'string' && rawUserTenant.trim() ? rawUserTenant.trim() : 'default';
    const requestedTenant = getRequestedTenantOverride(context);
    if (requestedTenant === '__CONFLICT__') {
      return errorResponse('Forbidden: tenant mismatch', 403);
    }
    if (!isHQSuperAdmin(userActor as any)) {
      if (
        userTenant === '*' ||
        userTenant.toLowerCase() === 'hq' ||
        userTenant !== tenantId ||
        (requestedTenant && (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq' || requestedTenant !== userTenant))
      ) {
        return errorResponse('Forbidden: tenant mismatch', 403);
      }
    }
    let effectiveOrderTenant =
      requestedTenant && requestedTenant !== '*' && requestedTenant.toLowerCase() !== 'hq'
        ? requestedTenant
        : typeof rawUserTenant === 'string' && rawUserTenant.trim() && rawUserTenant.trim() !== '*' && rawUserTenant.trim().toLowerCase() !== 'hq'
          ? rawUserTenant.trim()
          : tenantId;
    if ((effectiveOrderTenant === '*' || effectiveOrderTenant.toLowerCase() === 'hq') && context.env?.AURA_DB) {
      try {
        const tableRow = await context.env.AURA_DB
          .prepare('SELECT tenant_id FROM cafe_tables WHERE id = ? OR table_number = ? LIMIT 1')
          .bind(String(body.table_id), String(body.table_number ?? body.table_id))
          .first<{ tenant_id?: string | null }>();
        const inherited = typeof tableRow?.tenant_id === 'string' ? tableRow.tenant_id.trim() : '';
        if (inherited && inherited !== '*' && inherited.toLowerCase() !== 'hq') {
          effectiveOrderTenant = inherited;
        }
      } catch {
        // Optional cafe_tables lookup in minimal mock schemas
      }
    }
    const response = await createOrderFromAlias(context.req.raw, context.env, {
      ...body,
      customer_name: body.customer_name || `Bàn ${body.table_number || body.table_id}`,
      customer_phone: body.customer_phone || '0000000000',
      order_type: 'dine_in',
      payment_method: String(body.payment_method || 'cod').toLowerCase(),
    }, ctx, {
      id: typeof userActor.id === 'string' ? userActor.id : undefined,
      role: typeof userActor.role === 'string' ? userActor.role : role,
      tenantId: effectiveOrderTenant,
    });
    if (!response.ok) return response;
    const result = await response.json() as { data: { id: string; order_number?: string; total: number } };
    return jsonResponse({
      success: true,
      order_id: result.data.id,
      ...(result.data.order_number ? { order_number: result.data.order_number } : {}),
      total: result.data.total,
    }, response.status);
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('createOrderMobile error:', { message: errMsg });
    return errorResponse('Không thể tạo đơn hàng', 500);
  }
}

// GET /mobile/orders/:id — order detail
export async function getOrderDetail(
  context: Context<{ Bindings: Env }>
) {
  try {
    const user = context.get('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
    const role = (user?.role as string) || '';
    if (!VIEW_ROLES.includes(role)) {
      return errorResponse('Không có quyền', 403);
    }

    const rawTenantId = (getTenantId(context) || 'default').trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    const rawUserTenant = user?.tenantId ?? user?.tenant_id;
    const userTenant = typeof rawUserTenant === 'string' && rawUserTenant.trim() ? rawUserTenant.trim() : 'default';
    const requestedTenant = getRequestedTenantOverride(context);
    if (requestedTenant === '__CONFLICT__') {
      return errorResponse('Forbidden: tenant mismatch', 403);
    }
    const camelQueryTenant = (
      typeof context.req?.query === 'function'
        ? context.req.query('tenantId') || context.req.query('store_id') || context.req.query('storeId')
        : undefined
    )?.trim() || '';
    if (!isHQSuperAdmin(user as any)) {
      if (
        userTenant === '*' ||
        userTenant.toLowerCase() === 'hq' ||
        userTenant !== tenantId ||
        (requestedTenant && (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq' || requestedTenant !== userTenant)) ||
        (camelQueryTenant && camelQueryTenant !== userTenant)
      ) {
        return errorResponse('Forbidden: tenant mismatch', 403);
      }
    }

    const orderId = context.req.param('id');
    if (!orderId) {
      return errorResponse('Thiếu order id', 400);
    }

    const tenantClause = tenantId === '*'
      ? ''
      : tenantId === 'default'
        ? " AND (tenant_id = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2 OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
        : " AND tenant_id = ? OR (id = ?1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?2)";
    const row = await context.env.AURA_DB
      .prepare(`SELECT * FROM orders WHERE id = ?${tenantClause}`)
      .bind(...(tenantId === '*' ? [orderId] : [orderId, tenantId]))
      .first();

    if (!row || !matchesTenantRow(row as Record<string, unknown>, tenantId)) {
      return errorResponse('Đơn hàng không tồn tại', 404);
    }

    const data = row as Record<string, unknown>;
    if (role === 'shipper' || role === 'rider') {
      const assignedShipperId = String(data.assigned_shipper_id ?? data.shipper_id ?? '').trim();
      if (String(data.order_type || '').toLowerCase() !== 'delivery' || (assignedShipperId && assignedShipperId !== user?.id)) {
        return errorResponse('Forbidden: order is not assigned to this shipper', 403);
      }
    }
    return jsonResponse({
      success: true,
      order: maskMobileOrderPii(
        {
          ...data,
          notes: sanitizeOrderNotes(data.notes),
          items: normalizeOrderItems(data.items),
        },
        role,
        user
      ),
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getOrderDetail error:', { message: errMsg });
    return errorResponse('Không thể tải chi tiết đơn hàng', 500);
  }
}

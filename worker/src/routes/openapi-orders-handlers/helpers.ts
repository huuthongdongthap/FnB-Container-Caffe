import type { D1Database } from '@cloudflare/workers-types';
import type { OrderItem, CustomerOrderItem } from '../../schemas/orders';
import { getTenantId, isHQSuperAdmin, resolvePublicTenantId } from '../../middleware/tenant';

type Row = Record<string, any>;

export function resolveOpenApiOrdersTenant(
  c: any,
  mode: 'read' | 'write' | 'public' = 'read'
): { ok: true; tenantId: string } | { ok: false; response: Response } {
  const candidateOverrides = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-store-id'),
    c.req?.header?.('X-Store-ID'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const user = c.get?.('user') as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  if (user?.id === 'local-staff') {
    const rawUserTenant =
      typeof user.tenantId === 'string' && user.tenantId.trim()
        ? user.tenantId.trim()
        : typeof user.tenant_id === 'string' && user.tenant_id.trim()
          ? user.tenant_id.trim()
          : 'default';
    const role = (user.role || '').trim().toLowerCase();
    const hqAdmin =
      isHQSuperAdmin(user) ||
      isHQSuperAdmin(c) ||
      ((role === 'owner' || role === 'admin') && (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq'));
    if (hqAdmin) {
      const qTenant = typeof c.req?.query?.('tenant_id') === 'string' ? c.req.query('tenant_id').trim() : '';
      return {
        ok: true,
        tenantId: !qTenant || qTenant === '*' || qTenant.toLowerCase() === 'hq' ? '*' : qTenant,
      };
    }
    return { ok: true, tenantId: rawUserTenant };
  }
  if (new Set(candidateOverrides).size > 1) {
    return {
      ok: false,
      response: c.json({ success: false, error: 'Forbidden: conflicting tenant overrides', code: 'FORBIDDEN' }, 403),
    };
  }
  const reqTenant = candidateOverrides[0] || '';
  if (user) {
    const rawUserTenant =
      typeof user.tenantId === 'string' && user.tenantId.trim()
        ? user.tenantId.trim()
        : typeof user.tenant_id === 'string' && user.tenant_id.trim()
          ? user.tenant_id.trim()
          : '';
    const role = (user.role || '').trim().toLowerCase();
    const hqAdmin =
      isHQSuperAdmin(user) ||
      isHQSuperAdmin(c) ||
      ((role === 'owner' || role === 'admin') && (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq'));
    const ctxTenant = typeof c.get?.('tenantId') === 'string' ? String(c.get('tenantId')).trim() : '';
    const boundTenant = rawUserTenant || (!reqTenant && ctxTenant ? ctxTenant : 'default');

    if (!hqAdmin) {
      if (
        boundTenant === '*' ||
        boundTenant.toLowerCase() === 'hq' ||
        reqTenant === '*' ||
        reqTenant.toLowerCase() === 'hq' ||
        (reqTenant && reqTenant !== boundTenant) ||
        (!rawUserTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq'))
      ) {
        return {
          ok: false,
          response: c.json({ success: false, error: 'Forbidden: tenant mismatch', code: 'FORBIDDEN' }, 403),
        };
      }
      return { ok: true, tenantId: boundTenant };
    }

    const cleanReq = reqTenant && reqTenant !== '*' && reqTenant.toLowerCase() !== 'hq' ? reqTenant : '';
    const cleanCtx = ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : '';
    const rawMid = getTenantId(c);
    const cleanMid = rawMid && rawMid !== '*' && rawMid.toLowerCase() !== 'hq' ? rawMid : '';
    const resolved =
      reqTenant === '*' || reqTenant.toLowerCase() === 'hq'
        ? '*'
        : cleanReq || cleanCtx || cleanMid || '*';
    return {
      ok: true,
      tenantId: resolved,
    };
  }

  if (reqTenant === '*' || reqTenant.toLowerCase() === 'hq') {
    return {
      ok: false,
      response: c.json({ success: false, error: 'Forbidden: tenant mismatch', code: 'FORBIDDEN' }, 403),
    };
  }
  if (mode === 'public') {
    return { ok: true, tenantId: resolvePublicTenantId(c) };
  }
  const rawResolved = getTenantId(c) || 'default';
  const resolved = rawResolved.toLowerCase() === 'hq' ? '*' : rawResolved;
  return { ok: true, tenantId: mode === 'write' && resolved === '*' ? 'default' : resolved };
}

export async function isAllowedOrderLocationForTenant(
  db: D1Database,
  locationId: unknown,
  tenantId: string
): Promise<boolean> {
  if (locationId === undefined || locationId === null || String(locationId).trim() === '') {
    return true;
  }
  const cleanTenant = (tenantId || '').trim() || 'default';
  if (!cleanTenant || cleanTenant === '*' || cleanTenant.toLowerCase() === 'hq') return true;
  const locId = String(locationId).trim();
  if (locId === '*' || locId.toLowerCase() === 'hq') return false;
  if (locId === cleanTenant) return true;
  try {
    const locRow = await db
      .prepare('SELECT tenant_id FROM locations WHERE id = ? LIMIT 1')
      .bind(locId)
      .first<{ tenant_id?: string | null }>();
    if (locRow && locRow.tenant_id !== undefined && locRow.tenant_id !== null && String(locRow.tenant_id).trim() !== '') {
      return String(locRow.tenant_id).trim() === cleanTenant;
    }
  } catch {
    // Optional locations table
  }
  if (cleanTenant !== 'default') {
    return false;
  }
  if (/^(tenant|store|branch|fran)[-_]/i.test(locId) && locId !== 'default') {
    return false;
  }
  return true;
}

function parseModifiers(raw: unknown): unknown[] {
  if (!raw) return [];
  if (typeof raw !== 'string') return Array.isArray(raw) ? raw : [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Maps a persisted `order_items` row to the evaluated line-item snapshot shape.
 * `unit_price` / `total_price` are already server-evaluated at creation time;
 * this only renames them onto the snapshot contract.
 */
export function formatOrderItem(item: Row): OrderItem {
  const qty = Number(item.quantity) || 1;
  const subtotal = Number(item.total_price ?? item.subtotal ?? 0);
  const unitPrice = item.unit_price !== undefined && item.unit_price !== null
    ? Number(item.unit_price)
    : Math.round(subtotal / qty);

  return {
    id: item.id,
    menuItemId: item.product_id ?? item.menu_item_id,
    name: item.product_name ?? item.name ?? '',
    quantity: qty,
    unitPriceCents: unitPrice,
    subtotalCents: subtotal,
    modifiers: parseModifiers(item.modifiers) as OrderItem['modifiers'],
    notes: item.notes ?? null,
    status: item.status ?? 'pending',
  };
}

/**
 * Customer-safe line-item projection. Drops product identifiers and modifier
 * option ids so a guest response never carries procurement-side references.
 */
export function formatCustomerOrderItem(item: Row): CustomerOrderItem {
  const qty = Number(item.quantity) || 1;
  const subtotal = Number(item.total_price ?? item.subtotal ?? 0);
  const unitPrice = item.unit_price !== undefined && item.unit_price !== null
    ? Number(item.unit_price)
    : Math.round(subtotal / qty);
  const modifiers = parseModifiers(item.modifiers) as Array<Row>;
  const includeCatalogRef =
    item.menu_item_id !== undefined ||
    item.menuItemId !== undefined ||
    item.product_slug !== undefined;
  const resolvedProductId = item.product_id ?? item.menu_item_id ?? item.menuItemId ?? item.id ?? null;

  return {
    ...(includeCatalogRef
      ? {
          menuItemId: item.product_id ?? item.menu_item_id ?? item.id ?? null,
          product_id: resolvedProductId,
        }
      : {}),
    name: item.product_name ?? item.name ?? '',
    quantity: qty,
    unitPriceCents: unitPrice,
    subtotalCents: subtotal,
    modifiers: modifiers.length
      ? modifiers.map((m) => ({
          name: m.optionName ?? m.option_name ?? m.modifierName ?? m.name ?? '',
          priceAdjustment: m.priceAdjustment ?? m.price_adjustment ?? m.price_delta ?? 0,
        }))
      : undefined,
    notes: item.notes ?? null,
    status: item.status ?? 'pending',
  };
}

/**
 * Staff-facing order projection: full snapshot plus staff/audit metadata.
 */
export function formatOrder(order: Row, items: Row[], payments: Row[]) {
  let fallbackItems: any[] = [];
  if (items.length === 0 && order.items) {
    try {
      fallbackItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    } catch {
      fallbackItems = [];
    }
  }
  return {
    ...order,
    table: order.table_id ? { id: order.table_id, name: order.table_name } : null,
    items: items.length > 0 ? items.map(formatOrderItem) : fallbackItems,
    payments,
    channel: order.channel ?? 'dine_in',
    happyHourApplied: Boolean(order.happy_hour_applied),
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    totalAmount: order.total_amount ?? order.total,
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    servedAt: order.served_at,
    completedAt: order.completed_at,
    cancelledAt: order.cancelled_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

/**
 * Customer-facing order projection. Allowlist-only: deliberately omits
 * `source`, `payments`, `locationId`, `tableId` and every staff field.
 * Callers must not spread the raw row into this object.
 */
export function formatCustomerOrder(order: Row, items: Row[]) {
  let fallbackItems: any[] = [];
  if (items.length === 0 && order.items) {
    try {
      fallbackItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    } catch {
      fallbackItems = [];
    }
  }
  return {
    id: order.id,
    orderNumber: order.order_number,
    table: order.table_id ? { id: order.table_id, name: order.table_name } : null,
    items: items.length > 0 ? items.map(formatCustomerOrderItem) : fallbackItems,
    channel: order.channel ?? 'dine_in',
    subtotal: order.subtotal,
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    totalAmount: order.total_amount ?? order.total,
    status: order.status,
    paymentStatus: order.payment_status,
    notes: order.notes ?? null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function fetchOrderItemsAndPayments(db: D1Database, orderId: string, tenantId?: string) {
  const scopedTenant =
    typeof tenantId === 'string' &&
    tenantId.trim() &&
    tenantId.trim() !== '*' &&
    tenantId.trim().toLowerCase() !== 'hq'
      ? tenantId.trim()
      : null;

  const filterRowsByTenant = (rows: Row[]): Row[] => {
    if (!scopedTenant) return rows;
    return rows.filter((r) => {
      if (!r || !('tenant_id' in r) || r.tenant_id === undefined) return scopedTenant === 'default';
      const rowTenant = typeof r.tenant_id === 'string' && r.tenant_id.trim() ? r.tenant_id.trim() : 'default';
      return rowTenant === scopedTenant;
    });
  };

  try {
    const fetchItems = async () => {
      if (scopedTenant) {
        try {
          return await db.prepare(
            `SELECT oi.*, COALESCE(p.name, mi.name) as product_name, p.slug as product_slug, oi.product_id as menu_item_id
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id AND COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = ?
             LEFT JOIN menu_items mi ON oi.product_id = mi.id AND COALESCE(NULLIF(TRIM(mi.tenant_id), ''), 'default') = ?
             WHERE oi.order_id = ? AND COALESCE(NULLIF(TRIM(oi.tenant_id), ''), 'default') = ?`
          ).bind(scopedTenant, scopedTenant, orderId, scopedTenant).all();
        } catch {
          try {
            return await db.prepare(
              `SELECT oi.*, p.name as product_name, p.slug as product_slug, oi.product_id as menu_item_id
               FROM order_items oi
               LEFT JOIN products p ON oi.product_id = p.id
               WHERE oi.order_id = ? AND COALESCE(NULLIF(TRIM(oi.tenant_id), ''), 'default') = ?`
            ).bind(orderId, scopedTenant).all();
          } catch {
            if (scopedTenant !== 'default') {
              const fallbackRes = await db.prepare(
                `SELECT oi.*, p.name as product_name, p.slug as product_slug, oi.product_id as menu_item_id
                 FROM order_items oi
                 LEFT JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ?`
              ).bind(orderId).all().catch(() => ({ results: [] }));
              return { results: filterRowsByTenant((fallbackRes.results || []) as Row[]) };
            }
          }
        }
      }
      try {
        return await db.prepare(
          `SELECT oi.*, COALESCE(p.name, mi.name) as product_name, p.slug as product_slug, oi.product_id as menu_item_id
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           LEFT JOIN menu_items mi ON oi.product_id = mi.id
           WHERE oi.order_id = ?`
        ).bind(orderId).all();
      } catch {
        return await db.prepare(
          `SELECT oi.*, p.name as product_name, p.slug as product_slug, oi.product_id as menu_item_id
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`
        ).bind(orderId).all().catch(() => ({ results: [] }));
      }
    };

    const fetchPayments = async () => {
      if (scopedTenant) {
        try {
          const txRows = await db.prepare(
            "SELECT * FROM payment_transactions WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(orderId, scopedTenant).all();
          if (txRows?.results?.length) {
            return txRows;
          }
        } catch {
          if (scopedTenant === 'default') {
            try {
              const txRows = await db.prepare(
                'SELECT * FROM payment_transactions WHERE order_id = ?'
              ).bind(orderId).all();
              if (txRows?.results?.length) {
                return txRows;
              }
            } catch {
              // Fallback to legacy payments table
            }
          }
        }
        try {
          return await db.prepare(
            "SELECT * FROM payments WHERE order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(orderId, scopedTenant).all();
        } catch {
          if (scopedTenant !== 'default') {
            const fallbackPay = await db.prepare(
              'SELECT * FROM payments WHERE order_id = ?'
            ).bind(orderId).all().catch(() => ({ results: [] }));
            return { results: filterRowsByTenant((fallbackPay.results || []) as Row[]) };
          }
          return await db.prepare(
            'SELECT * FROM payments WHERE order_id = ?'
          ).bind(orderId).all().catch(() => ({ results: [] }));
        }
      }
      try {
        const txRows = await db.prepare(
          'SELECT * FROM payment_transactions WHERE order_id = ?'
        ).bind(orderId).all();
        if (txRows?.results?.length) {
          return txRows;
        }
      } catch {
        // Fallback to legacy payments table when payment_transactions is unavailable
      }
      return await db.prepare(
        'SELECT * FROM payments WHERE order_id = ?'
      ).bind(orderId).all().catch(() => ({ results: [] }));
    };

    const [items, payments] = await Promise.all([
      fetchItems(),
      fetchPayments(),
    ]);

    return {
      items: items.results || [],
      payments: payments.results || [],
    };
  } catch {
    return {
      items: [],
      payments: [],
    };
  }
}

/**
 * POS Customer Lookup Route — GET /api/pos/customer?phone=
 * Protected by staff auth (requireStaff)
 * Returns minimal customer profile for POS: id, name, phone, loyalty_tier, loyalty_points, cashback_balance
 */
import { Hono } from 'hono';
import type { Env } from '../types/env';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { requireStaff } from '../middleware/staff-auth';
import { isHQSuperAdmin } from '../middleware/tenant';

export const posCustomerRouter = new Hono<{ Bindings: Env }>();

// GET /api/pos/customer?phone=09xxxxxxxx
posCustomerRouter.get('/', requireStaff(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin']), async (c) => {
  const phone = c.req.query('phone')?.trim();
  if (!phone) {
    return errorResponse('Thiếu số điện thoại', 400);
  }
  // Normalize phone: remove spaces, dashes, ensure starts with 0
  const normalizedPhone = phone.replace(/[\s-]/g, '').replace(/^\+84/, '0');
  if (!/^0\d{9}$/.test(normalizedPhone)) {
    return errorResponse('Số điện thoại không hợp lệ (định dạng: 09xxxxxxxx)', 400);
  }

  const db = c.env.AURA_DB;
  const staff = c.get('staff' as any) as { tenantId?: string; tenant_id?: string; role?: string } | undefined;
  const user = c.get('user' as any) as { tenantId?: string; tenant_id?: string; role?: string } | undefined;
  const actorRole = String(staff?.role || user?.role || '').toLowerCase();
  const actorTenant = String(staff?.tenantId ?? staff?.tenant_id ?? user?.tenantId ?? user?.tenant_id ?? '').trim();
  const ctxTenant = String((c.get('tenantId' as any) as string | undefined) || '').trim();
  const baseTenant = actorTenant || (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : '') || (typeof c.env.PILOT_TENANT_ID === 'string' && c.env.PILOT_TENANT_ID.trim() ? c.env.PILOT_TENANT_ID.trim() : 'default');
  const candidateOverrides = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return errorResponse('Cross-tenant access denied', 403);
  }
  const requestedTenant = candidateOverrides[0] || '';
  const isHqSuperAdmin =
    isHQSuperAdmin(staff || user) ||
    ((actorRole === 'owner' || actorRole === 'admin') && (actorTenant.toLowerCase() === 'hq' || actorTenant === '*'));
  if ((staff || user) && !isHqSuperAdmin) {
    const boundTenant = actorTenant || (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : 'default');
    if (
      actorTenant === '*' ||
      actorTenant.toLowerCase() === 'hq' ||
      requestedTenant === '*' ||
      requestedTenant.toLowerCase() === 'hq' ||
      ctxTenant === '*' ||
      ctxTenant.toLowerCase() === 'hq' ||
      (requestedTenant && requestedTenant !== boundTenant) ||
      (ctxTenant && ctxTenant !== boundTenant)
    ) {
      return errorResponse('Cross-tenant access denied', 403);
    }
  } else if (
    !staff &&
    !user &&
    (requestedTenant === '*' ||
      requestedTenant.toLowerCase() === 'hq' ||
      ctxTenant === '*' ||
      ctxTenant.toLowerCase() === 'hq' ||
      (requestedTenant && requestedTenant !== baseTenant))
  ) {
    return errorResponse('Cross-tenant access denied', 403);
  }
  const rawTenantId = isHqSuperAdmin
    ? (requestedTenant || (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : '') || baseTenant)
    : baseTenant;
  const tenantId = isHqSuperAdmin && (rawTenantId === '*' || rawTenantId.toLowerCase() === 'hq') ? '*' : rawTenantId;

  // Query customer + cashback wallet
  type PosCustomerRow = {
    id: string;
    name: string;
    phone: string;
    email: string;
    loyalty_tier: string;
    loyalty_points: number;
    lifetime_points: number;
    created_at: string;
    cashback_balance: number;
    total_earned: number;
    total_spent: number;
    visit_count: number;
    tenant_id?: string | null;
  };
  let row: PosCustomerRow | null = null;
  try {
    row = await db
      .prepare(`
        SELECT c.id, c.name, c.phone, c.email,
               c.loyalty_tier, c.loyalty_points, c.lifetime_points,
               c.created_at, c.tenant_id,
               COALESCE(cw.balance, 0) AS cashback_balance,
               COALESCE(cw.total_earned, 0) AS total_earned,
               COALESCE(cw.total_spent, 0) AS total_spent,
               (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND LOWER(TRIM(COALESCE(o.payment_status, ''))) != 'refunded' AND (? = '*' OR CASE WHEN o.tenant_id = '' THEN 'default' ELSE COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') END = ?)) AS visit_count
        FROM customers c
        LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
        WHERE c.phone = ? AND (? = '*' OR CASE WHEN c.tenant_id = '' THEN 'default' ELSE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') END = ?)
      `)
      .bind(tenantId, tenantId, tenantId, tenantId, normalizedPhone, tenantId, tenantId)
      .first<PosCustomerRow>();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isNonDefaultTenant = tenantId !== 'default' && tenantId !== '*';
    const missingWalletTenant = /no such column:\s*cw\.tenant_id/i.test(errMsg);
    const missingOrderTenant = /no such column:\s*o\.tenant_id/i.test(errMsg);
    const missingCustomerTenant =
      /no such column:\s*(?:c\.)?tenant_id/i.test(errMsg) &&
      !/no such column:\s*(?:o\.|cw\.)tenant_id/i.test(errMsg);
    if (missingCustomerTenant) {
      if (isNonDefaultTenant) {
        row = null;
      } else {
        try {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                     c.created_at,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded')) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE c.phone = ?
            `)
            .bind(normalizedPhone)
            .first<PosCustomerRow>();
        } catch {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded')) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE c.phone = ?
            `)
            .bind(normalizedPhone)
            .first<PosCustomerRow>();
        }
      }
    } else if (missingOrderTenant) {
      if (isNonDefaultTenant) {
        try {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     0 AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
              WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
            `)
            .bind(tenantId, tenantId, normalizedPhone, tenantId, tenantId)
            .first<PosCustomerRow>();
        } catch {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     0 AS cashback_balance,
                     0 AS total_earned,
                     0 AS total_spent,
                     0 AS visit_count
              FROM customers c
              WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
            `)
            .bind(normalizedPhone, tenantId, tenantId)
            .first<PosCustomerRow>();
        }
      } else {
        try {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded')) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
              WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
            `)
            .bind(tenantId, tenantId, normalizedPhone, tenantId, tenantId)
            .first<PosCustomerRow>();
        } catch {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded')) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
            `)
            .bind(normalizedPhone, tenantId, tenantId)
            .first<PosCustomerRow>();
        }
      }
    } else if (missingWalletTenant) {
      if (isNonDefaultTenant) {
        try {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                     c.created_at, c.tenant_id,
                     0 AS cashback_balance,
                     0 AS total_earned,
                     0 AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
              FROM customers c
              WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
            `)
            .bind(tenantId, tenantId, normalizedPhone, tenantId, tenantId)
            .first<PosCustomerRow>();
        } catch {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     0 AS cashback_balance,
                     0 AS total_earned,
                     0 AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
              FROM customers c
              WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
            `)
            .bind(tenantId, tenantId, normalizedPhone, tenantId, tenantId)
            .first<PosCustomerRow>();
        }
      } else {
        try {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
            `)
            .bind(tenantId, tenantId, normalizedPhone, tenantId, tenantId)
            .first<PosCustomerRow>();
        } catch {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
            `)
            .bind(tenantId, tenantId, normalizedPhone, tenantId, tenantId)
            .first<PosCustomerRow>();
        }
      }
    } else {
      try {
        row = await db
          .prepare(`
            SELECT c.id, c.name, c.phone, c.email,
                   c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                   c.created_at, c.tenant_id,
                   COALESCE(cw.balance, 0) AS cashback_balance,
                   COALESCE(cw.total_earned, 0) AS total_earned,
                   COALESCE(cw.total_spent, 0) AS total_spent,
                   (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
            FROM customers c
            LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
            WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
          `)
          .bind(tenantId, tenantId, tenantId, tenantId, normalizedPhone, tenantId, tenantId)
          .first<PosCustomerRow>();
      } catch {
        try {
          row = await db
            .prepare(`
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
              WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
            `)
            .bind(tenantId, tenantId, tenantId, tenantId, normalizedPhone, tenantId, tenantId)
            .first<PosCustomerRow>();
        } catch {
          try {
            row = await db
              .prepare(`
                SELECT c.id, c.name, c.phone, c.email,
                       c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                       c.created_at, c.tenant_id,
                       COALESCE(cw.balance, 0) AS cashback_balance,
                       COALESCE(cw.total_earned, 0) AS total_earned,
                       COALESCE(cw.total_spent, 0) AS total_spent,
                       (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
                FROM customers c
                LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
                WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              `)
              .bind(tenantId, tenantId, tenantId, tenantId, normalizedPhone, tenantId, tenantId)
              .first<PosCustomerRow>();
          } catch {
            if (isNonDefaultTenant) {
              try {
                row = await db
                  .prepare(`
                    SELECT c.id, c.name, c.phone, c.email,
                           c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                           c.created_at, c.tenant_id,
                           0 AS cashback_balance,
                           0 AS total_earned,
                           0 AS total_spent,
                           (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
                    FROM customers c
                    WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
                  `)
                  .bind(tenantId, tenantId, normalizedPhone, tenantId, tenantId)
                  .first<PosCustomerRow>();
              } catch {
                row = await db
                  .prepare(`
                    SELECT c.id, c.name, c.phone, c.email,
                           c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                           c.created_at, c.tenant_id,
                           0 AS cashback_balance,
                           0 AS total_earned,
                           0 AS total_spent,
                           0 AS visit_count
                    FROM customers c
                    WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
                  `)
                  .bind(normalizedPhone, tenantId, tenantId)
                  .first<PosCustomerRow>();
              }
            } else {
              try {
                row = await db
                  .prepare(`
                    SELECT c.id, c.name, c.phone, c.email,
                           c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                           c.created_at, c.tenant_id,
                           COALESCE(cw.balance, 0) AS cashback_balance,
                           COALESCE(cw.total_earned, 0) AS total_earned,
                           COALESCE(cw.total_spent, 0) AS total_spent,
                           (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
                    FROM customers c
                    LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
                    WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
                  `)
                  .bind(tenantId, tenantId, normalizedPhone, tenantId, tenantId)
                  .first<PosCustomerRow>();
              } catch {
                try {
                  row = await db
                    .prepare(`
                      SELECT c.id, c.name, c.phone, c.email,
                             c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                             c.created_at, c.tenant_id,
                             COALESCE(cw.balance, 0) AS cashback_balance,
                             0 AS total_earned,
                             0 AS total_spent,
                             0 AS visit_count
                      FROM customers c
                      LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
                      WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
                    `)
                    .bind(normalizedPhone, tenantId, tenantId)
                    .first<PosCustomerRow>();
                } catch {
                  row = await db
                    .prepare(`
                      SELECT c.id, c.name, c.phone, c.email,
                             c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                             c.created_at,
                             0 AS cashback_balance,
                             0 AS total_earned,
                             0 AS total_spent,
                             0 AS visit_count
                      FROM customers c
                      WHERE c.phone = ?
                    `)
                    .bind(normalizedPhone)
                    .first<PosCustomerRow>();
                }
              }
            }
          }
        }
      }
    }
  }
  const resolvedRowTenant = row && 'tenant_id' in row && row.tenant_id !== undefined
    ? (typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : 'default')
    : 'default';
  if (tenantId !== '*' && row && resolvedRowTenant !== tenantId) {
    row = null;
  }

  if (!row) {
    return jsonResponse({
      success: true,
      found: false,
      message: 'Không tìm thấy khách hàng với số điện thoại này'
    });
  }

  // Tier label mapping
  const tierLabels: Record<string, string> = {
    bronze: 'Đồng',
    silver: 'Bạc',
    gold: 'Vàng',
    platinum: 'Bạch kim'
  };

  return jsonResponse({
    success: true,
    found: true,
    customer: {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      loyalty_tier: row.loyalty_tier,
      loyalty_tier_label: tierLabels[row.loyalty_tier] || row.loyalty_tier,
      loyalty_points: row.loyalty_points,
      lifetime_points: row.lifetime_points,
      cashback_balance: row.cashback_balance,
      total_earned: row.total_earned,
      total_spent: row.total_spent,
      visit_count: row.visit_count,
      created_at: row.created_at
    }
  });
});

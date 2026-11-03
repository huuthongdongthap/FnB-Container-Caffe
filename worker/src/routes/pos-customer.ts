/**
 * POS Customer Lookup Route — GET /api/pos/customer?phone=
 * Protected by staff auth (requireStaff)
 * Returns minimal customer profile for POS: id, name, phone, loyalty_tier, loyalty_points, cashback_balance
 */
import { Hono } from 'hono';
import type { Env } from '../types/env';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { requireStaff } from '../middleware/staff-auth';

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
  const staff = c.get('staff' as any) as { tenantId?: string; role?: string } | undefined;
  const user = c.get('user' as any) as { tenantId?: string; role?: string } | undefined;
  const actorRole = String(staff?.role || user?.role || '').toLowerCase();
  const baseTenant = staff?.tenantId || user?.tenantId || (typeof c.env.PILOT_TENANT_ID === 'string' && c.env.PILOT_TENANT_ID.trim() ? c.env.PILOT_TENANT_ID.trim() : 'default');
  const requestedTenant = c.req.query('tenant_id')?.trim() || c.req.header('X-Tenant-ID')?.trim();
  const isHqSuperAdmin = (actorRole === 'owner' || actorRole === 'admin') && (baseTenant === 'default' || baseTenant === 'hq');
  const tenantId = isHqSuperAdmin && requestedTenant ? requestedTenant : baseTenant;

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
               (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND COALESCE(o.status, '') NOT IN ('cancelled', 'failed', 'expired') AND (? = '*' OR CASE WHEN o.tenant_id = '' THEN 'default' ELSE COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') END = ?)) AS visit_count
        FROM customers c
        LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
        WHERE c.phone = ? AND (? = '*' OR CASE WHEN c.tenant_id = '' THEN 'default' ELSE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') END = ?)
      `)
      .bind(tenantId, tenantId, tenantId, tenantId, normalizedPhone, tenantId, tenantId)
      .first<PosCustomerRow>();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const missingWalletTenant = /no such column:\s*cw\.tenant_id/i.test(errMsg);
    const missingCustomerOrOrderTenant = /no such column:\s*(?:c\.|o\.)?tenant_id/i.test(errMsg) && !missingWalletTenant;
    if (missingCustomerOrOrderTenant) {
      row = await db
        .prepare(`
          SELECT c.id, c.name, c.phone, c.email,
                 c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                 c.created_at,
                 COALESCE(cw.balance, 0) AS cashback_balance,
                 COALESCE(cw.total_earned, 0) AS total_earned,
                 COALESCE(cw.total_spent, 0) AS total_spent,
                 (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone) AS visit_count
          FROM customers c
          LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
          WHERE c.phone = ?
        `)
        .bind(normalizedPhone)
        .first<PosCustomerRow>();
    } else if (missingWalletTenant) {
      try {
        row = await db
          .prepare(`
            SELECT c.id, c.name, c.phone, c.email,
                   c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                   c.created_at, c.tenant_id,
                   COALESCE(cw.balance, 0) AS cashback_balance,
                   COALESCE(cw.total_earned, 0) AS total_earned,
                   COALESCE(cw.total_spent, 0) AS total_spent,
                   (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND COALESCE(o.status, '') NOT IN ('cancelled', 'failed', 'expired') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
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
                   (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
            FROM customers c
            LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
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
                   c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                   c.created_at, c.tenant_id,
                   COALESCE(cw.balance, 0) AS cashback_balance,
                   COALESCE(cw.total_earned, 0) AS total_earned,
                   COALESCE(cw.total_spent, 0) AS total_spent,
                   (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND COALESCE(o.status, '') NOT IN ('cancelled', 'failed', 'expired') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
            FROM customers c
            LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
            WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
          `)
          .bind(tenantId, tenantId, tenantId, tenantId, normalizedPhone, tenantId, tenantId)
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
                   (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
            FROM customers c
            LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
            WHERE c.phone = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
          `)
          .bind(tenantId, tenantId, normalizedPhone, tenantId, tenantId)
          .first<PosCustomerRow>();
      }
    }
  }
  const resolvedRowTenant = row && 'tenant_id' in row && row.tenant_id !== undefined
    ? (typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : 'default')
    : 'default';
  if (tenantId !== '*' && row && 'tenant_id' in row && row.tenant_id !== undefined && resolvedRowTenant !== tenantId) {
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

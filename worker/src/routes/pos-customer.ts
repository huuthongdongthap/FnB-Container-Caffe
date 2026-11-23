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
import { canonicalPhone, phoneVariants } from '../../../packages/domain/customer/phone';

export const posCustomerRouter = new Hono<{ Bindings: Env }>();

// GET /api/pos/customer?phone=09xxxxxxxx OR ?q=name_or_partial_phone
posCustomerRouter.get('/', requireStaff(['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin']), async (c) => {
  const phone = c.req.query('phone')?.trim();
  const q = c.req.query('q')?.trim();
  if (!phone && !q) {
    return errorResponse('Thiếu số điện thoại hoặc từ khóa tìm kiếm', 400);
  }
  const isSearchMode = !phone && Boolean(q);
  if (isSearchMode && (q?.length ?? 0) < 2) {
    return errorResponse('Từ khóa tìm kiếm cần ít nhất 2 ký tự', 400);
  }
  const normalizedPhone = phone ? canonicalPhone(phone) : null;
  if (phone && !normalizedPhone) {
    return errorResponse('Số điện thoại không hợp lệ (định dạng: 09xxxxxxxx)', 400);
  }

  const db = c.env.AURA_DB;
  const staff = c.get('staff' as never) as { tenantId?: string; tenant_id?: string; role?: string } | undefined;
  const user = c.get('user' as never) as { tenantId?: string; tenant_id?: string; role?: string } | undefined;
  const actorRole = String(staff?.role || user?.role || '').toLowerCase();
  const actorTenant = String(staff?.tenantId ?? staff?.tenant_id ?? user?.tenantId ?? user?.tenant_id ?? '').trim();
  const ctxTenant = String((c.get('tenantId' as never) as string | undefined) || '').trim();
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

  const tierLabels: Record<string, string> = {
    bronze: 'Đồng',
    silver: 'Bạc',
    gold: 'Vàng',
    platinum: 'Bạch kim',
  };

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

  const formatCustomerRow = (r: PosCustomerRow) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    loyalty_tier: r.loyalty_tier,
    loyalty_tier_label: tierLabels[r.loyalty_tier] || r.loyalty_tier,
    loyalty_points: r.loyalty_points,
    lifetime_points: r.lifetime_points,
    cashback_balance: r.cashback_balance,
    total_earned: r.total_earned,
    total_spent: r.total_spent,
    visit_count: r.visit_count,
    created_at: r.created_at,
  });

  if (isSearchMode && q) {
    const boundedQ = q.slice(0, 100);
    const escapeLike = (v: string) => v.replace(/[\\%_]/g, '\\$&');
    const likePattern = `%${escapeLike(boundedQ.toLowerCase())}%`;
    const isPhoneLike = /^[+\d\s\-().]+$/.test(boundedQ);
    const phoneDigits = isPhoneLike ? boundedQ.replace(/\D/g, '') : '';
    const phoneLike = phoneDigits.length >= 2 ? `%${escapeLike(phoneDigits)}%` : likePattern;
    let searchRows: PosCustomerRow[] = [];
    try {
      const res = await db
        .prepare(
          `
            SELECT c.id, c.name, c.phone, c.email,
                   c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                   c.created_at, c.tenant_id,
                   COALESCE(cw.balance, 0) AS cashback_balance,
                   COALESCE(cw.total_earned, 0) AS total_earned,
                   COALESCE(cw.total_spent, 0) AS total_spent,
                   (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND LOWER(TRIM(COALESCE(o.payment_status, ''))) != 'refunded' AND (? = '*' OR CASE WHEN o.tenant_id = '' THEN 'default' ELSE COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') END = ?)) AS visit_count
            FROM customers c
            LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
            WHERE (LOWER(COALESCE(c.name, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(c.phone, '')) LIKE ? ESCAPE '\\')
              AND (? = '*' OR CASE WHEN c.tenant_id = '' THEN 'default' ELSE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') END = ?)
            ORDER BY c.name ASC
            LIMIT 10
          `,
        )
        .bind(tenantId, tenantId, tenantId, tenantId, likePattern, phoneLike, tenantId, tenantId)
        .all<PosCustomerRow>();
      searchRows = res?.results ?? [];
    } catch (primaryErr) {
      const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      if (!/no such (?:column|table)/i.test(primaryMsg)) {
        return errorResponse('Lỗi truy vấn khách hàng', 500);
      }
      const isNonDefaultTenant = tenantId !== 'default' && tenantId !== '*';
      try {
        const res = await db
          .prepare(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     0 AS cashback_balance, 0 AS total_earned, 0 AS total_spent, 0 AS visit_count
              FROM customers c
              WHERE (LOWER(COALESCE(c.name, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(c.phone, '')) LIKE ? ESCAPE '\\')
                AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              ORDER BY c.name ASC
              LIMIT 10
            `,
          )
          .bind(likePattern, phoneLike, tenantId, tenantId)
          .all<PosCustomerRow>();
        searchRows = res?.results ?? [];
      } catch (secondaryErr) {
        const secondaryMsg = secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr);
        if (!/no such column.*tenant_id/i.test(secondaryMsg)) {
          return errorResponse('Lỗi truy vấn khách hàng', 500);
        }
        if (!isNonDefaultTenant) {
          const res = await db
            .prepare(
              `
                SELECT c.id, c.name, c.phone, c.email,
                       c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                       c.created_at,
                       0 AS cashback_balance, 0 AS total_earned, 0 AS total_spent, 0 AS visit_count
                FROM customers c
                WHERE (LOWER(COALESCE(c.name, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(c.phone, '')) LIKE ? ESCAPE '\\')
                ORDER BY c.name ASC
                LIMIT 10
              `,
            )
            .bind(likePattern, phoneLike)
            .all<PosCustomerRow>();
          searchRows = res?.results ?? [];
        }
      }
    }

    const filteredRows = searchRows.filter((r) => {
      if (tenantId === '*') return true;
      const rowTenant =
        'tenant_id' in r && r.tenant_id !== undefined
          ? (typeof r.tenant_id === 'string' && r.tenant_id.trim() ? r.tenant_id.trim() : 'default')
          : 'default';
      return rowTenant === tenantId;
    });

    const customers = filteredRows.map(formatCustomerRow);
    return jsonResponse({
      success: true,
      found: customers.length > 0,
      customers,
      customer: customers.length === 1 ? customers[0] : undefined,
      message: customers.length === 0 ? 'Không tìm thấy khách hàng phù hợp' : undefined,
    });
  }

  const variants = phoneVariants(normalizedPhone!);
  const phoneInClause = variants.map(() => '?').join(', ');
  let row: PosCustomerRow | null = null;
  let ambiguousMatch = false;
  const querySingle = async (sql: string, binds: unknown[]): Promise<PosCustomerRow | null> => {
    const stmt = db.prepare(sql).bind(...binds);
    if (typeof stmt.all === 'function') {
      const res = await stmt.all<PosCustomerRow>();
      const rows = (res?.results ?? []).filter((r) => Boolean(r && typeof r === 'object' && 'phone' in r));
      if (rows.length > 1) {
        ambiguousMatch = true;
        return null;
      }
      if (rows.length === 1) {
        return rows[0] ?? null;
      }
      if (typeof stmt.first === 'function') {
        return (await stmt.first<PosCustomerRow>()) ?? null;
      }
      return null;
    }
    return (await stmt.first<PosCustomerRow>()) ?? null;
  };
  try {
    row = await querySingle(
      `
        SELECT c.id, c.name, c.phone, c.email,
               c.loyalty_tier, c.loyalty_points, c.lifetime_points,
               c.created_at, c.tenant_id,
               COALESCE(cw.balance, 0) AS cashback_balance,
               COALESCE(cw.total_earned, 0) AS total_earned,
               COALESCE(cw.total_spent, 0) AS total_spent,
               (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND LOWER(TRIM(COALESCE(o.payment_status, ''))) != 'refunded' AND (? = '*' OR CASE WHEN o.tenant_id = '' THEN 'default' ELSE COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') END = ?)) AS visit_count
        FROM customers c
        LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
        WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR CASE WHEN c.tenant_id = '' THEN 'default' ELSE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') END = ?)
        LIMIT 2
      `,
      [tenantId, tenantId, tenantId, tenantId, ...variants, tenantId, tenantId],
    );
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
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                     c.created_at,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded')) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE c.phone IN (${phoneInClause})
              LIMIT 2
            `,
            [...variants],
          );
        } catch {
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded')) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE c.phone IN (${phoneInClause})
              LIMIT 2
            `,
            [...variants],
          );
        }
      }
    } else if (missingOrderTenant) {
      if (isNonDefaultTenant) {
        try {
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     0 AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
              WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              LIMIT 2
            `,
            [tenantId, tenantId, ...variants, tenantId, tenantId],
          );
        } catch {
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     0 AS cashback_balance,
                     0 AS total_earned,
                     0 AS total_spent,
                     0 AS visit_count
              FROM customers c
              WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              LIMIT 2
            `,
            [...variants, tenantId, tenantId],
          );
        }
      } else {
        try {
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded')) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
              WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              LIMIT 2
            `,
            [tenantId, tenantId, ...variants, tenantId, tenantId],
          );
        } catch {
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded')) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              LIMIT 2
            `,
            [...variants, tenantId, tenantId],
          );
        }
      }
    } else if (missingWalletTenant) {
      if (isNonDefaultTenant) {
        try {
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                     c.created_at, c.tenant_id,
                     0 AS cashback_balance,
                     0 AS total_earned,
                     0 AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
              FROM customers c
              WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              LIMIT 2
            `,
            [tenantId, tenantId, ...variants, tenantId, tenantId],
          );
        } catch {
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     0 AS cashback_balance,
                     0 AS total_earned,
                     0 AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
              FROM customers c
              WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              LIMIT 2
            `,
            [tenantId, tenantId, ...variants, tenantId, tenantId],
          );
        }
      } else {
        try {
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              LIMIT 2
            `,
            [tenantId, tenantId, ...variants, tenantId, tenantId],
          );
        } catch {
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
              WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              LIMIT 2
            `,
            [tenantId, tenantId, ...variants, tenantId, tenantId],
          );
        }
      }
    } else {
      try {
        row = await querySingle(
          `
            SELECT c.id, c.name, c.phone, c.email,
                   c.loyalty_tier, c.loyalty_points, c.lifetime_points,
                   c.created_at, c.tenant_id,
                   COALESCE(cw.balance, 0) AS cashback_balance,
                   COALESCE(cw.total_earned, 0) AS total_earned,
                   COALESCE(cw.total_spent, 0) AS total_spent,
                   (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
            FROM customers c
            LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
            WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
            LIMIT 2
          `,
          [tenantId, tenantId, tenantId, tenantId, ...variants, tenantId, tenantId],
        );
      } catch {
        try {
          row = await querySingle(
            `
              SELECT c.id, c.name, c.phone, c.email,
                     c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                     c.created_at, c.tenant_id,
                     COALESCE(cw.balance, 0) AS cashback_balance,
                     COALESCE(cw.total_earned, 0) AS total_earned,
                     COALESCE(cw.total_spent, 0) AS total_spent,
                     (SELECT COUNT(*) FROM orders o WHERE (o.customer_phone = c.phone OR o.customer_id = c.id) AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
              FROM customers c
              LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
              WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
              LIMIT 2
            `,
            [tenantId, tenantId, tenantId, tenantId, ...variants, tenantId, tenantId],
          );
        } catch {
          try {
            row = await querySingle(
              `
                SELECT c.id, c.name, c.phone, c.email,
                       c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                       c.created_at, c.tenant_id,
                       COALESCE(cw.balance, 0) AS cashback_balance,
                       COALESCE(cw.total_earned, 0) AS total_earned,
                       COALESCE(cw.total_spent, 0) AS total_spent,
                       (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
                FROM customers c
                LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id AND (? = '*' OR COALESCE(NULLIF(TRIM(cw.tenant_id), ''), 'default') = ?)
                WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
                LIMIT 2
              `,
              [tenantId, tenantId, tenantId, tenantId, ...variants, tenantId, tenantId],
            );
          } catch {
            if (isNonDefaultTenant) {
              try {
                row = await querySingle(
                  `
                    SELECT c.id, c.name, c.phone, c.email,
                           c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                           c.created_at, c.tenant_id,
                           0 AS cashback_balance,
                           0 AS total_earned,
                           0 AS total_spent,
                           (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
                    FROM customers c
                    WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
                    LIMIT 2
                  `,
                  [tenantId, tenantId, ...variants, tenantId, tenantId],
                );
              } catch {
                row = await querySingle(
                  `
                    SELECT c.id, c.name, c.phone, c.email,
                           c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                           c.created_at, c.tenant_id,
                           0 AS cashback_balance,
                           0 AS total_earned,
                           0 AS total_spent,
                           0 AS visit_count
                    FROM customers c
                    WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
                    LIMIT 2
                  `,
                  [...variants, tenantId, tenantId],
                );
              }
            } else {
              try {
                row = await querySingle(
                  `
                    SELECT c.id, c.name, c.phone, c.email,
                           c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                           c.created_at, c.tenant_id,
                           COALESCE(cw.balance, 0) AS cashback_balance,
                           COALESCE(cw.total_earned, 0) AS total_earned,
                           COALESCE(cw.total_spent, 0) AS total_spent,
                           (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'failed', 'rejected', 'expired', 'refunded') AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)) AS visit_count
                    FROM customers c
                    LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
                    WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
                    LIMIT 2
                  `,
                  [tenantId, tenantId, ...variants, tenantId, tenantId],
                );
              } catch {
                try {
                  row = await querySingle(
                    `
                      SELECT c.id, c.name, c.phone, c.email,
                             c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                             c.created_at, c.tenant_id,
                             COALESCE(cw.balance, 0) AS cashback_balance,
                             0 AS total_earned,
                             0 AS total_spent,
                             0 AS visit_count
                      FROM customers c
                      LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
                      WHERE c.phone IN (${phoneInClause}) AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)
                      LIMIT 2
                    `,
                    [...variants, tenantId, tenantId],
                  );
                } catch {
                  row = await querySingle(
                    `
                      SELECT c.id, c.name, c.phone, c.email,
                             c.loyalty_tier, c.loyalty_points, c.loyalty_points AS lifetime_points,
                             c.created_at,
                             0 AS cashback_balance,
                             0 AS total_earned,
                             0 AS total_spent,
                             0 AS visit_count
                      FROM customers c
                      WHERE c.phone IN (${phoneInClause})
                      LIMIT 2
                    `,
                    [...variants],
                  );
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

  if (ambiguousMatch) {
    return errorResponse('Phát hiện nhiều hồ sơ trùng số điện thoại; cần đối soát thủ công', 409);
  }

  if (!row) {
    return jsonResponse({
      success: true,
      found: false,
      message: 'Không tìm thấy khách hàng với số điện thoại này'
    });
  }

  return jsonResponse({
    success: true,
    found: true,
    customer: formatCustomerRow(row),
  });
});

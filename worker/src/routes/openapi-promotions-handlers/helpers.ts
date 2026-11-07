import { getTenantId, isHQSuperAdmin, matchesTenantRow, resolvePublicTenantId } from '../../middleware/tenant';

export const PROMO_WRITE_ROLES = ['owner', 'manager', 'admin'];
export const PROMO_READ_ROLES = ['owner', 'manager', 'supervisor', 'admin', 'staff', 'cashier', 'waiter'];

export function verifyOpenApiPromoTenant(
  c: any,
  allowedRoles: string[],
  requireUser: boolean,
): Response | null {
  const candidateOverrides = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return c.json({ success: false, error: 'Forbidden: conflicting tenant overrides' }, 403);
  }
  const reqTenant = candidateOverrides[0] || '';
  const ctxTenant = (c.get?.('tenantId') as string | undefined)?.trim() || '';

  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (!user?.role) {
    if (requireUser) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    if (
      reqTenant === '*' ||
      reqTenant.toLowerCase() === 'hq' ||
      ctxTenant === '*' ||
      ctxTenant.toLowerCase() === 'hq'
    ) {
      return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
    }
    return null;
  }
  const role = String(user.role).toLowerCase();
  if (!allowedRoles.includes(role)) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const userTenant = (user.tenantId || user.tenant_id || '').trim();
  const isWildcardHQ = (role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq');
  const hqAdmin = isHQSuperAdmin(c) || isHQSuperAdmin(user) || isWildcardHQ;
  const boundTenant = userTenant || 'default';
  const resolvedTenant = getTenantId(c).trim() || 'default';

  if (!hqAdmin) {
    if (
      boundTenant === '*' ||
      boundTenant.toLowerCase() === 'hq' ||
      reqTenant === '*' ||
      reqTenant.toLowerCase() === 'hq' ||
      (reqTenant && reqTenant !== boundTenant) ||
      (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== boundTenant)) ||
      resolvedTenant !== boundTenant
    ) {
      return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
    }
  } else if (!isWildcardHQ && ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' && ctxTenant !== boundTenant && !reqTenant) {
    return c.json({ success: false, error: 'Forbidden: tenant mismatch' }, 403);
  }
  return null;
}

export function resolveOpenApiPromoReadTenantId(c: any): string {
  const user = c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const userTenant = (user?.tenantId || user?.tenant_id || '').trim();
  const role = String(user?.role || '').toLowerCase();
  const hqAdmin =
    isHQSuperAdmin(c) ||
    isHQSuperAdmin(user) ||
    ((role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq'));
  const candidateOverrides = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const reqTenant = candidateOverrides[0] || '';
  if (hqAdmin) {
    if (reqTenant) {
      return reqTenant === '*' || reqTenant.toLowerCase() === 'hq' ? '*' : reqTenant;
    }
    const raw = resolvePublicTenantId(c).trim() || '*';
    return raw === 'default' || raw.toLowerCase() === 'hq' ? '*' : raw;
  }
  const raw = resolvePublicTenantId(c).trim() || 'default';
  return raw === '*' || raw.toLowerCase() === 'hq' ? 'default' : raw;
}

export function resolveOpenApiPromoWriteTenantId(c: any): string {
  const user = c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const userTenant = (user?.tenantId || user?.tenant_id || '').trim();
  const isWildcardHQ = Boolean(user && (user.role === 'owner' || user.role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq'));
  const hqAdmin = isHQSuperAdmin(c) || isHQSuperAdmin(user) || isWildcardHQ;
  const candidateOverrides = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const reqTenant = candidateOverrides[0] || '';
  const rawResolved = (hqAdmin && reqTenant ? reqTenant : getTenantId(c).trim()) || 'default';
  const raw = rawResolved.toLowerCase() === 'hq' ? '*' : rawResolved;
  return raw === '*' && !hqAdmin ? 'default' : raw;
}

export async function writePromotionAuditLog(
  db: any,
  userId: string,
  action: string,
  entityId: string,
  metadata: string,
  now: string,
  tenantId: string = 'default',
): Promise<void> {
  const rawTenant = tenantId ? tenantId.trim() : '';
  const normTenant = !rawTenant || rawTenant === '*' || rawTenant.toLowerCase() === 'hq' ? 'default' : rawTenant;
  let enrichedMeta = metadata;
  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.tenant_id === undefined) {
      enrichedMeta = JSON.stringify({ ...parsed, tenant_id: normTenant });
    }
  } catch {
    /* non-JSON metadata */
  }
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(`audit_${crypto.randomUUID()}`, userId, action, 'promotion', entityId, enrichedMeta, normTenant, now)
      .run();
  } catch {
    try {
      await db
        .prepare(
          `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(userId, userId, userId, action, 'promotion', entityId, 'promotion', entityId, enrichedMeta, enrichedMeta, normTenant, now)
        .run();
    } catch {
      try {
        await db
          .prepare(
            `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(`audit_${crypto.randomUUID()}`, userId, action, 'promotion', entityId, enrichedMeta, now)
          .run();
      } catch {
        try {
          await db
            .prepare(
              `INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, entity_type, entity_id, details, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(userId, userId, userId, action, 'promotion', entityId, 'promotion', entityId, enrichedMeta, enrichedMeta, now)
            .run();
        } catch {
          await db
            .prepare(
              `INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(userId, userId, action, 'promotion', entityId, enrichedMeta, now)
            .run()
            .catch(() => {});
        }
      }
    }
  }
  await db
    .prepare('UPDATE audit_logs SET tenant_id = ? WHERE (entity_id = ? OR resource_id = ?) AND action = ? AND created_at = ?')
    .bind(normTenant, entityId, entityId, action, now)
    .run()
    .catch(() => {});
}

export function mapPromotionRow(p: any) {
  const rawDiscountType = p.discount_type === 'percent' ? 'percentage' : (p.discount_type ?? 'percentage');
  const discountValue = Number(p.discount_value ?? p.percent ?? 0);
  return {
    ...p,
    type: p.type ?? rawDiscountType,
    discountValue,
    discountType: rawDiscountType,
    maxUses: p.max_uses ?? p.usage_limit ?? null,
    currentUses: p.current_uses ?? p.used_count ?? p.usage_count ?? 0,
    minOrderValue: p.min_order_value ?? p.min_order ?? null,
    maxDiscountValue: p.max_discount_value ?? p.max_discount ?? null,
    validFrom: p.valid_from ?? null,
    validTo: p.valid_to ?? p.expires_at ?? null,
    isActive: p.is_active,
    applicableItems: p.applicable_items ? JSON.parse(p.applicable_items) : null,
    excludedItems: p.excluded_items ? JSON.parse(p.excluded_items) : null,
    createdAt: p.created_at,
    updatedAt: p.updated_at ?? p.created_at,
  };
}

export async function findOpenApiPromotionById(
  db: any,
  id: string,
  tenantId: string,
): Promise<any | null> {
  if (tenantId !== '*') {
    const scoped = await db
      .prepare(
        "SELECT * FROM promotions WHERE (id = ? OR code = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      )
      .bind(id, id, tenantId)
      .first()
      .catch(() => null);
    if (scoped && matchesTenantRow(scoped, tenantId)) {
      return scoped;
    }
  }
  const promotion = await db
    .prepare('SELECT * FROM promotions WHERE id = ?')
    .bind(id)
    .first()
    .catch(() => null);
  if (promotion && matchesTenantRow(promotion, tenantId)) {
    return promotion;
  }
  return null;
}

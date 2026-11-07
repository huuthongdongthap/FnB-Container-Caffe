import { getTenantId, isHQSuperAdmin, resolvePublicTenantId } from 'worker/src/middleware/tenant';

export const FINANCIAL_ROLES = ['owner', 'manager', 'admin', 'cashier'];
export const PAYMENT_ROLES = [...FINANCIAL_ROLES, 'supervisor', 'staff', 'waiter', 'shipper'];

export interface PaymentOrderIdentity {
  tenant_id?: string | null;
  customer_id?: string | null;
  order_token?: string | null;
}

export interface PaymentTenantScopeResult {
  tenantId: string;
  wildcard: boolean;
}

function constantTimeTokenMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function extractRequestOrderToken(c: any): string {
  return String(
    c?.req?.header?.('X-Order-Token') ||
      c?.req?.header?.('x-order-token') ||
      c?.req?.query?.('order_token') ||
      ''
  ).trim();
}

export function extractRequestedPaymentTenant(c: any): string {
  const candidates = [
    c?.req?.query?.('tenant_id'),
    c?.req?.query?.('tenantId'),
    c?.req?.query?.('store_id'),
    c?.req?.query?.('storeId'),
    c?.req?.header?.('X-Tenant-ID'),
    c?.req?.header?.('x-tenant-id'),
    c?.req?.header?.('X-Store-ID'),
    c?.req?.header?.('x-store-id'),
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  if (new Set(candidates).size > 1) {
    return '__CONFLICT__';
  }
  return candidates[0] || '';
}

export function hasPaymentTenantMismatch(c: any): boolean {
  const reqTenant = extractRequestedPaymentTenant(c);
  if (reqTenant === '__CONFLICT__') return true;
  const user = c?.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (!user) return false;
  if (isHQSuperAdmin(user)) return false;
  const rawUserTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
  if (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq') return true;
  const boundTenant = rawUserTenant || 'default';
  if (reqTenant && reqTenant !== boundTenant) return true;
  const ctxTenant = String((c?.get?.('tenantId') as string | undefined) || '').trim();
  if (!rawUserTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq')) return true;
  return false;
}

export function resolvePaymentTenantScope(c: any, allowGuest = false): PaymentTenantScopeResult | null {
  if (hasPaymentTenantMismatch(c)) return null;
  const user = c?.get?.('user') as { id?: string; sub?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (user) {
    const rawUserTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
    if (isHQSuperAdmin(user)) {
      const explicitReqTenant = extractRequestedPaymentTenant(c);
      const rawCtxTenant = String((c?.get?.('tenantId') as string | undefined) || '').trim();
      const ctxTenant = rawCtxTenant.toLowerCase() === 'hq' ? '' : rawCtxTenant;
      const reqTenant = explicitReqTenant || ctxTenant;
      const effective = reqTenant || rawUserTenant || 'default';
      const isWildcard = effective === '*' || effective.toLowerCase() === 'hq';
      return {
        tenantId: isWildcard ? '*' : effective,
        wildcard: isWildcard,
      };
    }
    const ctxTenant = String((c?.get?.('tenantId') as string | undefined) || '').trim();
    const tenantId = rawUserTenant || (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : 'default');
    return { tenantId, wildcard: false };
  }

  const reqOrderToken = extractRequestOrderToken(c);
  if (allowGuest || Boolean(reqOrderToken)) {
    try {
      const pubTenant = resolvePublicTenantId(c).trim() || 'default';
      return {
        tenantId: pubTenant === '*' || pubTenant.toLowerCase() === 'hq' ? 'default' : pubTenant,
        wildcard: false,
      };
    } catch {
      const fallback = getTenantId(c).trim() || 'default';
      return {
        tenantId: fallback === '*' || fallback.toLowerCase() === 'hq' ? 'default' : fallback,
        wildcard: false,
      };
    }
  }
  return null;
}

/** Only the signed identity (or an explicit HQ override) can select a tenant. */
export function paymentTenantScope(c: any): string | null {
  const user = c?.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (user) {
    const rawUserTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
    if (isHQSuperAdmin(user)) {
      const explicitReqTenant = extractRequestedPaymentTenant(c);
      const rawCtxTenant = String((c?.get?.('tenantId') as string | undefined) || '').trim();
      const ctxTenant = rawCtxTenant.toLowerCase() === 'hq' ? '' : rawCtxTenant;
      const reqTenant = explicitReqTenant || ctxTenant;
      const effective = reqTenant || rawUserTenant || 'default';
      return effective === '*' || effective.toLowerCase() === 'hq' ? null : effective;
    }
    if (rawUserTenant && rawUserTenant !== '*' && rawUserTenant.toLowerCase() !== 'hq') {
      return rawUserTenant;
    }
    const ctxTenant = String((c?.get?.('tenantId') as string | undefined) || '').trim();
    return ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : 'default';
  }
  const tenant = getTenantId(c).trim() || 'default';
  return tenant === '*' ? 'default' : tenant;
}

export async function resolvePaymentCustomerOwnerIds(
  db: any,
  user: Record<string, any> | undefined,
  tenant: string | null,
): Promise<string[]> {
  if (!user || String(user.role || '').trim().toLowerCase() !== 'customer') return [];
  const ids = new Set<string>();
  for (const candidate of [user.id, user.sub, user.customerId, user.customer_id]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      ids.add(candidate.trim());
    }
  }
  const userId =
    typeof user.id === 'string' && user.id.trim()
      ? user.id.trim()
      : typeof user.sub === 'string' && user.sub.trim()
        ? user.sub.trim()
        : '';
  if (userId && db && typeof db.prepare === 'function') {
    const effectiveTenant = tenant && tenant !== '*' && tenant.toLowerCase() !== 'hq' ? tenant : null;
    try {
      const res: { results?: Array<{ id?: string }> } =
        effectiveTenant !== null
          ? await db
              .prepare(
                "SELECT id FROM customers WHERE user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              )
              .bind(userId, effectiveTenant)
              .all()
              .catch(async (): Promise<{ results?: Array<{ id?: string }> }> =>
                effectiveTenant === 'default'
                  ? await db.prepare('SELECT id FROM customers WHERE user_id = ?').bind(userId).all()
                  : { results: [] }
              )
          : await db.prepare('SELECT id FROM customers WHERE user_id = ?').bind(userId).all();
      for (const row of res?.results || []) {
        if (row?.id && String(row.id).trim()) {
          ids.add(String(row.id).trim());
        }
      }
      if (!res?.results?.length) {
        const single = (
          effectiveTenant !== null
            ? await db
                .prepare(
                  "SELECT id FROM customers WHERE user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
                )
                .bind(userId, effectiveTenant)
                .first()
                .catch(async () =>
                  effectiveTenant === 'default'
                    ? await db.prepare('SELECT id FROM customers WHERE user_id = ? LIMIT 1').bind(userId).first()
                    : null
                )
            : await db.prepare('SELECT id FROM customers WHERE user_id = ? LIMIT 1').bind(userId).first()
        ) as { id?: string } | null;
        if (single?.id && String(single.id).trim()) {
          ids.add(String(single.id).trim());
        }
      }
    } catch {
      // Optional user_id column on customers in minimal test schemas
    }
  }
  return Array.from(ids);
}

export function canAccessPaymentOrder(c: any, order: PaymentOrderIdentity, allowGuest = false): boolean {
  const scope = resolvePaymentTenantScope(c, allowGuest);
  if (!scope) return false;
  const rawOrderTenant = order.tenant_id && String(order.tenant_id).trim() ? String(order.tenant_id).trim() : '';
  const orderTenant = rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq' ? rawOrderTenant : 'default';
  if (!scope.wildcard && orderTenant !== scope.tenantId) return false;

  const user = c?.get?.('user') as {
    id?: string;
    sub?: string;
    role?: string;
    customerId?: string;
    customer_id?: string;
  } | undefined;
  const userId = String(user?.id ?? user?.sub ?? '').trim();
  const userRole = String(user?.role || '').trim().toLowerCase();

  if (user && userId && userRole && PAYMENT_ROLES.includes(userRole)) {
    return true;
  }

  const reqOrderToken = extractRequestOrderToken(c);
  const orderToken = typeof order.order_token === 'string' ? order.order_token.trim() : '';
  const hasValidOrderToken = Boolean(orderToken && reqOrderToken && constantTimeTokenMatch(reqOrderToken, orderToken));
  if (hasValidOrderToken) {
    return true;
  }

  const orderCustomerId = order.customer_id ? String(order.customer_id).trim() : '';
  if (!user) {
    return Boolean(allowGuest && !orderCustomerId && !orderToken);
  }
  if (userRole === 'customer') {
    if (!orderCustomerId) return false;
    const ownerIds = new Set<string>();
    for (const candidate of [user.id, user.sub, user.customerId, user.customer_id]) {
      if (typeof candidate === 'string' && candidate.trim()) {
        ownerIds.add(candidate.trim());
      }
    }
    const ctxOwnerIds = c?.get?.('customerOwnerIds');
    if (Array.isArray(ctxOwnerIds)) {
      for (const id of ctxOwnerIds) {
        if (typeof id === 'string' && id.trim()) {
          ownerIds.add(id.trim());
        }
      }
    }
    return ownerIds.has(orderCustomerId);
  }
  return false;
}

export function assertOrderPaymentAccess(c: any, order: PaymentOrderIdentity, allowGuest = true): boolean {
  return canAccessPaymentOrder(c, order, allowGuest);
}

export function hasFinancialRole(c: any): boolean {
  const role = String(c?.get?.('user')?.role || '').trim().toLowerCase();
  return FINANCIAL_ROLES.includes(role);
}

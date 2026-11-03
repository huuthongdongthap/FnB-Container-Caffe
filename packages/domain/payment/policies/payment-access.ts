import { getTenantId, isHQSuperAdmin, resolvePublicTenantId } from 'worker/src/middleware/tenant';

export const FINANCIAL_ROLES = ['owner', 'manager', 'admin', 'cashier'];
const PAYMENT_ROLES = [...FINANCIAL_ROLES, 'supervisor', 'staff', 'waiter'];

export interface PaymentOrderIdentity {
  tenant_id?: string | null;
  customer_id?: string | null;
}

/** Only the signed identity (or an explicit HQ override) can select a tenant. */
export function paymentTenantScope(c: any): string | null {
  const user = c.get('user');
  const tenant = getTenantId(c).trim() || 'default';
  return tenant === '*' && isHQSuperAdmin(user) ? null : tenant;
}

export function canAccessPaymentOrder(c: any, order: PaymentOrderIdentity, allowGuest = false): boolean {
  const user = c.get('user') as { id?: string; role?: string } | undefined;
  let tenant = paymentTenantScope(c);
  if (!user && allowGuest) {
    try {
      tenant = resolvePublicTenantId(c);
    } catch {
      // Fallback to paymentTenantScope
    }
  }
  const orderTenant = order.tenant_id && String(order.tenant_id).trim() ? String(order.tenant_id).trim() : 'default';
  if (tenant !== null && orderTenant !== tenant) return false;
  if (!user) return allowGuest && !order.customer_id;
  if (user.role === 'customer') return Boolean(user.id && order.customer_id === user.id);
  return Boolean(user.id && user.role && PAYMENT_ROLES.includes(user.role));
}

export function hasFinancialRole(c: any): boolean {
  return FINANCIAL_ROLES.includes(c.get('user')?.role);
}

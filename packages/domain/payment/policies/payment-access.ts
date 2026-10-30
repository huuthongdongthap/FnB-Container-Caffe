import { getTenantId, isHQSuperAdmin } from 'worker/src/middleware/tenant';

export const FINANCIAL_ROLES = ['owner', 'manager', 'admin', 'cashier'];
const PAYMENT_ROLES = [...FINANCIAL_ROLES, 'supervisor', 'staff', 'waiter'];

export interface PaymentOrderIdentity {
  tenant_id?: string | null;
  customer_id?: string | null;
}

/** Only the signed identity (or an explicit HQ override) can select a tenant. */
export function paymentTenantScope(c: any): string | null {
  const user = c.get('user');
  const tenant = getTenantId(c);
  return tenant === '*' && isHQSuperAdmin(user) ? null : tenant;
}

export function canAccessPaymentOrder(c: any, order: PaymentOrderIdentity, allowGuest = false): boolean {
  const user = c.get('user') as { id?: string; role?: string } | undefined;
  const tenant = paymentTenantScope(c);
  if (tenant !== null && (order.tenant_id || 'default') !== tenant) return false;
  if (!user) return allowGuest && !order.customer_id;
  if (user.role === 'customer') return Boolean(user.id && order.customer_id === user.id);
  return Boolean(user.id && user.role && PAYMENT_ROLES.includes(user.role));
}

export function hasFinancialRole(c: any): boolean {
  return FINANCIAL_ROLES.includes(c.get('user')?.role);
}

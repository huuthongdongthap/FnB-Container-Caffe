/**
 * Mautic Bridge — Contact mapper (customer to Mautic format)
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

export function toMauticContact(customer: Record<string, unknown>): Record<string, unknown> {
  const phone = (customer.phone as string) || '';
  const rawTenant = typeof customer.tenant_id === 'string' ? customer.tenant_id.trim() : '';
  const fallbackEmail = rawTenant && rawTenant !== 'default' && rawTenant !== '*'
    ? `${rawTenant}+${phone}@aura-cafe.internal`
    : `${phone}@aura-cafe.internal`;
  const rawTier = typeof customer.loyalty_tier === 'string' && customer.loyalty_tier.trim()
    ? customer.loyalty_tier.trim().toLowerCase()
    : typeof customer.tier === 'string' && customer.tier.trim()
      ? customer.tier.trim().toLowerCase()
      : 'bronze';
  return {
    email: (customer.email as string) || fallbackEmail,
    firstname: (customer.name as string) || 'Khách',
    phone,
    loyalty_tier: rawTier,
    birthday: (customer.birthday as string) || null,
    last_order_date: (customer.last_order_date as string) || null,
    total_orders: (customer.total_orders as number) || 0
  };
}

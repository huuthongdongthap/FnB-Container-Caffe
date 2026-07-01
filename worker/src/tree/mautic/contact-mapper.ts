/**
 * Mautic Bridge — Contact mapper (customer to Mautic format)
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

export function toMauticContact(customer: Record<string, unknown>): Record<string, unknown> {
  const phone = (customer.phone as string) || '';
  return {
    email: (customer.email as string) || `${phone}@aura-cafe.internal`,
    firstname: (customer.name as string) || 'Khách',
    phone,
    loyalty_tier: (customer.loyalty_tier as string) || 'bronze',
    birthday: (customer.birthday as string) || null,
    last_order_date: (customer.last_order_date as string) || null,
    total_orders: (customer.total_orders as number) || 0,
  };
}

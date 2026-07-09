/**
 * ERPNext CRM Mapper — Phase 3 Stub
 * Transforms customers to ERPNext Lead/Customer
 *
 * @todo Phase 3 implementation (16h)
 * - Map customer to Lead + Customer
 * - Convert loyalty tiers to ERPNext tags
 * - Handle consent check
 */

export interface CustomerInput {
  id?: string | number;
  name?: string;
  phone?: string;
  email?: string;
  loyalty_tier?: string;
  tier?: string;
}

export interface LeadValues {
  doctype: string;
  lead_name: string;
  phone: string;
  email: string;
  custom_aura_customer_id: string | number | null;
  _user_tags: string[];
  status: string;
}

export function mapCustomerToLead(customer: CustomerInput | null | undefined): LeadValues {
  if (!customer || typeof customer !== 'object') {
    throw new Error('Customer is required for lead mapping');
  }

  const leadName = (customer.name || customer.phone || 'New Lead').trim() || 'New Lead';
  const tier = customer.loyalty_tier ?? customer.tier ?? 'bronze';

  return {
    doctype: 'Lead',
    lead_name: leadName,
    phone: (customer.phone || '').trim(),
    email: (customer.email || '').trim(),
    custom_aura_customer_id: customer.id || null,
    _user_tags: mapLoyaltyTier(tier),
    status: 'Lead'
  };
}

export function mapLoyaltyTier(tier: string | null | undefined): string[] {
  const mapping: Record<string, string[]> = {
    bronze: ['Bronze Member'],
    silver: ['Silver Member'],
    gold: ['Gold Member'],
    platinum: ['VIP', 'Platinum Member']
  };
  return mapping[tier?.toLowerCase() || ''] || [];
}

export default {
  mapCustomerToLead,
  mapLoyaltyTier
};

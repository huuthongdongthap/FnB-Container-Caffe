/**
 * ERPNext CRM Mapper — Phase 3 Stub
 * Transforms customers to ERPNext Lead/Customer
 *
 * @todo Phase 3 implementation (16h)
 * - Map customer to Lead + Customer
 * - Convert loyalty tiers to ERPNext tags
 * - Handle consent check
 */

/**
 * Map our customer to ERPNext Lead values
 * @param {Object} customer - Our customer record from D1
 * @returns {Object} ERPNext Lead values
 */
export function mapCustomerToLead(customer) {
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
    status: 'Lead',
  };
}

/**
 * Map loyalty tier to ERPNext tag strings
 * @param {string} tier - bronze|silver|gold|platinum
 * @returns {string[]} Tag names for ERPNext _user_tags
 */
export function mapLoyaltyTier(tier) {
  const mapping = {
    bronze: ['Bronze Member'],
    silver: ['Silver Member'],
    gold: ['Gold Member'],
    platinum: ['VIP', 'Platinum Member'],
  };
  return mapping[tier?.toLowerCase()] || [];
}

export default {
  mapCustomerToLead,
  mapLoyaltyTier,
};

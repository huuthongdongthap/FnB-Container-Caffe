/**
 * Odoo CRM Mapper — Phase 3 Stub
 * Transforms customers to Odoo leads/partners
 *
 * @todo Phase 3 implementation (16h)
 * - Map customer → crm.lead + res.partner
 * - Convert loyalty tiers to Odoo tags
 * - Handle consent check
 */

/**
 * Map our customer to Odoo lead values
 * @param {Object} customer - Our customer record from D1
 * @returns {Object} Odoo crm.lead values
 */
export function mapCustomerToLead(customer) {
  if (!customer || typeof customer !== 'object') {
    throw new Error('Customer is required for lead mapping');
  }

  const name = (customer.name || customer.phone || 'New Lead').trim() || 'New Lead';
  const tier = customer.loyalty_tier ?? customer.tier ?? 'bronze';

  return {
    name,
    phone: (customer.phone || '').trim(),
    email: (customer.email || '').trim(),
    x_our_customer_id: customer.id || null,
    tag_ids: mapLoyaltyTier(tier),
  };
}


/**
 * Map loyalty tier to Odoo tag IDs/names
 * @param {string} tier - bronze|silver|gold|platinum
 * @returns {string[]} Tag names for Odoo
 */
export function mapLoyaltyTier(tier) {
  const mapping = {
    bronze: ['Bronze Member'],
    silver: ['Silver Member'],
    gold: ['Gold Member'],
    platinum: ['VIP', 'Platinum Member']
  };
  return mapping[tier?.toLowerCase()] || [];
}

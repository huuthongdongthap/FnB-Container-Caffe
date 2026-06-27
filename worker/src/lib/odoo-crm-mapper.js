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
  // STUB: Phase 3 implementation
  // Expected Odoo structure:
  // {
  //   name: customer.name || customer.phone,
  //   phone: customer.phone,
  //   email: customer.email,
  //   x_our_customer_id: customer.id,  // custom field for mapping
  //   tag_ids: mapLoyaltyTier(customer.tier)
  // }
  throw new Error('NOT_IMPLEMENTED: Phase 3 — Odoo CRM Sync');
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

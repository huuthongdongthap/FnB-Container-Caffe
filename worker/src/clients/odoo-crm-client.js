/**
 * Odoo CRM Client — Phase 3 Stub
 * Handles lead creation, partner management, and tag sync
 *
 * @todo Phase 3 implementation (16h)
 * - Implement createLead() for crm.lead
 * - Implement updatePartner() for res.partner
 * - Add tag management (addTag, removeTag)
 * - Map loyalty tiers to Odoo tags
 */

export class OdooCrmClient {
  /**
   * @param {import('./odoo-client').OdooClient} odooClient
   */
  constructor(odooClient) {
    this.odoo = odooClient;
  }

  /**
   * Create a CRM lead from customer signup
   * @param {Object} customer - Our customer record
   * @returns {Promise<{leadId: number, partnerId: number}>}
   */
  async createLead(customer) {
    // STUB: Phase 3 implementation
    // Expected: create 'crm.lead' and linked 'res.partner'
    // 1. Create res.partner first (customer contact)
    // 2. Create crm.lead with x_our_customer_id custom field
    // 3. Apply loyalty tier tags
    throw new Error('NOT_IMPLEMENTED: Phase 3 — Odoo CRM Sync');
  }

  /**
   * Update existing Odoo partner (contact)
   * @param {number} partnerId - Odoo partner ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>}
   */
  async updatePartner(partnerId, updates) {
    // STUB: Phase 3 implementation
    // Call odoo.write('res.partner', partnerId, updates)
    throw new Error('NOT_IMPLEMENTED: Phase 3 — Odoo CRM Sync');
  }

  /**
   * Add tag to partner
   * @param {number} partnerId - Odoo partner ID
   * @param {string} tagName - Tag name to add
   * @returns {Promise<boolean>}
   */
  async addTag(partnerId, tagName) {
    // STUB: Phase 3 implementation
    // Find or create tag, then add to partner's category_id
    throw new Error('NOT_IMPLEMENTED: Phase 3 — Odoo CRM Sync');
  }

  /**
   * Remove tag from partner
   * @param {number} partnerId - Odoo partner ID
   * @param {string} tagName - Tag name to remove
   * @returns {Promise<boolean>}
   */
  async removeTag(partnerId, tagName) {
    // STUB: Phase 3 implementation
    throw new Error('NOT_IMPLEMENTED: Phase 3 — Odoo CRM Sync');
  }

  /**
   * Get partner notes and tags for admin display
   * @param {number} partnerId - Odoo partner ID
   * @returns {Promise<{notes: string, tags: string[], lastActivity: string}>}
   */
  async getPartnerInfo(partnerId) {
    // STUB: Phase 3 implementation
    // Search res.partner with note field and category_id (tags)
    throw new Error('NOT_IMPLEMENTED: Phase 3 — Odoo CRM Sync');
  }

  /**
   * Map loyalty tier to Odoo tag names
   * @param {string} tier - Bronze|Silver|Gold|Platinum
   * @returns {string[]} Array of tag names
   */
  static mapLoyaltyTier(tier) {
    // STUB: Phase 3 implementation
    const tierTags = {
      bronze: ['Bronze Member'],
      silver: ['Silver Member'],
      gold: ['Gold Member'],
      platinum: ['VIP']
    };
    return tierTags[tier?.toLowerCase()] || [];
  }
}

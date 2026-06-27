/**
 * Odoo CRM Client — Phase 3
 * Handles lead creation, partner management, and tag sync
 *
 * Bridges AURA customer data with Odoo CRM (crm.lead, res.partner).
 *
 * Phase 3: Odoo CRM Sync
 */

import { OdooClient } from './odoo-client.js';

/**
 * Map AURA customer to Odoo res.partner values
 * @param {Object} customer - AURA customer record
 * @returns {Object} Partner values for Odoo create
 */
function mapCustomerToOdooPartner(customer) {
  if (!customer) {
    throw new Error('Customer is required for partner mapping');
  }

  return {
    name: customer.name || customer.full_name || 'Unknown Customer',
    email: customer.email || '',
    phone: customer.phone || customer.phone_number || '',
    company_type: 'person',
    customer_rank: 1,
    x_our_customer_id: customer.id,
  };
}

/**
 * OdooCrmClient — CRM sync operations
 *
 * Extends OdooClient with domain-specific logic for:
 * - Customer → Lead creation
 * - Partner updates
 * - Tag management (add/remove)
 * - Partner info retrieval
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
   *
   * Flow:
   * 1. Create res.partner with mapped customer data
   * 2. Create crm.lead linked to the partner
   * 3. Apply loyalty tier tags to the partner
   * 4. Save mapping record for idempotency
   *
   * @param {Object} customer - AURA customer record
   * @returns {Promise<{leadId: number, partnerId: number}>}
   * @throws {Error} If customer lacks consent or Odoo calls fail
   */
  async createLead(customer) {
    if (!customer) {
      throw new Error('Customer is required to create lead');
    }

    // Consent check: skip sync if customer has not consented
    const hasConsent = customer.consent_marketing !== false &&
                       customer.consent_odoo_sync !== false;
    if (!hasConsent) {
      return null;
    }

    // Step 1: Create res.partner
    const partnerValues = mapCustomerToOdooPartner(customer);
    const partnerId = await this.odoo.create('res.partner', partnerValues);

    // Step 2: Create crm.lead linked to partner
    const leadValues = {
      name: customer.name || customer.full_name || 'New Lead',
      partner_id: partnerId,
      x_our_customer_id: customer.id,
      type: 'opportunity',
    };
    const leadId = await this.odoo.create('crm.lead', leadValues);

    // Step 3: Apply loyalty tier tags
    const tier = customer.loyalty_tier || customer.tier || 'bronze';
    const tagNames = OdooCrmClient.mapLoyaltyTier(tier);
    for (const tagName of tagNames) {
      await this.addTag(partnerId, tagName);
    }

    // Step 4: Save mapping for idempotency
    await this.odoo._createMapping(
      customer.id,
      partnerId,
      'res.partner',
      'synced'
    );

    return { leadId, partnerId };
  }

  /**
   * Update existing Odoo partner (contact)
   *
   * Only whitelisted fields are written to prevent accidental data overwrite.
   *
   * @param {number} partnerId - Odoo partner ID
   * @param {Object} updates - Fields to update (name, phone, email, note only)
   * @returns {Promise<boolean>} True on success
   * @throws {Error} If partnerId is invalid or write fails
   */
  async updatePartner(partnerId, updates) {
    if (!partnerId || partnerId <= 0) {
      throw new Error('Valid partnerId is required for update');
    }

    if (!updates || typeof updates !== 'object') {
      return true; // Nothing to update
    }

    // Whitelist: only allow safe fields to be written
    const allowedFields = ['name', 'phone', 'email', 'note'];
    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (field in updates) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return true; // No allowed fields to update
    }

    await this.odoo.write('res.partner', partnerId, filteredUpdates);
    return true;
  }

  /**
   * Add tag to partner
   *
   * Uses Odoo many2many command [[4, tagId]] to link an existing
   * res.partner.category record to the partner without removing existing tags.
   *
   * @param {number} partnerId - Odoo partner ID
   * @param {string} tagName - Tag name to add
   * @returns {Promise<boolean>} True on success
   * @throws {Error} If inputs are invalid or Odoo calls fail
   */
  async addTag(partnerId, tagName) {
    if (!partnerId || partnerId <= 0) {
      throw new Error('Valid partnerId is required for addTag');
    }

    if (!tagName || typeof tagName !== 'string') {
      throw new Error('Tag name is required for addTag');
    }

    // Find or create the tag category
    const tagId = await this._findOrCreateTag(tagName);

    // Read current partner categories (many2many)
    const [partner] = await this.odoo.read('res.partner', [partnerId], ['category_id']);

    // Odoo command 4 = link existing record to many2many
    await this.odoo.write('res.partner', partnerId, {
      category_id: [[4, tagId]],
    });

    return true;
  }

  /**
   * Remove tag from partner
   *
   * Uses Odoo many2many command [[3, tagId]] to unlink a
   * res.partner.category record from the partner.
   *
   * @param {number} partnerId - Odoo partner ID
   * @param {string} tagName - Tag name to remove
   * @returns {Promise<boolean>} True on success
   * @throws {Error} If inputs are invalid or Odoo calls fail
   */
  async removeTag(partnerId, tagName) {
    if (!partnerId || partnerId <= 0) {
      throw new Error('Valid partnerId is required for removeTag');
    }

    if (!tagName || typeof tagName !== 'string') {
      throw new Error('Tag name is required for removeTag');
    }

    // Find the tag category
    const tags = await this.odoo.searchRead(
      'res.partner.category',
      [['name', '=', tagName]],
      ['id']
    );

    if (!tags || tags.length === 0) {
      return true; // Tag doesn't exist, nothing to remove
    }

    const tagId = tags[0].id;

    // Odoo command 3 = unlink record from many2many
    await this.odoo.write('res.partner', partnerId, {
      category_id: [[3, tagId]],
    });

    return true;
  }

  /**
   * Get partner notes and tags for admin display
   *
   * @param {number} partnerId - Odoo partner ID
   * @returns {Promise<{notes: string, tags: string[], lastActivity: string}>}
   * @throws {Error} If partnerId is invalid or Odoo calls fail
   */
  async getPartnerInfo(partnerId) {
    if (!partnerId || partnerId <= 0) {
      throw new Error('Valid partnerId is required for getPartnerInfo');
    }

    const [partner] = await this.odoo.read('res.partner', [partnerId], [
      'name',
      'phone',
      'email',
      'note',
      'category_id',
      'write_date',
    ]);

    if (!partner) {
      throw new Error(`Partner ${partnerId} not found in Odoo`);
    }

    // Resolve tag names from category_id many2many
    let tags = [];
    if (partner.category_id && partner.category_id.length > 0) {
      const tagIds = partner.category_id
       .filter(t => Array.isArray(t) && t[0] === 4)
       .map(t => t[1]);
      const tagRecords = await this.odoo.read(
        'res.partner.category',
        tagIds,
        ['name']
      );
      tags = tagRecords.map(t => t.name).filter(Boolean);
    }

    return {
      notes: partner.note || '',
      tags,
      lastActivity: partner.write_date || '',
    };
  }

  /**
   * Find existing tag by name or create a new one
   * @private
   * @param {string} tagName - Tag name
   * @returns {Promise<number>} Tag ID
   */
  async _findOrCreateTag(tagName) {
    const existing = await this.odoo.searchRead(
      'res.partner.category',
      [['name', '=', tagName]],
      ['id']
    );

    if (existing && existing.length > 0) {
      return existing[0].id;
    }

    const newId = await this.odoo.create('res.partner.category', { name: tagName });
    return newId;
  }

  /**
   * Map loyalty tier to Odoo tag names
   *
   * @param {string} tier - Bronze|Silver|Gold|Platinum
   * @returns {string[]} Array of tag names
   */
  static mapLoyaltyTier(tier) {
    const tierTags = {
      bronze: ['Bronze Member'],
      silver: ['Silver Member'],
      gold: ['Gold Member'],
      platinum: ['VIP'],
    };
    return tierTags[tier?.toLowerCase()] || [];
  }
}

/**
 * Factory function — returns null if Odoo env vars are missing
 *
 * @param {Object} env - Cloudflare Worker environment bindings
 * @returns {OdooCrmClient|null}
 */
export function createOdooCrmClient(env) {
  try {
    const odooClient = new OdooClient({
      url: env.ODOO_URL,
      db: env.ODOO_DB,
      username: env.ODOO_USERNAME,
      apiKey: env.ODOO_API_KEY,
    });
    return new OdooCrmClient(odooClient);
  } catch {
    return null;
  }
}

export default OdooCrmClient;

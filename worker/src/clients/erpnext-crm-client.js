/**
 * ERPNext CRM Client — Phase 3
 * Bridges AURA customer data with ERPNext CRM (Lead, Customer, Tags).
 *
 * Uses ErpnextClient for REST operations.
 *
 * @example
 * const client = createErpnextCrmClient(env);
 * const result = await client.createLead(customer);
 * await client.addTag('CUST-001', 'VIP');
 */

import { createErpnextClient, ErpnextError } from './erpnext-client.js';

/**
 * Map AURA customer to ERPNext Lead values
 * @param {Object} customer - AURA customer record
 * @returns {Object} Lead field values for ERPNext create
 */
function mapCustomerToLead(customer) {
  if (!customer) {
    throw new Error('Customer is required for lead mapping');
  }

  return {
    first_name: (customer.name || customer.full_name || 'New Lead').trim().substring(0, 140),
    email_id: (customer.email || '').trim(),
    mobile_no: (customer.phone || customer.phone_number || '').trim(),
    custom_aura_customer_id: customer.id || null,
    source: 'Website',
    status: 'Lead',
  };
}

/**
 * ErpnextCrmClient — CRM sync operations
 *
 * Handles lead creation, customer updates, and tag management
 * via the ERPNext REST API.
 */
export class ErpnextCrmClient {
  /**
   * @param {import('./erpnext-client').ErpnextClient} client - Authenticated ERPNext REST client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Create a CRM lead from customer signup.
   *
   * Flow:
   * 1. Check customer consent
   * 2. Map customer to Lead values
   * 3. POST /api/resource/Lead
   *
   * @param {Object} customerData - AURA customer record
   * @returns {Promise<{leadId: string}|null>} Lead name or null if no consent
   * @throws {ErpnextError} If ERPNext call fails
   */
  async createLead(customerData) {
    if (!customerData) {
      throw new Error('Customer data is required to create lead');
    }

    // Consent check: skip sync if customer has not consented
    const hasConsent = customerData.consent_marketing !== false &&
                       customerData.consent_erpnext_sync !== false;
    if (!hasConsent) {
      return null;
    }

    const leadValues = mapCustomerToLead(customerData);
    const response = await this.client.create('Lead', leadValues);
    const leadName = response.data?.name;

    if (!leadName) {
      throw new ErpnextError('Failed to create Lead: no name returned from ERPNext', 500);
    }

    return { leadId: leadName };
  }

  /**
   * Update existing ERPNext Customer fields.
   *
   * Only whitelisted fields are written to prevent accidental data overwrite.
   *
   * @param {string} customerId - ERPNext Customer name/ID
   * @param {Object} data - Fields to update
   * @returns {Promise<boolean>} True on success
   * @throws {Error} If customerId is invalid or update fails
   */
  async updateCustomer(customerId, data) {
    if (!customerId) {
      throw new Error('Valid customerId is required for update');
    }

    if (!data || typeof data !== 'object') {
      return true; // Nothing to update
    }

    // Whitelist: only allow safe fields to be written
    const allowedFields = ['customer_name', 'phone', 'email', 'customer_primary_address', 'custom_notes'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (field in data) {
        filteredUpdates[field] = data[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return true; // No allowed fields to update
    }

    await this.client.update('Customer', customerId, filteredUpdates);
    return true;
  }

  /**
   * Add tag to ERPNext Customer.
   *
   * ERPNext stores tags in `_user_tags` as a JSON array string.
   * Reads current tags, appends new tag if not already present, writes back.
   *
   * @param {string} customerId - ERPNext Customer name/ID
   * @param {string} tagName - Tag name to add
   * @returns {Promise<boolean>} True on success
   * @throws {Error} If inputs are invalid or ERPNext calls fail
   */
  async addTag(customerId, tagName) {
    if (!customerId) {
      throw new Error('Valid customerId is required for addTag');
    }

    if (!tagName || typeof tagName !== 'string') {
      throw new Error('Tag name is required for addTag');
    }

    // Read current customer data including tags
    const response = await this.client.read('Customer', customerId);
    const customer = response.data;

    if (!customer) {
      throw new ErpnextError(`Customer ${customerId} not found`, 404);
    }

    // Parse existing _user_tags array
    let tags = [];
    if (customer._user_tags) {
      try {
        tags = JSON.parse(customer._user_tags);
      } catch {
        tags = [];
      }
    }

    // Only add if not already present
    if (!tags.includes(tagName)) {
      tags.push(tagName);
      await this.client.update('Customer', customerId, { _user_tags: JSON.stringify(tags) });
    }

    return true;
  }

  /**
   * Remove tag from ERPNext Customer.
   *
   * Reads current tags, filters out the specified tag, writes back.
   *
   * @param {string} customerId - ERPNext Customer name/ID
   * @param {string} tagName - Tag name to remove
   * @returns {Promise<boolean>} True on success
   * @throws {Error} If inputs are invalid or ERPNext calls fail
   */
  async removeTag(customerId, tagName) {
    if (!customerId) {
      throw new Error('Valid customerId is required for removeTag');
    }

    if (!tagName || typeof tagName !== 'string') {
      throw new Error('Tag name is required for removeTag');
    }

    // Read current customer data
    let customer;
    try {
      const response = await this.client.read('Customer', customerId);
      customer = response.data;
    } catch (error) {
      if (error instanceof ErpnextError && error.status === 404) {
        return true; // Customer doesn't exist, nothing to remove
      }
      throw error;
    }

    if (!customer || !customer._user_tags) {
      return true; // No tags, nothing to remove
    }

    // Parse existing _user_tags array
    let tags;
    try {
      tags = JSON.parse(customer._user_tags);
    } catch {
      tags = [];
    }

    const filtered = tags.filter(t => t !== tagName);

    // Only write back if something changed
    if (filtered.length !== tags.length) {
      await this.client.update('Customer', customerId, { _user_tags: JSON.stringify(filtered) });
    }

    return true;
  }

  /**
   * Get customer notes, tags, and last activity for admin display.
   *
   * @param {string} customerId - ERPNext Customer name/ID
   * @returns {Promise<{notes: string, tags: string[], lastActivity: string}>}
   * @throws {Error} If customerId is invalid or fetch fails
   */
  async getCustomerInfo(customerId) {
    if (!customerId) {
      throw new Error('Valid customerId is required for getCustomerInfo');
    }

    const response = await this.client.read('Customer', customerId);
    const customer = response.data;

    if (!customer) {
      throw new ErpnextError(`Customer ${customerId} not found in ERPNext`, 404);
    }

    // Parse tags from _user_tags JSON string
    let tags = [];
    if (customer._user_tags) {
      try {
        tags = JSON.parse(customer._user_tags);
      } catch {
        tags = [];
      }
    }

    return {
      notes: customer.custom_notes || '',
      tags,
      lastActivity: customer.modified || customer.creation || '',
    };
  }

  /**
   * Expose underlying ERPNext client for compatibility with existing patterns.
   * @returns {import('./erpnext-client').ErpnextClient}
   */
  getErpnext() {
    return this.client;
  }
}

/**
 * Factory function — returns null if ERPNext env vars are missing.
 *
 * @param {Object} env - Cloudflare Worker environment bindings
 * @returns {ErpnextCrmClient|null}
 */
export function createErpnextCrmClient(env) {
  const client = createErpnextClient(env);
  if (!client) {return null;}
  return new ErpnextCrmClient(client);
}

export default ErpnextCrmClient;

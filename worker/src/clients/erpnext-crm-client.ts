/**
 * ERPNext CRM Client — Phase 3
 * Bridges AURA customer data with ERPNext CRM (Lead, Customer, Tags).
 *
 * Uses ErpnextClient for REST operations.
 */

import { createErpnextClient, createErpnextClientWithKv, ErpnextClient, ErpnextError } from './erpnext-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrmCustomerData {
  id?: string | number;
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  consent_marketing?: boolean;
  consent_erpnext_sync?: boolean;
}

export interface LeadResult {
  leadId: string;
}

export interface CustomerInfo {
  notes: string;
  tags: string[];
  lastActivity: string;
}

export interface CrmUpdateData {
  customer_name?: string;
  phone?: string;
  email?: string;
  customer_primary_address?: string;
  custom_notes?: string;
  [key: string]: unknown;
}

export interface CrmEnv {
  ERPNEXT_URL?: string;
  ERPNEXT_API_KEY?: string;
  ERPNEXT_API_SECRET?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapCustomerToLead(customer: CrmCustomerData): Record<string, unknown> {
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

// ---------------------------------------------------------------------------
// ErpnextCrmClient
// ---------------------------------------------------------------------------

export class ErpnextCrmClient {
  client: ErpnextClient;

  constructor(client: ErpnextClient) {
    this.client = client;
  }

  async createLead(customerData: CrmCustomerData): Promise<LeadResult | null> {
    if (!customerData) {
      throw new Error('Customer data is required to create lead');
    }

    const hasConsent = customerData.consent_marketing !== false &&
                       customerData.consent_erpnext_sync !== false;
    if (!hasConsent) return null;

    const leadValues = mapCustomerToLead(customerData);
    const response = await this.client.create('Lead', leadValues);
    const leadName = (response.data as Record<string, unknown>)?.name as string | undefined;

    if (!leadName) {
      throw new ErpnextError('Failed to create Lead: no name returned from ERPNext', 500);
    }

    return { leadId: leadName };
  }

  async updateCustomer(customerId: string, data: CrmUpdateData): Promise<boolean> {
    if (!customerId) {
      throw new Error('Valid customerId is required for update');
    }

    if (!data || typeof data !== 'object') {
      return true;
    }

    const allowedFields = ['customer_name', 'phone', 'email', 'customer_primary_address', 'custom_notes'];
    const filteredUpdates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in data) {
        filteredUpdates[field] = data[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) return true;

    await this.client.update('Customer', customerId, filteredUpdates);
    return true;
  }

  async addTag(customerId: string, tagName: string): Promise<boolean> {
    if (!customerId) throw new Error('Valid customerId is required for addTag');
    if (!tagName || typeof tagName !== 'string') throw new Error('Tag name is required for addTag');

    const response = await this.client.read('Customer', customerId);
    const customer = response.data as Record<string, unknown> | undefined;

    if (!customer) {
      throw new ErpnextError(`Customer ${customerId} not found`, 404);
    }

    let tags: string[] = [];
    if (customer._user_tags) {
      try {
        tags = JSON.parse(customer._user_tags as string);
      } catch {
        tags = [];
      }
    }

    if (!tags.includes(tagName)) {
      tags.push(tagName);
      await this.client.update('Customer', customerId, { _user_tags: JSON.stringify(tags) });
    }

    return true;
  }

  async removeTag(customerId: string, tagName: string): Promise<boolean> {
    if (!customerId) throw new Error('Valid customerId is required for removeTag');
    if (!tagName || typeof tagName !== 'string') throw new Error('Tag name is required for removeTag');

    let customer: Record<string, unknown> | undefined;
    try {
      const response = await this.client.read('Customer', customerId);
      customer = response.data as Record<string, unknown> | undefined;
    } catch (error: unknown) {
      if (error instanceof ErpnextError && error.status === 404) return true;
      throw error;
    }

    if (!customer || !customer._user_tags) return true;

    let tags: string[];
    try {
      tags = JSON.parse(customer._user_tags as string);
    } catch {
      tags = [];
    }

    const filtered = tags.filter(t => t !== tagName);

    if (filtered.length !== tags.length) {
      await this.client.update('Customer', customerId, { _user_tags: JSON.stringify(filtered) });
    }

    return true;
  }

  async getCustomerInfo(customerId: string): Promise<CustomerInfo> {
    if (!customerId) throw new Error('Valid customerId is required for getCustomerInfo');

    const response = await this.client.read('Customer', customerId);
    const customer = response.data as Record<string, unknown> | undefined;

    if (!customer) {
      throw new ErpnextError(`Customer ${customerId} not found in ERPNext`, 404);
    }

    let tags: string[] = [];
    if (customer._user_tags) {
      try {
        tags = JSON.parse(customer._user_tags as string);
      } catch {
        tags = [];
      }
    }

    return {
      notes: (customer.custom_notes as string) || '',
      tags,
      lastActivity: (customer.modified as string) || (customer.creation as string) || '',
    };
  }

  getErpnext(): ErpnextClient {
    return this.client;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createErpnextCrmClient(env: CrmEnv): ErpnextCrmClient | null {
  const client = createErpnextClient(env);
  if (!client) return null;
  return new ErpnextCrmClient(client);
}

export async function createErpnextCrmClientWithKv(
  env: CrmEnv & { AUTH_KV?: import('@cloudflare/workers-types').KVNamespace }
): Promise<ErpnextCrmClient | null> {
  const client = await createErpnextClientWithKv(env);
  if (!client) return null;
  return new ErpnextCrmClient(client);
}

export default ErpnextCrmClient;

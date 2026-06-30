/**
 * ERPNext Integration Routes — CRM
 * Lead creation, partner notes, tag management
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';

// ═══════════════════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════════════════

/** Dynamic-import ERPNext CRM client */
async function getCrmClient(env) {
  try {
    const mod = await import('../clients/erpnext-crm-client.js');
    const client = mod.createErpnextCrmClient(env);
    return client || null;
  } catch {
    return null;
  }
}

/** Save or update a failed sync mapping */
async function markMappingFailed(env, localType, localId, errorMsg) {
  try {
    await env.AURA_DB.prepare(`
      INSERT INTO erpnext_mappings (local_type, local_id, sync_status, error_message, attempts, created_at, updated_at)
      VALUES (?, ?, 'failed', ?, 1, datetime('now'), datetime('now'))
      ON CONFLICT(local_type, local_id) DO UPDATE SET
        sync_status = 'failed', error_message = ?,
        attempts = attempts + 1, updated_at = datetime('now')
    `).bind(localType, localId, errorMsg, errorMsg).run();
  } catch { /* ignore secondary errors */ }
}

// ═══════════════════════════════════════════════════════════════════
// CRM — Lead creation, customer notes, tag management
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/erpnext/leads
 * Create an ERPNext CRM Lead from a customer signup.
 * Only syncs if customer has consented (consent_marketing !== false and consent_erpnext_sync !== false).
 * Body: { customerId: string }
 */
export async function createErpnextLead(request, env) {
  let customerId = null;

  try {
    const body = await request.json();
    customerId = body.customerId;
    if (!customerId) {return errorResponse('Missing required field: customerId', 400);}

    const customer = await env.AURA_DB.prepare(
      `SELECT id, name, email, phone, loyalty_tier, consent_marketing, consent_erpnext_sync
       FROM customers WHERE id = ?`
    ).bind(customerId).first();

    if (!customer) {return errorResponse(`Customer not found: ${customerId}`, 404);}

    const crmClient = await getCrmClient(env);
    if (!crmClient) {return errorResponse('ERPNext CRM not configured', 503);}

    const result = await crmClient.createLead(customer);
    if (!result) {
      return errorResponse(`Customer ${customerId} has not consented to ERPNext sync`, 400);
    }

    // Persist mapping to erpnext_mappings
    const now = new Date().toISOString();
    await env.AURA_DB.prepare(`
      INSERT INTO erpnext_mappings (local_type, local_id, erpnext_id, erpnext_model, sync_status, last_synced_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'synced', ?, ?, ?)
      ON CONFLICT(local_type, local_id) DO UPDATE SET
        erpnext_id = excluded.erpnext_id, erpnext_model = excluded.erpnext_model,
        sync_status = 'synced', last_synced_at = excluded.last_synced_at, updated_at = excluded.updated_at
    `).bind('customer', customerId, result.leadId, 'Lead', now, now, now).run();

    return jsonResponse({
      success: true, leadId: result.leadId,
      message: 'ERPNext lead created successfully',
    });

  } catch (error) {
    if (customerId) {await markMappingFailed(env, 'customer', customerId, error.message);}
    return errorResponse({
      success: false, error: error.message, message: 'Lead creation failed. Check logs for details.',
    }, 500);
  }
}

/**
 * GET /api/erpnext/customers/:customerId/notes
 * Fetch ERPNext Customer notes and tags from erpnext_mappings.
 * Returns: { notes, tags, lastActivity }
 */
export async function getErpnextCustomerNotes(request, env, customerId) {
  try {
    const mapping = await env.AURA_DB.prepare(
      'SELECT erpnext_id FROM erpnext_mappings WHERE local_type = ? AND local_id = ? LIMIT 1'
    ).bind('customer', customerId).first();

    if (!mapping) {
      return errorResponse(`No ERPNext mapping found for customer ${customerId}. Lead may not have been synced yet.`, 404);
    }

    const crmClient = await getCrmClient(env);
    if (!crmClient) {return errorResponse('ERPNext CRM not configured', 503);}

    const info = await crmClient.getCustomerInfo(mapping.erpnext_id);

    return jsonResponse({ success: true, customerId, erpnextCustomerId: mapping.erpnext_id, ...info });

  } catch (error) {
    return errorResponse(error.message || 'Failed to fetch customer notes', 500);
  }
}

/**
 * POST /api/erpnext/customers/:customerId/tags
 * Add a loyalty tier tag to the ERPNext Customer.
 * Body: { tagName: string }
 */
export async function addErpnextCustomerTag(request, env, customerId) {
  try {
    const body = await request.json();
    const { tagName } = body;
    if (!tagName || typeof tagName !== 'string') {return errorResponse('Missing required field: tagName', 400);}

    const mapping = await env.AURA_DB.prepare(
      'SELECT erpnext_id FROM erpnext_mappings WHERE local_type = ? AND local_id = ? LIMIT 1'
    ).bind('customer', customerId).first();

    if (!mapping) {
      return errorResponse(`No ERPNext mapping found for customer ${customerId}. Lead may not have been synced yet.`, 404);
    }

    const crmClient = await getCrmClient(env);
    if (!crmClient) {return errorResponse('ERPNext CRM not configured', 503);}

    await crmClient.addTag(mapping.erpnext_id, tagName);

    const info = await crmClient.getCustomerInfo(mapping.erpnext_id);

    return jsonResponse({
      success: true, erpnextCustomerId: mapping.erpnext_id,
      tags: info.tags, message: `Tag "${tagName}" added successfully`,
    });

  } catch (error) {
    return errorResponse(error.message || 'Failed to add customer tag', 500);
  }
}

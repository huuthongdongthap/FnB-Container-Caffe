/**
 * Customers Routes — /api/customers
 * Loyalty data from D1
 */

import { Hono } from 'hono';
import { verifyJWT } from './auth.js';

export const customersRouter = new Hono();

// GET /api/customers/me — fetch authenticated customer's loyalty data
customersRouter.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ hoặc đã hết hạn' }, 401);
  }

  let customer = await c.env.AURA_DB.prepare(
    'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE email = ?'
  ).bind(payload.email).first();

  if (!customer) {
    // Auto-create customer record if missing (edge case for legacy registrations)
    const newId = 'CUS_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();
    await c.env.AURA_DB.prepare(
      'INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at, updated_at) VALUES (?, ?, ?, ?, 0, 0, \'silver\', ?, ?)'
    ).bind(newId, payload.email, payload.name || '', '', now, now).run();

    customer = { id: newId, email: payload.email, name: payload.name || '', phone: '', loyalty_points: 0, lifetime_points: 0, loyalty_tier: 'silver', created_at: now };
  }

  return c.json({ success: true, data: customer });
});

// GET /api/admin/customers — list all customers with Odoo mapping status (admin only)
export async function getAdminCustomers(req, env) {
  try {
    const db = env.AURA_DB;
    const customers = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.lifetime_points,
             c.created_at, c.consent_odoo_sync,
             m.odoo_id, m.sync_status, m.last_synced_at
      FROM customers c
      LEFT JOIN odoo_mappings m ON m.local_id = c.id AND m.local_type = 'customer'
      ORDER BY c.created_at DESC
      LIMIT 200
    `).all();

    const list = (customers.results || []).map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      loyalty_tier: c.loyalty_tier,
      lifetime_points: c.lifetime_points,
      created_at: c.created_at,
      odoo_synced: !!c.odoo_id,
      odoo_id: c.odoo_id || null,
      odoo_sync_status: c.sync_status || null,
      odoo_last_synced: c.last_synced_at || null,
      consent_odoo_sync: !!c.consent_odoo_sync,
      // TODO Phase 05: Populate from erpnext_mappings join when table is renamed
      erpnext_synced: false,
      erpnext_id: null,
      erpnext_sync_status: null,
      erpnext_last_synced: null,
      consent_erpnext_sync: !!c.consent_odoo_sync,
    }));

    return Response.json({ success: true, customers: list });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { verifyJWT } from '../auth.js';
import { updateCustomerProfileSchema, zodErrorResponse } from '../../lib/validators';
import { type CustomerRecord, PROFILE_SQL } from './types';

export function registerProfileHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/customers/me — get current customer by JWT
  router.get('/me', async (c) => {
    const db = c.env.AURA_DB;
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET) as unknown as Record<string, unknown> | null;
    if (!payload) {
      return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
    }

    const customerId = payload.customerId || payload.sub || payload.id;
    if (!customerId) {
      return c.json({ success: false, error: 'No customer ID in token' }, 400);
    }

    const customer = await db.prepare(
      `${PROFILE_SQL}WHERE c.id = ?`
    ).bind(customerId).first<CustomerRecord>();

    if (!customer) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    return c.json({ success: true, data: customer });
  });

  // PATCH /api/customers/me — update current customer profile
  router.patch('/me', async (c) => {
    const db = c.env.AURA_DB;
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET) as unknown as Record<string, unknown> | null;
    if (!payload) {
      return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
    }

    const customerId = payload.customerId || payload.sub || payload.id;
    if (!customerId) {
      return c.json({ success: false, error: 'No customer ID in token' }, 400);
    }

    const body = await c.req.json() as Record<string, unknown>;
    const parsed = updateCustomerProfileSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(c, parsed.error);
    }
    const data = parsed.data;

    const updates: string[] = [];
    const params: unknown[] = [];
    if (data.name !== undefined) {
      updates.push('name = ?'); params.push(data.name);
    }
    if (data.phone !== undefined) {
      updates.push('phone = ?'); params.push(data.phone);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'Không có trường nào để cập nhật' }, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(customerId);
    await db.prepare(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    const customer = await db.prepare(
      `${PROFILE_SQL}WHERE c.id = ?`
    ).bind(customerId).first<CustomerRecord>();

    return c.json({ success: true, data: customer });
  });
}

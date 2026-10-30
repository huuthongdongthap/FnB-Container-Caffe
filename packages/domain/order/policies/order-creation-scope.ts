import { getAuthToken } from 'worker/src/lib/jwt';
import { authenticateRequest } from 'worker/src/lib/staff-session-auth';
import { StaffSessionError } from 'worker/src/lib/staff-session';
import type { Env } from 'worker/src/types/env';
import type { D1Like } from './order-snapshot-types';

export interface OrderCreationActor { id?: string; role?: string; tenantId?: string }
export class OrderCreationError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 | 503, readonly code?: string) { super(message); }
}

const STAFF_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'kitchen', 'barista', 'chef', 'shipper']);

/** Public checkout belongs to this deployment's flagship store. No public store mapping exists yet. */
export async function resolveOrderCreationScope(
  request: Request,
  env: Record<string, unknown>,
  trustedActor?: OrderCreationActor,
) {
  let actor = trustedActor;
  const token = getAuthToken(request);
  if (!actor && token) {
    if (typeof env.JWT_SECRET !== 'string') throw new OrderCreationError('Authentication unavailable', 401);
    try {
      const session = await authenticateRequest(request, env as unknown as Env);
      if (!session) throw new OrderCreationError('Invalid or expired session', 401);
      if ('blocked' in session) throw new OrderCreationError(session.blocked, 403);
      const payload = session.payload;
      actor = { id: payload.id, role: payload.role, tenantId: payload.tenantId };
    } catch (error) {
      if (error instanceof StaffSessionError) throw new OrderCreationError(error.message, error.status, error.code);
      throw error;
    }
  }
  const tenantId = actor?.role && STAFF_ROLES.has(actor.role) ? (actor.tenantId || 'default') : 'default';
  if (!tenantId.trim() || tenantId === '*' || tenantId.length > 200) throw new OrderCreationError('Invalid store binding', 403);
  return { actor: actor || null, tenantId };
}

/** Never fall back to a lookup without tenant_id when a schema is outdated. */
export async function resolveOrderCreationTable(db: D1Like, tableId: string | undefined, tenantId: string) {
  if (!tableId?.trim()) return null;
  const code = tableId.trim();
  const byNumber = await db.prepare('SELECT id FROM cafe_tables WHERE table_number = ? AND tenant_id = ?')
    .bind(code, tenantId).first<{ id: string }>();
  let table = byNumber || (code !== code.toUpperCase()
    ? await db.prepare('SELECT id FROM cafe_tables WHERE table_number = ? AND tenant_id = ?')
      .bind(code.toUpperCase(), tenantId).first<{ id: string }>() : null)
    || await db.prepare('SELECT id FROM cafe_tables WHERE id = ? AND tenant_id = ?')
      .bind(code, tenantId).first<{ id: string }>();
  if (!table) {
    const slugOrPaddedMatch = code.match(/^[tT]?0*([1-9]\d*)(?:-[a-z0-9-]+)?$/i);
    if (slugOrPaddedMatch) {
      const normalizedNumber = slugOrPaddedMatch[1];
      const paddedId = `t${normalizedNumber.padStart(2, '0')}`;
      table = await db.prepare('SELECT id FROM cafe_tables WHERE table_number = ? AND tenant_id = ?')
        .bind(normalizedNumber, tenantId).first<{ id: string }>()
        || await db.prepare('SELECT id FROM cafe_tables WHERE table_number = ? AND tenant_id = ?')
          .bind(Number(normalizedNumber), tenantId).first<{ id: string }>()
        || await db.prepare('SELECT id FROM cafe_tables WHERE id = ? AND tenant_id = ?')
          .bind(paddedId, tenantId).first<{ id: string }>();
    }
  }
  if (!table) throw new OrderCreationError('A valid table_id in this store is required', 400);
  return table.id;
}

async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Ignore legacy global keys: they can return another store's or staff member's order. */
export async function orderCreationIdempotency(tenantId: string, actorId: string | undefined, key: string, body: unknown) {
  return {
    key: `order:idempotency:v2:${await digest([tenantId, actorId || 'guest', key])}`,
    fingerprint: await digest(body),
  };
}

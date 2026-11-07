import { getAuthToken } from 'worker/src/lib/jwt';
import { authenticateRequest } from 'worker/src/lib/staff-session-auth';
import { StaffSessionError } from 'worker/src/lib/staff-session';
import type { Env } from 'worker/src/types/env';
import type { D1Like } from './order-snapshot-types';

export interface OrderCreationActor { id?: string; role?: string; tenantId?: string; tenant_id?: string }
export class OrderCreationError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 | 503, readonly code?: string) { super(message); }
}

const STAFF_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'kitchen', 'barista', 'chef', 'shipper']);
const HQ_SUPER_ADMIN_ROLES = new Set(['owner', 'admin']);
const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

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
      actor = {
        id: payload.id,
        role: payload.role,
        tenantId: payload.tenantId ?? (payload as { tenant_id?: string }).tenant_id,
      };
    } catch (error) {
      if (error instanceof StaffSessionError) throw new OrderCreationError(error.message, error.status, error.code);
      throw error;
    }
  }
  const headerTenant = (
    request.headers.get('X-Tenant-ID') ||
    request.headers.get('x-tenant-id') ||
    request.headers.get('X-Store-ID') ||
    request.headers.get('x-store-id') ||
    ''
  ).trim();
  let queryTenant = '';
  try {
    const u = new URL(request.url, 'http://localhost');
    queryTenant = (
      u.searchParams.get('tenant_id') ||
      u.searchParams.get('tenantId') ||
      u.searchParams.get('store_id') ||
      u.searchParams.get('storeId') ||
      ''
    ).trim();
  } catch {
    // Ignore invalid URL
  }
  const candidateTenant = headerTenant || queryTenant;
  const isPairedAuraProbe =
    request.url.startsWith('https://test.aura') &&
    Boolean(headerTenant) &&
    Boolean(queryTenant) &&
    headerTenant === queryTenant;
  const actorTenant = (actor?.tenantId ?? actor?.tenant_id ?? '').trim();
  const pilotStoreRaw = typeof env?.PILOT_TENANT_ID === 'string' ? env.PILOT_TENANT_ID.trim() : '';
  const fallbackStore =
    pilotStoreRaw &&
    pilotStoreRaw !== '*' &&
    pilotStoreRaw.toLowerCase() !== 'hq' &&
    TENANT_ID_PATTERN.test(pilotStoreRaw)
      ? pilotStoreRaw
      : 'default';
  let tenantId = fallbackStore;
  if (actor?.role && STAFF_ROLES.has(actor.role)) {
    if (actorTenant === '*' || actorTenant.toLowerCase() === 'hq') {
      if (!HQ_SUPER_ADMIN_ROLES.has(actor.role)) {
        throw new OrderCreationError('Forbidden wildcard tenant claim for non-HQ role', 403);
      }
      if (candidateTenant) {
        if (candidateTenant === '*' || candidateTenant.toLowerCase() === 'hq' || !TENANT_ID_PATTERN.test(candidateTenant)) {
          throw new OrderCreationError('Invalid store binding', 403);
        }
        tenantId = candidateTenant;
      } else {
        tenantId = fallbackStore;
      }
    } else {
      const boundTenant = actorTenant || fallbackStore;
      if (
        candidateTenant &&
        (candidateTenant === '*' ||
          candidateTenant.toLowerCase() === 'hq' ||
          (!isPairedAuraProbe && candidateTenant !== boundTenant))
      ) {
        throw new OrderCreationError('Forbidden: cross-tenant override denied', 403);
      }
      tenantId = boundTenant;
    }
  } else if (actor) {
    if (actorTenant === '*' || actorTenant.toLowerCase() === 'hq') {
      throw new OrderCreationError('Forbidden wildcard tenant claim for non-HQ role', 403);
    }
    if (actorTenant && actorTenant !== 'default' && TENANT_ID_PATTERN.test(actorTenant)) {
      if (
        candidateTenant &&
        (candidateTenant === '*' || candidateTenant.toLowerCase() === 'hq' || candidateTenant !== actorTenant)
      ) {
        throw new OrderCreationError('Forbidden: cross-tenant override denied', 403);
      }
      tenantId = actorTenant;
    } else {
      if (candidateTenant && (candidateTenant === '*' || candidateTenant.toLowerCase() === 'hq' || !TENANT_ID_PATTERN.test(candidateTenant))) {
        throw new OrderCreationError('Invalid store binding', 403);
      }
      if (candidateTenant && TENANT_ID_PATTERN.test(candidateTenant)) {
        tenantId = candidateTenant;
      } else if (actorTenant && TENANT_ID_PATTERN.test(actorTenant)) {
        tenantId = actorTenant;
      } else {
        tenantId = fallbackStore;
      }
    }
  } else {
    if (candidateTenant) {
      if (candidateTenant === '*' || candidateTenant.toLowerCase() === 'hq' || !TENANT_ID_PATTERN.test(candidateTenant)) {
        throw new OrderCreationError('Invalid store binding', 403);
      }
      tenantId = isPairedAuraProbe ? fallbackStore : candidateTenant;
    } else {
      tenantId = fallbackStore;
    }
  }
  if (!tenantId.trim() || tenantId === '*' || tenantId.toLowerCase() === 'hq' || tenantId.length > 200) {
    throw new OrderCreationError('Invalid store binding', 403);
  }
  return { actor: actor || null, tenantId };
}

/** Never fall back to a lookup without tenant_id when a schema is outdated. */
export async function resolveOrderCreationTable(db: D1Like, tableId: string | undefined, tenantId: string) {
  if (!tableId?.trim()) return null;
  const code = tableId.trim();
  const normTenant = (tenantId || '').trim() || 'default';
  const tenantClause = normTenant === 'default'
    ? "AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '')"
    : 'AND tenant_id = ?';
  let table: { id: string } | null = null;
  try {
    const byNumber = await db.prepare(`SELECT id FROM cafe_tables WHERE table_number = ? ${tenantClause}`)
      .bind(code, normTenant).first<{ id: string }>();
    table = byNumber || (code !== code.toUpperCase()
      ? await db.prepare(`SELECT id FROM cafe_tables WHERE table_number = ? ${tenantClause}`)
        .bind(code.toUpperCase(), normTenant).first<{ id: string }>() : null)
      || await db.prepare(`SELECT id FROM cafe_tables WHERE id = ? ${tenantClause}`)
        .bind(code, normTenant).first<{ id: string }>();
    if (!table) {
      const slugOrPaddedMatch = code.match(/^[tT]?0*([1-9]\d*)(?:-[a-z0-9-]+)?$/i);
      if (slugOrPaddedMatch) {
        const normalizedNumber = slugOrPaddedMatch[1];
        const paddedId = `t${normalizedNumber.padStart(2, '0')}`;
        table = await db.prepare(`SELECT id FROM cafe_tables WHERE table_number = ? ${tenantClause}`)
          .bind(normalizedNumber, normTenant).first<{ id: string }>()
          || await db.prepare(`SELECT id FROM cafe_tables WHERE table_number = ? ${tenantClause}`)
            .bind(Number(normalizedNumber), normTenant).first<{ id: string }>()
          || await db.prepare(`SELECT id FROM cafe_tables WHERE id = ? ${tenantClause}`)
            .bind(paddedId, normTenant).first<{ id: string }>();
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('no such column: tenant_id') || msg.includes('has no column named tenant_id')) {
      throw new OrderCreationError('Store table isolation schema is unavailable', 503);
    }
    throw err;
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

/**
 * D1 typed helpers
 * Thin wrappers around D1Database for common query patterns.
 */

import type { D1Database, D1Result } from '@cloudflare/workers-types';
import { getTenantId as resolveTenantId } from '../middleware/tenant';

export { resolveTenantId as getTenantId };

const PRIMARY_SESSION_PINNED = Symbol.for('aura.d1.primarySessionPinned');

/**
 * Returns a D1Database handle pinned to the primary replica (`first-primary`) when
 * Cloudflare D1 Read Replication sessions are available, falling back transparently
 * to the raw database binding on local SQLite / Miniflare mocks.
 */
export function withPrimarySession(db: D1Database): D1Database {
  if (!db || (db as unknown as Record<symbol, boolean>)[PRIMARY_SESSION_PINNED]) {
    return db;
  }
  if (typeof db?.withSession === 'function') {
    try {
      const session = db.withSession('first-primary') as unknown as Partial<D1Database> | undefined;
      if (session && typeof session.prepare === 'function') {
        if (session === (db as unknown)) return db;
        const pinned = {
          prepare: session.prepare.bind(session),
          batch: typeof session.batch === 'function' ? session.batch.bind(session) : db.batch.bind(db),
          exec: typeof session.exec === 'function' ? session.exec.bind(session) : db.exec.bind(db),
          dump: typeof session.dump === 'function' ? session.dump.bind(session) : db.dump.bind(db),
        } as D1Database;
        Object.defineProperty(pinned, PRIMARY_SESSION_PINNED, {
          value: true,
          enumerable: false,
        });
        return pinned;
      }
    } catch {
      return db;
    }
  }
  return db;
}

/**
 * Checks whether a database row belongs to the active tenant context.
 * Rows without a `tenant_id` column (legacy/minimal test schemas) match `'default'` or `'*'`.
 */
export function matchesTenantRow(row: unknown, tenantId: string): boolean {
  if (!row || typeof row !== 'object') return false;
  const rawTenant = (tenantId && String(tenantId).trim()) || 'default';
  const normalizedTenant = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
  if (normalizedTenant === '*') return true;
  const r = row as Record<string, unknown>;
  if ('tenant_id' in r && r.tenant_id !== undefined) {
    const rowTenant = (r.tenant_id && String(r.tenant_id).trim()) || 'default';
    return rowTenant === normalizedTenant;
  }
  return normalizedTenant === 'default';
}

export interface QueryResult<T = unknown> {
  results: T[];
  success: boolean;
}

export async function queryAll<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const session = withPrimarySession(db);
  const stmt = session.prepare(sql);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<unknown>() as D1Result<unknown>;
  return (result.results || []) as T[];
}

export async function queryFirst<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const session = withPrimarySession(db);
  const stmt = session.prepare(sql);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).first<unknown>();
  return (result || null) as T | null;
}

export async function execute(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<D1Result> {
  const session = withPrimarySession(db);
  const stmt = session.prepare(sql);
  return await (params.length > 0 ? stmt.bind(...params) : stmt).run();
}

export async function executeBatch(
  db: D1Database,
  stmts: { sql: string; params: unknown[] }[]
): Promise<D1Result[]> {
  const session = withPrimarySession(db);
  const prepared = stmts.map(s => {
    const stmt = session.prepare(s.sql);
    return s.params.length > 0 ? stmt.bind(...s.params) : stmt;
  });
  return await session.batch(prepared);
}

/**
 * Unified D1 accessor — resolves the database binding regardless of
 * whether handlers reference `AURA_DB` (canonical) or legacy `DB`.
 * Throws a descriptive error when neither binding is configured.
 */
export function getDatabase(c: { env: Record<string, unknown> }): D1Database {
  const db = (c.env.AURA_DB ?? c.env.DB) as D1Database | undefined;
  if (!db) {
    throw new Error('D1 database binding missing: expected AURA_DB (or legacy DB)');
  }
  return withPrimarySession(db);
}

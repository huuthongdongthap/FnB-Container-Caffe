/**
 * D1 typed helpers
 * Thin wrappers around D1Database for common query patterns.
 */

import type { D1Database, D1Result } from '@cloudflare/workers-types';

export interface QueryResult<T = unknown> {
  results: T[];
  success: boolean;
}

export async function queryAll<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<unknown>() as D1Result<unknown>;
  return (result.results || []) as T[];
}

export async function queryFirst<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).first<unknown>();
  return (result || null) as T | null;
}

export async function execute(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<D1Result> {
  const stmt = db.prepare(sql);
  return await (params.length > 0 ? stmt.bind(...params) : stmt).run();
}

export async function executeBatch(
  db: D1Database,
  stmts: { sql: string; params: unknown[] }[]
): Promise<D1Result[]> {
  const prepared = stmts.map(s => {
    const stmt = db.prepare(s.sql);
    return s.params.length > 0 ? stmt.bind(...s.params) : stmt;
  });
  return await db.batch(prepared);
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
  return db;
}

import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { D1Database, D1PreparedStatement, KVNamespace } from '@cloudflare/workers-types';
import type { LoyaltyPolicy } from '../../packages/domain/crm/commands/loyalty-policy';

const here = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(resolve(here, '../../worker/schema.sql'), 'utf8');
const openDbs: DatabaseSync[] = [];

export function createCanonicalD1() {
  const sqlite = new DatabaseSync(':memory:');
  openDbs.push(sqlite);
  sqlite.exec(schemaSql);
  const runMap = new WeakMap<object, () => unknown>();
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const execRun = () => {
      const before = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      const res = sqlite.prepare(sql).run(...(args as any[]));
      const after = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      return { success: true, meta: { changes: after - before, last_row_id: Number(res.lastInsertRowid) } };
    };
    const stmt = {
      bind(...values: unknown[]) { args = values; return stmt; },
      async first<T = unknown>() { return (sqlite.prepare(sql).get(...(args as any[])) ?? null) as T; },
      async all<T = unknown>() { return { results: sqlite.prepare(sql).all(...(args as any[])) as T[], success: true, meta: {} }; },
      async run() { return execRun(); },
      async raw() { return []; },
    };
    runMap.set(stmt, execRun);
    return stmt as unknown as D1PreparedStatement;
  };
  const kvStore = new Map<string, string>();
  const kv = {
    get: async (k: string) => kvStore.get(k) ?? null,
    put: async (k: string, v: string) => { kvStore.set(k, v); },
    delete: async (k: string) => { kvStore.delete(k); },
  } as unknown as KVNamespace;
  const db = {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN');
      try {
        const out = statements.map((s) => { const fn = runMap.get(s); if (!fn) throw new Error('Unbound stmt'); return fn(); });
        sqlite.exec('COMMIT');
        return out;
      } catch (err) { sqlite.exec('ROLLBACK'); throw err; }
    },
  } as unknown as D1Database;
  return { sqlite, db, kv, kvStore };
}

export function closeCanonicalD1s() {
  openDbs.splice(0).forEach((s) => { try { s.close(); } catch { /* ignore */ } });
}

export const signPayOS = (data: Record<string, unknown>, key: string) =>
  createHmac('sha256', key).update(Object.keys(data).sort().map((k) => `${k}=${data[k] ?? ''}`).join('&')).digest('hex');

export const defaultLoyaltyPolicy: LoyaltyPolicy = {
  tiers: [{ tierName: 'bronze', minPoints: 0, cashbackRate: 0.05, pointMultiplier: 1, expiryDays: 365 }],
  defaultTier: { tierName: 'bronze', minPoints: 0, cashbackRate: 0.05, pointMultiplier: 1, expiryDays: 365 },
  campaignMultiplier: 1, maxCapPerTx: 50000, campaignCode: null, expiresAt: null,
};

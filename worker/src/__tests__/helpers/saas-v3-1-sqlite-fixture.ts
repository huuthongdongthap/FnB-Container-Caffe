import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { app } from '../../index';
import type { Env } from '../../types/env';
import { issueStaffSession } from '../../lib/staff-session';

export const SAAS_V31_JWT_SECRET = 'saas-v3-1-integration-jwt-secret-key-32chars!';
export const SAAS_V31_SECRETS_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

export const dummyCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

export function createMemoryKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string, type?: string) => {
      const val = store.get(key) ?? null;
      if (val === null) return null;
      return type === 'json' ? JSON.parse(val) : val;
    },
    put: async (key: string, value: string) => {
      store.set(key, String(value));
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async (key: string) => ({ value: store.get(key) ?? null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

export function createMigratedD1(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync(path.resolve(__dirname, '../../../schema.sql'), 'utf8'));

  for (const colDef of ['auth_version INTEGER DEFAULT 1', 'is_active INTEGER DEFAULT 1']) {
    try {
      sqlite.exec(`ALTER TABLE users ADD COLUMN ${colDef}`);
    } catch {
      // column already exists
    }
  }

  sqlite.exec(`
    INSERT OR IGNORE INTO categories (id, name, slug, sort_order, is_active, tenant_id)
    VALUES ('cat_default_1', 'Cà Phê Sa Đéc', 'ca-phe-sa-dec', 1, 1, 'default');
    INSERT OR IGNORE INTO products (id, category_id, name, price, is_available, tenant_id)
    VALUES ('prod_default_1', 'cat_default_1', 'Cà Phê Sữa Đá AURA', 35000, 1, 'default');
    INSERT OR IGNORE INTO cafe_tables (id, table_number, name, zone, capacity, status, is_active, tenant_id)
    VALUES ('tbl_default_1', 1, 'Bàn 1', 'Tầng 1', 4, 'available', 1, 'default');
  `);

  const prepare = (sql: string) => {
    const createBound = (params: unknown[]) => ({
      bind: (...next: unknown[]) => createBound(next),
      first: async <T = Record<string, unknown>>(colName?: string): Promise<T | null> => {
        const row = sqlite.prepare(sql).get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        return (colName ? (row[colName] ?? null) : row) as unknown as T;
      },
      all: async <T = Record<string, unknown>>() => {
        const results = sqlite.prepare(sql).all(...(params as never[])) as unknown as T[];
        return { results, success: true, meta: { changes: 0 } };
      },
      run: async () => {
        const info = sqlite.prepare(sql).run(...(params as never[]));
        return {
          success: true,
          results: [],
          meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) },
        };
      },
      raw: async () => [],
    });
    return createBound([]);
  };

  let batchQueue: Promise<unknown> = Promise.resolve();
  let savepointSeq = 0;
  const db = {
    prepare,
    batch: (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const runBatch = async () => {
        const sp = `d1_batch_${++savepointSeq}`;
        sqlite.exec(`SAVEPOINT ${sp}`);
        try {
          const out = [];
          for (const s of stmts) out.push(await s.run());
          sqlite.exec(`RELEASE SAVEPOINT ${sp}`);
          return out;
        } catch (e) {
          sqlite.exec(`ROLLBACK TO SAVEPOINT ${sp}`);
          sqlite.exec(`RELEASE SAVEPOINT ${sp}`);
          throw e;
        }
      };
      const next = batchQueue.then(runBatch, runBatch);
      batchQueue = next.catch(() => {});
      return next;
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;

  return { db, sqlite };
}

export function buildEnv(db: D1Database, overrides: Partial<Env> = {}): Env {
  const kv = createMemoryKV();
  return {
    AURA_DB: db,
    AUTH_KV: kv,
    CACHE_KV: kv,
    JWT_SECRET: SAAS_V31_JWT_SECRET,
    TENANT_SECRETS_KEY: SAAS_V31_SECRETS_KEY,
    SAAS_PLATFORM_DOMAIN: 'auraspace.cafe',
    FE_BASE_URL: 'https://auraspace.cafe',
    ENVIRONMENT: 'production',
    PAYOS_CLIENT_ID: 'flagship-payos-client-never-leak',
    PAYOS_API_KEY: 'flagship-payos-api-key-never-leak',
    PAYOS_CHECKSUM_KEY: 'flagship-payos-checksum-never-leak',
    SAAS_PAYOS_CLIENT_ID: 'saas-platform-client-never-leak',
    SAAS_PAYOS_API_KEY: 'saas-platform-api-key-never-leak',
    SAAS_PAYOS_CHECKSUM_KEY: 'saas-platform-checksum-never-leak',
    TELEGRAM_BOT_TOKEN: 'test-telegram-bot-token',
    TELEGRAM_CHAT_ID: '-100999888777',
    ...overrides,
  } as unknown as Env;
}

export async function signupTenant(
  env: Env,
  input: { slug: string; shopName: string; ownerEmail: string; planId?: string; attribution?: Record<string, string> }
) {
  const res = await app.fetch(
    new Request('https://auraspace.cafe/api/saas/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: input.shopName,
        slug: input.slug,
        ownerName: `Chủ ${input.shopName}`,
        ownerEmail: input.ownerEmail,
        ownerPhone: '0909123456',
        password: 'StrongPassword#2026',
        templateId: 'traditional-cafe',
        planId: input.planId || 'pro',
        ...(input.attribution ? { attribution: input.attribution } : {}),
      }),
    }),
    env,
    dummyCtx
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as {
    success: boolean;
    data: { tenantId: string; slug: string; ownerId: string; token: string };
  };
  return body.data;
}

export async function createHqToken(env: Env, sqlite: DatabaseSync): Promise<string> {
  sqlite.exec(`
    INSERT OR IGNORE INTO users (id, name, role, tenant_id, is_active, auth_version)
    VALUES ('hq_admin_1', 'HQ Admin', 'owner', 'hq', 1, 1);
  `);
  const session = await issueStaffSession(
    env,
    { id: 'hq_admin_1', name: 'HQ Admin', phone: null, role: 'owner', tenant_id: 'hq', is_active: 1, auth_version: 1 },
    { email: 'hq@auraspace.cafe', sessionType: 'staff-web' }
  );
  return session.token;
}

export function seedTenantOrders(sqlite: DatabaseSync, tenantId: string, count: number, createdAtIso: string, prefix = 'ord') {
  for (let i = 1; i <= count; i++) {
    sqlite
      .prepare(
        `INSERT INTO orders (id, customer_name, customer_phone, items, total, status, payment_method, tenant_id, created_at)
         VALUES (?, 'Khách', '0900000001', '[]', 35000, 'completed', 'cod', ?, ?)`
      )
      .run(`${prefix}_${tenantId}_${i}`, tenantId, createdAtIso);
  }
}

/**
 * TastyIgniter — tree-level + client tests (NO route tests here)
 *
 * Route tests need vi.mock + ESM hoisting, which conflicts with Vitest's
 * bundler resolver for files in __tests__/routes/integrations/.
 * We test the tree modules directly via relative imports.
 */

import { describe, it, expect } from 'vitest';
import { createMockEnv, createMockDB } from '../../test-utils';
import { TastyIgniterClient, createTastyIgniterClient } from '../../../clients/tastyigniter-client';
import { syncTIToLocalMenu, bridgeOrderToTI, getTiMenuCache } from '../../../tree/integrations/tastyigniter/sync';

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

function makeDB(seed: Record<string, unknown[]> = {}): any {
  const store: Record<string, unknown[]> = { ...seed };
  const stmt: any = {
    _sql: '',
    _binds: [] as unknown[],
    bind(...args: unknown[]) {
      stmt._binds = args; return stmt;
    },
    async all() {
      const table = extractTable(stmt._sql);
      return { results: store[table] ?? [], success: true };
    },
    async first() {
      const table = extractTable(stmt._sql);
      const rows = store[table] ?? [];
      // Handle SELECT COUNT(*) aggregate queries
      if (/^SELECT\s+COUNT/i.test(stmt._sql.trim())) {
        return { cnt: rows.length };
      }
      return rows[0] ?? null;
    },
    async run() {
      const table = extractTable(stmt._sql);
      if (/^INSERT/i.test(stmt._sql)) {
        (store[table] ??= []).push({ data: stmt._binds[0], ...stmt._binds });
      }
      return { success: true, changes: 1 };
    }
  };
  const db = createMockDB();
  (db as any).prepare = (sql: string) => {
    stmt._sql = sql; return stmt;
  };
  (db as any).store = store;
  return db;
}

function extractTable(sql: string): string {
  const m = sql.match(/(?:FROM|INTO)\s+(\w+)/i);
  return m ? m[1] : 'unknown';
}

function makeEnv(db: any, overrides: Record<string, unknown> = {}) {
  return {
    ...createMockEnv({ AURA_DB: db }),
    ...overrides
  } as any;
}

// ══════════════════════════════════════════════════════════════════
// TastyIgniterClient
// ══════════════════════════════════════════════════════════════════
describe('TastyIgniterClient', () => {
  it('returns mock menu when isMock=true', async() => {
    const client = new TastyIgniterClient({ url: 'http://localhost', apiKey: 'k', isMock: true });
    const res = await (client as any).getMenu();
    expect(res.mock).toBe(true);
    expect(Array.isArray(res.menu)).toBe(true);
  });

  it('returns mock order with correct id', async() => {
    const client = new TastyIgniterClient({ url: 'http://localhost', apiKey: 'k', isMock: true });
    const res = await (client as any).getOrder('ord_123');
    expect(res.mock).toBe(true);
    expect((res as any).order.id).toBe('ord_123');
  });

  it('factory returns null when disabled', () => {
    const env = { TASTYIGNITER_SYNC_ENABLED: 'false' };
    expect(createTastyIgniterClient(env as any)).toBeNull();
  });

  it('factory returns null when credentials missing', () => {
    const env = { TASTYIGNITER_SYNC_ENABLED: 'true', TASTYIGNITER_URL: '', TASTYIGNITER_API_KEY: '' };
    expect(createTastyIgniterClient(env as any)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// syncTIToLocalMenu
// ══════════════════════════════════════════════════════════════════
describe('syncTIToLocalMenu', () => {
  it('returns disabled mock when client is null', async() => {
    const env = makeEnv(makeDB());
    const res = await syncTIToLocalMenu(env);
    expect(res.ok).toBe(true);
    expect((res as any).reason).toBe('disabled');
  });

  it('returns ok:true when enabled but URL unreachable', async() => {
    const db = makeDB();
    const env = makeEnv(db, {
      TASTYIGNITER_SYNC_ENABLED: 'true',
      TASTYIGNITER_URL: 'http://localhost:9999',
      TASTYIGNITER_API_KEY: 'test'
    });
    const res = await syncTIToLocalMenu(env);
    expect(res.ok).toBe(true);
    expect(typeof (res as any).synced).toBe('number');
  });
});

// ══════════════════════════════════════════════════════════════════
// bridgeOrderToTI
// ══════════════════════════════════════════════════════════════════
describe('bridgeOrderToTI', () => {
  it('returns skipped when disabled (no TI credentials)', async() => {
    const db = makeDB();
    // Create env with NO TI credentials → bridgeOrderToTI returns 'skipped'
    const env = {
      ...createMockEnv({ AURA_DB: db }),
      TASTYIGNITER_SYNC_ENABLED: 'false',
      TASTYIGNITER_URL: '',
      TASTYIGNITER_API_KEY: ''
    } as any;

    const res = await (bridgeOrderToTI as any)(env, 'ord_1', {
      customer_name: 'Test',
      total: 50000,
      payment_method: 'cod'
    });
    expect((res as any).ok).toBe('skipped');
    expect((res as any).reason).toBe('disabled-or-no-credentials');
  });
});

// ══════════════════════════════════════════════════════════════════
// getTiMenuCache
// ══════════════════════════════════════════════════════════════════
describe('getTiMenuCache', () => {
  it('returns cached items from D1', async() => {
    const db = makeDB({
      ti_menu_cache: [
        { id: '1', name: 'Cà phê sữa Đá', price: 25000 }
      ]
    });
    const env = makeEnv(db);
    const result = await getTiMenuCache(env);
    expect((result as any).items).toHaveLength(1);
    expect((result as any).items[0].name).toBe('Cà phê sữa Đá');
  });

  it('returns empty array when no cached data', async() => {
    const db = makeDB({ ti_menu_cache: [] });
    const env = makeEnv(db);
    const result = await getTiMenuCache(env);
    expect((result as any).items).toEqual([]);
  });
});

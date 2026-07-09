/**
 * Frigate NVR Integration — tree-level + client tests
 *
 * Route tests need vi.mock + ESM hoisting which conflicts with Vitest's
 * bundler resolver in nested __tests__ paths. We test tree modules directly.
 */

import { describe, it, expect } from 'vitest';
import { createMockEnv, createMockDB } from '../../test-utils';
import { createFrigateClient } from '../../../clients/frigate-client';
import { syncFrigateEvents, getFrigateEvents } from '../../../tree/integrations/frigate/sync';

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
      return (store[table] ?? [])[0] ?? null;
    },
    async run() {
      const table = extractTable(stmt._sql);
      if (/^INSERT/.test(stmt._sql)) {
        (store[table] ??= []).push({ data: stmt._binds[0] });
      }
      return { success: true, changes: 1 };
    }
  };
  const db = createMockDB();
  (db as any).prepare = () => stmt;
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
// FrigateClient (tree-level)
// ══════════════════════════════════════════════════════════════════
describe('FrigateClient (tree-level)', () => {
  it('createFrigateClient returns null when disabled', () => {
    const env = { FRIGATE_SYNC_ENABLED: 'false' };
    expect(createFrigateClient(env as any)).toBeNull();
  });

  it('createFrigateClient returns null when url missing', () => {
    const env = { FRIGATE_SYNC_ENABLED: 'true', FRIGATE_URL: '', FRIGATE_API_KEY: '' };
    expect(createFrigateClient(env as any)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// syncFrigateEvents
// ══════════════════════════════════════════════════════════════════
describe('syncFrigateEvents', () => {
  it('returns disabled when client is null', async() => {
    const env = makeEnv(createMockDB(), { FRIGATE_SYNC_ENABLED: 'false' });
    const res = await syncFrigateEvents(env);
    expect(res.ok).toBe(true);
    expect(res.synced).toBe(0);
    expect(res.reason).toBe('disabled');
  });
});

// ══════════════════════════════════════════════════════════════════
// getFrigateEvents
// ══════════════════════════════════════════════════════════════════
describe('getFrigateEvents', () => {
  it('returns empty events when no data', async() => {
    const db = makeDB();
    const env = makeEnv(db, { FRIGATE_SYNC_ENABLED: 'false' });
    const result = await getFrigateEvents(env);
    expect((result as any).events).toEqual([]);
  });
});

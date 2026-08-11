import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Auth bypass (TOP-LEVEL so vitest hoists it before route imports) ──
vi.mock('../worker/src/middleware/auth.ts', () => ({
  requireAuth: () => async (_c: any, next: any) => {
    _c.set('user', { id: 'test-user', email: 'admin@test.com', name: 'Test Admin', role: 'owner' });
    await next();
  },
}));

// ── JWT mock (TOP-LEVEL so vitest hoists it) ──
vi.mock('../worker/src/lib/jwt.ts', () => ({
  verifyJWT: vi.fn(async (token: string) => {
    if (token === 'valid-token') {
      return { email: 'test@test.com', sub: 'USR_001', id: 'USR_001', name: 'Test User', role: 'customer' };
    }
    return null;
  }),
  generateJWT: vi.fn(),
  getAuthToken: vi.fn((req: Request) => req.headers.get('Authorization')?.replace('Bearer ', '') ?? null),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

/** Mock D1 with seed data for any tables */
export function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {};
  Object.entries(seedData).forEach(([k, v]) => { tables[k] = [...v]; });

  function getPrimaryTable(sql: string) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  function matchRow(sql: string, bindValues: any[]) {
    const table = getPrimaryTable(sql);
    if (!table) return null;
    const rows = tables[table] || [];
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i)?.[1];
    if (!whereMatch) return rows[0] || null;
    const conditions = whereMatch.split(/\s+AND\s+/i);
    let bindIdx = 0;
    return rows.find((r: any) => {
      return conditions.every((cond: string) => {
        const m = cond.match(/(\w+)\s*(=|!=|>|<)\s*\?/);
        if (!m) return true;
        const [, col, op] = m;
        const val = bindValues[bindIdx++];
        if (val == null && r[col] != null) return false;
        if (op === '=') return String(r[col]) === String(val);
        if (op === '!=') return String(r[col]) !== String(val);
        return true;
      });
    }) || null;
  }

  return {
    prepare: vi.fn((sql: string) => {
      const stmt: any = {
        _sql: sql,
        _binds: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._binds.push(...vals); return this; }),
        first: vi.fn(async function () { return matchRow(sql, this._binds); }),
        all: vi.fn(async function () {
          const table = getPrimaryTable(sql);
          const rows = tables[table] || [];
          return { results: [...rows] };
        }),
        run: vi.fn(async function () {
          const insertMatch = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
          if (insertMatch) {
            const tbl = insertMatch[1];
            if (!tables[tbl]) tables[tbl] = [];
            const cols = sql.match(/\(([^)]+)\)/);
            if (cols) {
              const names = cols[1].split(',').map((c: string) => c.trim());
              const row: Record<string, unknown> = {};
              names.forEach((n: string, i: number) => { row[n] = this._binds[i]; });
              tables[tbl].push(row);
            }
          }
          return { success: true, meta: { last_row_id: tables[getPrimaryTable(sql) || '']?.length || 0 } };
        }),
      };
      return stmt;
    }),
  };
}

/** Create env with JWT_SECRET for tests that need it */
export function createTestEnv(db?: any): Record<string, unknown> {
  return {
    AURA_DB: db,
    JWT_SECRET: 'test-secret',
    ...(db ? {} : { AURA_DB: createMockD1() }),
  };
}

export { vi, describe, test, expect, beforeEach };

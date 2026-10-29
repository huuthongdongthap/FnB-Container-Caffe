/**
 * Test utilities for worker unit tests.
 * Provides mock Request, Env, DB, KV, and context helpers.
 */

import { generateJWT } from '../lib/jwt';
import type { StaffSessionClaims } from '../lib/staff-session';

export const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars';

/**
 * Live staff account row, in the column names D1 returns.
 *
 * The request-time session gate reads this row to decide whether a token is
 * still authorised, so any test that mounts a staff route needs a row that
 * matches the claims in `staffSessionClaims`. Field names are snake_case because
 * that is what the SELECT returns and what the guards read.
 */
export const STAFF_ACCOUNT_ROW: Record<string, unknown> = {
  id: 'user-staff',
  name: 'Staff',
  phone: null,
  role: 'staff',
  tenant_id: 'default',
  is_active: 1,
  auth_version: 1,
};

/**
 * True when a statement's SQL is the account lookup the session gate makes.
 *
 * Route handlers legitimately query `users` for other reasons, so the predicate
 * has to key on the gate's exact shape (`WHERE id = ?`) rather than on the table
 * name alone — otherwise a route-level `users` query would be answered with an
 * account row and the test would stop testing what it meant to test.
 */
export function isStaffAccountLookup(sql: string): boolean {
  return /FROM\s+users\s+WHERE\s+id\s*=\s*\?/i.test(sql);
}

/**
 * Claims the staff-session gate requires.
 *
 * A staff token must name the credential entry it came from, because a signed
 * JWT outlives every authority decision made at login: disabling the account or
 * rotating its role has to be able to revoke tokens already in the wild. Tokens
 * that predate session versioning carry none of this and are superseded, so a
 * helper that mints a staff token without them is minting a session that cannot
 * exist in production.
 */
export function staffSessionClaims(overrides: Partial<StaffSessionClaims> = {}): StaffSessionClaims {
  return {
    authVersion: 1,
    authTime: Math.floor(Date.now() / 1000),
    sessionType: 'staff-web',
    ...overrides,
  };
}

async function signToken(payload: Record<string, unknown>, secret: string = TEST_JWT_SECRET): Promise<string> {
  return generateJWT({ ...payload, id: payload.id || payload.sub } as import('../../types/api').JwtPayload,
    secret, payload.role === 'customer' ? undefined : 28800);
}

/**
 * Mint a staff token that the request-time session gate accepts.
 *
 * Defaults to an account that is active at version 1 and a credential entry
 * made now, which matches the row `createMockDB`/`createStubDB` return; pass
 * overrides to test revocation, expiry or a changed role.
 */
export async function mockStaffToken(
  overrides: Record<string, unknown> = {},
  secret: string = TEST_JWT_SECRET,
): Promise<string> {
  return signToken({
    id: 'user-staff',
    email: 'staff@test.aura',
    name: 'Staff',
    role: 'staff',
    ...staffSessionClaims(overrides as Partial<StaffSessionClaims>),
    ...overrides,
  }, secret);
}

export async function mockRequestWithRole(method: string, path: string, role: string, body?: unknown): Promise<Request> {
  const claims = role === 'customer' ? {} : staffSessionClaims();
  const token = await signToken({ sub: `user-${role}`, role, email: `${role}@test.aura`, ...claims });
  const url = `https://test.aura${path}`;
  const init: RequestInit & { headers: Record<string, string> } = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  };
  if (body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

export function mockRequest(method: string, path: string, body?: unknown, headers?: Record<string, string>): Request {
  const url = `https://test.aura${path}`;
  const init: RequestInit & { headers: Record<string, string> } = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  if (body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

export function mockRequestWithAuth(method: string, path: string, token: string, body?: unknown): Request {
  return mockRequest(method, path, body, { Authorization: `Bearer ${token}` });
}

export function createMockKV(initial?: Record<string, string>): import('@cloudflare/workers-types').KVNamespace {
  const store = new Map<string, { value: string; expires?: number }>();
  if (initial) {
    for (const [k, v] of Object.entries(initial)) {
      store.set(k, { value: v });
    }
  }
  return {
    get: async(key: string, type?: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    return type === 'json' ? JSON.parse(entry.value) : entry.value;
  },
    put: async(key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, { value, expires: opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : undefined });
    },
    delete: async(key: string) => {
      store.delete(key);
    },
    list: async(opts?: { prefix?: string; limit?: number; cursor?: string }) => {
      const entries = Array.from(store.entries())
        .filter(([k]) => !opts?.prefix || k.startsWith(opts.prefix))
        .slice(0, opts?.limit || 1000);
      return {
        keys: entries.map(([name]) => ({ name, expiration: undefined, metadata: undefined })),
        list_complete: true,
        cursor: '',
        ...(opts?.cursor ? { cursor: opts.cursor } : {})
      };
    },
    getWithMetadata: async() => ({ value: null, metadata: null })
  } as unknown as import('@cloudflare/workers-types').KVNamespace;
}

export function createMockDB(users?: Record<string, unknown>[]): import('@cloudflare/workers-types').D1Database {
  const accountRows: Array<Record<string, unknown>> = users ?? [];
  return {
    prepare: (sql: string) => {
      const isAccountLookup = /FROM\s+users/i.test(sql);
      let bound: unknown[] = [];
      const stmt: Record<string, unknown> = {
        _sql: sql,
        _binds: [] as unknown[],
        bind: (...args: unknown[]) => {
          bound = args;
          stmt._binds = args;
          return stmt;
        },
        run: async() => {
          const changes = 1;
          return { success: true, changes, meta: { changes }, lastRowId: accountRows.length + 1 } as unknown as import('@cloudflare/workers-types').D1Result;
        },
        first: async <T = unknown>() => {
          // The staff-session gate reads the account row to decide whether a
          // presented token is still authorised, so an account lookup that
          // resolves to nothing has to answer "row absent" and not "no data".
          if (!isAccountLookup) return null as T | null;
          const id = String(bound[0] ?? '');
          return (accountRows.find(r => String(r.id) === id) ?? null) as T | null;
        },
        all: async <T = unknown>() => {
          return { results: [] as T[], success: true } as import('@cloudflare/workers-types').D1Result<T>;
        },
        raw: async() => []
      };
      return stmt as unknown as import('@cloudflare/workers-types').D1PreparedStatement;
    },
    batch: async(stmts: import('@cloudflare/workers-types').D1PreparedStatement[]) => {
      return stmts.map(() => ({ success: true, changes: 1, meta: { changes: 1 } } as unknown as import('@cloudflare/workers-types').D1Result));
    },
    exec: async() => ({ count: 0, duration: 0 }),
    dump: async() => new Uint8Array()
  } as unknown as import('@cloudflare/workers-types').D1Database;
}

export function createMockEnv(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    AURA_DB: createMockDB(),
    AUTH_KV: createMockKV(),
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_EXPIRY_SECONDS: '3600',
    RESET_KEY: 'test-reset-key',
    TELEGRAM_BOT_TOKEN: undefined,
    TELEGRAM_CHAT_ID: undefined,
    PAYOS_CLIENT_ID: 'test-client-id',
    PAYOS_API_KEY: 'test-api-key',
    PAYOS_CHECKSUM_KEY: 'test-checksum-key',
    FE_BASE_URL: 'https://test.aura',
    ...overrides
  };
}

export function createMockContext(): { waitUntil: (p: Promise<unknown>) => void } {
  return { waitUntil: () => {} };
}

/**
 * Creates a minimal mock D1Database for app-level tests.
 * Non-account queries answer empty; a `users` lookup answers with the staff
 * account row the session gate needs, so an app that exercises a staff route
 * does not have to stub auth state it is not testing.
 */
export function createStubDB(accountRow?: Record<string, unknown>): import('@cloudflare/workers-types').D1Database {
  const row = accountRow ?? { id: 'user-staff', name: 'Staff', phone: null, role: 'staff', tenant_id: 'default', is_active: 1, auth_version: 1 };
  const stmt: any = {
    bind: () => stmt,
    first: async() => ({ ...row }),
    all: async() => ({ results: [], success: true, changes: 0, lastRowId: 0, meta: {} }),
    run: async() => ({ results: [], success: true, changes: 0, lastRowId: 0, meta: {} }),
    raw: async() => []
  };
  const obj: any = {
    prepare: () => stmt,
    batch: async() => [{ success: true, changes: 1 }],
    exec: async() => ({ count: 0, duration: 0 }),
    dump: async() => new Uint8Array()
  };
  return obj as import('@cloudflare/workers-types').D1Database;
}

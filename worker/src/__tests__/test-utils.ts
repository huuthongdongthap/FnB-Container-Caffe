/**
 * Test utilities for worker unit tests.
 * Provides mock Request, Env, DB, KV, and context helpers.
 */

export const TEST_JWT_SECRET = 'test-jwt-secret-at-least-16-chars';

export function mockRequest(method: string, path: string, body?: unknown, headers?: Record<string, string>): Request {
  const url = `https://test.aura${path}`;
  const init: RequestInit & { headers: Record<string, string> } = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
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
    get: async (key: string) => store.get(key)?.value ?? null,
    put: async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, { value, expires: opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : undefined });
    },
    delete: async (key: string) => { store.delete(key); },
    list: async (opts?: { prefix?: string; limit?: number; cursor?: string }) => {
      const entries = Array.from(store.entries())
        .filter(([k]) => !opts?.prefix || k.startsWith(opts.prefix))
        .slice(0, opts?.limit || 1000);
      return {
        keys: entries.map(([name]) => ({ name, expiration: undefined, metadata: undefined })),
        list_complete: true,
        cursor: '',
        ...(opts?.cursor ? { cursor: opts.cursor } : {}),
      };
    },
    getWithMetadata: async () => ({ value: null, metadata: null }),
  } as unknown as import('@cloudflare/workers-types').KVNamespace;
}

export function createMockDB(): import('@cloudflare/workers-types').D1Database {
  const tables = new Map<string, Array<Record<string, unknown>>>();
  return {
    prepare: (sql: string) => {
      const stmt: Record<string, unknown> = {
        _sql: sql,
        _binds: [] as unknown[],
        bind: (...args: unknown[]) => {
          stmt._binds = args;
          return stmt;
        },
        run: async () => {
          const changes = 1;
          return { success: true, changes, lastRowId: tables.size + 1 } as unknown as import('@cloudflare/workers-types').D1Result;
        },
        first: async <T = unknown>() => null as T | null,
        all: async <T = unknown>() => {
          return { results: [] as T[], success: true } as import('@cloudflare/workers-types').D1Result<T>;
        },
        raw: async () => [],
      };
      return stmt as unknown as import('@cloudflare/workers-types').D1PreparedStatement;
    },
    batch: async (stmts: import('@cloudflare/workers-types').D1PreparedStatement[]) => {
      return stmts.map(() => ({ success: true, changes: 1 } as unknown as import('@cloudflare/workers-types').D1Result));
    },
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
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
    ...overrides,
  };
}

export function createMockContext(): { waitUntil: (p: Promise<unknown>) => void } {
  return { waitUntil: () => {} };
}

/**
 * Creates a minimal mock D1 prepared statement for Hono app.fetch().
 * Every method returns itself for chaining.
 * Avoids deeply nested arrow functions that confuse oxc parser.
 */
function makeStubStmt() {
  const fn: any = async () => ({ results: [], success: true, changes: 0, lastRowId: 0, meta: {} });
  const stmt: any = { bind: () => stmt, first: fn, all: fn, run: fn, raw: async () => [] };
  return stmt as import('@cloudflare/workers-types').D1PreparedStatement;
}

/**
 * Creates a minimal mock D1Database for app-level tests.
 * The prepare() always returns a stub statement.
 */
export function createStubDB(): import('@cloudflare/workers-types').D1Database {
  const stmt: any = makeStubStmt();
  const obj: any = {
    prepare: () => stmt,
    batch: async () => [{ success: true, changes: 1 }],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  };
  return obj as import('@cloudflare/workers-types').D1Database;
}

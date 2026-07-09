/** Auth Middleware — loyalty route JWT guard */
import { describe, it, expect, vi } from 'vitest';
import type { MiddlewareHandler } from 'hono';

// Silence logger BEFORE any app imports
vi.mock('../../../middleware/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => ({}) })
}));

// Module-scope mock — captured by vi.mock at definition time.
// Tests call mockVerifyJWT.mockResolvedValue(...) to control behavior.
// The SUT is imported per-test so we can run tests in any order.
const mockVerifyJWT = vi.fn<[string, string], Promise<{ email: string } | null>>();
vi.mock('../../../lib/jwt', () => ({
  verifyJWT: mockVerifyJWT
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetVerifyJWT(): void {
  mockVerifyJWT.mockReset();
}

function setVerifyJWT(payload: { email: string } | null): void {
  mockVerifyJWT.mockResolvedValue(payload);
}

/** Build a Honojs-style context object */
function buildCtx(
  path: string,
  authHeader: string | undefined,
  db: Record<string, unknown>
) {
  const hdrs: Record<string, string | undefined> = {};
  if (authHeader !== undefined) {
    hdrs.authorization = authHeader;
  }

  return {
    req: {
      path: `/api/loyalty${path}`,
      header: (name: string) => hdrs[name.toLowerCase()]
    },
    env: {
      AURA_DB: db as unknown as Record<string, unknown>,
      JWT_SECRET: 'test-jwt-secret-at-least-16-chars'
    },
    set: () => {},
    json: (data: unknown, status = 200) => ({ body: data, status })
  };
}

/** Statement stub with controllable first() result */
function makeStmt(row: Record<string, unknown> | null): Record<string, unknown> {
  return {
    _sql: '',
    _binds: [] as unknown[],
    bind(..._args: unknown[]) {
      return this as never;
    },
    first: async() => row,
    all: async() => ({ results: [] as unknown[], success: true } as never),
    run: async() => ({ success: true, changes: 1 } as never),
    raw: async() => [] as never
  } as never;
}

/** DB stub — captures prepare() SQL and returns the same statement for every call */
function makeDb(row: Record<string, unknown> | null): Record<string, unknown> {
  const stmt = makeStmt(row);
  return {
    prepare: (_sql: string) => {
      (stmt as Record<string, unknown>)._sql = _sql;
      return stmt;
    }
  } as never;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authCustomer', () => {
  let authCustomer: MiddlewareHandler<unknown>;

  beforeAll(async() => {
    const mod = await import('../../../tree/loyalty/auth-middleware');
    authCustomer = (mod as Record<string, unknown>).authCustomer as MiddlewareHandler<unknown>;
  });

  beforeEach(() => {
    resetVerifyJWT();
    setVerifyJWT({ email: 'default@aura.com' });
  });

  // ── Public paths ──────────────────────────────────────────────────────────

  describe.each(['/phone-auth', '/tiers', '/active-campaign', '/lookup'])('%s', (pubPath) => {
    it('skips verifyJWT and calls next()', async() => {
      setVerifyJWT(null); // should NOT be called
      const db = makeDb({ email: 'any@test.com' });
      const c = buildCtx(pubPath, undefined, db);
      const next = vi.fn(async() => {}) as unknown as Promise<void>;

      await authCustomer(c as never, next as never);

      expect(next).toHaveBeenCalled();
      expect(mockVerifyJWT).not.toHaveBeenCalled();
    });
  });

  // ── Auth required — missing header ───────────────────────────────────────

  it('returns 401 "Unauthorized" when no Authorization header', async() => {
    setVerifyJWT({ email: 'x@t.com' });
    const c = buildCtx('/points', undefined, makeDb({ email: 'x@t.com' }));
    const next = vi.fn(async() => {}) as unknown as Promise<void>;

    const result = await authCustomer(c as never, next as never);

    expect((result as { status: number }).status).toBe(401);
    expect((result as { body: { error: string } }).body.error).toBe('Unauthorized');
    expect(mockVerifyJWT).not.toHaveBeenCalled();
  });

  // ── Auth required — non-Bearer header ────────────────────────────────────

  it('returns 401 when Authorization is not Bearer', async() => {
    setVerifyJWT({ email: 'x@t.com' });
    const c = buildCtx('/points', 'Token abc', makeDb({ email: 'x@t.com' }));
    const next = vi.fn(async() => {}) as unknown as Promise<void>;

    const result = await authCustomer(c as never, next as never);
    expect((result as { status: number }).status).toBe(401);
  });

  // ── Auth required — invalid token ────────────────────────────────────────

  it('returns 401 "Token không hợp lệ" when verifyJWT returns null', async() => {
    setVerifyJWT(null);
    const c = buildCtx('/points', 'Bearer bad-token', makeDb(null));
    const next = vi.fn(async() => {}) as unknown as Promise<void>;

    const result = await authCustomer(c as never, next as never);

    expect((result as { status: number }).status).toBe(401);
    expect((result as { body: { error: string } }).body.error).toBe('Token không hợp lệ');
    expect(mockVerifyJWT).toHaveBeenCalledWith('bad-token', 'test-jwt-secret-at-least-16-chars');
  });

  // ── Auth required — valid token → DB lookup ──────────────────────────────

  it('calls verifyJWT with token body and JWT_SECRET', async() => {
    setVerifyJWT({ email: 'test@aura.com' });
    const c = buildCtx('/points', 'Bearer valid-token-here', makeDb({ email: 'test@aura.com' }));
    const next = vi.fn(async() => {}) as unknown as Promise<void>;

    await authCustomer(c as never, next as never);

    expect(mockVerifyJWT).toHaveBeenCalledWith('valid-token-here', 'test-jwt-secret-at-least-16-chars');
  });

  // ── Customer lookup ──────────────────────────────────────────────────────

  it('returns 404 "Customer not found" when DB returns null', async() => {
    setVerifyJWT({ email: 'ghost@test.com' });
    const c = buildCtx('/points', 'Bearer some-jwt', makeDb(null));
    const next = vi.fn(async() => {}) as unknown as Promise<void>;

    const result = await authCustomer(c as never, next as never);

    expect(next).not.toHaveBeenCalled();
    expect((result as { status: number }).status).toBe(404);
    expect((result as { body: { error: string } }).body.error).toBe('Customer not found');
  });

  it('attaches customer and calls next when customer is found', async() => {
    setVerifyJWT({ email: 'found@aura.com' });
    const customerRow = {
      id: 'cust-1', email: 'found@aura.com', name: 'Found User', phone: '0909000000',
      loyalty_points: 500, lifetime_points: 1500, loyalty_tier: 'bronze', created_at: '2026-01-01'
    };
    const setCalls: Array<[string, unknown]> = [];
    const c = {
      ...buildCtx('/points', 'Bearer valid-jwt', makeDb(customerRow)),
      set: (k: string, v: unknown) => {
        setCalls.push([k, v]);
      }
    } as never;
    const next = vi.fn(async() => {}) as unknown as Promise<void>;

    await authCustomer(c as never, next as never);

    expect(next).toHaveBeenCalled();
    expect(setCalls.some(([k]) => k === 'customer')).toBe(true);
  });

  // ── SQL verification ──────────────────────────────────────────────────────

  it('queries customers filtering by email', async() => {
    setVerifyJWT({ email: 'e@t.com' });
    // Custom db that captures the SQL string
    let capturedSql = '';
    const stmt = makeStmt({ id: 'c1', email: 'e@t.com', name: 'N', phone: '0',
      loyalty_points: 0, lifetime_points: 0, loyalty_tier: 'bronze', created_at: '' });
    const db: Record<string, unknown> = {
      prepare: (_sql: string) => {
        capturedSql = _sql;
        return stmt;
      }
    };

    const c = buildCtx('/points', 'Bearer tok', db);
    const next = vi.fn(async() => {}) as unknown as Promise<void>;

    await authCustomer(c as never, next as never);

    expect(capturedSql).toContain('WHERE email = ?');
  });
});

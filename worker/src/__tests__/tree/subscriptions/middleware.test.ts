import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock verifyJWT at its canonical source. Factory returns the mock fn
// so both middleware & any handler that imports from src/lib/jwt receive it.
vi.mock('../../../lib/jwt', () => ({
  verifyJWT: vi.fn(async() => undefined as never),
  generateJWT: vi.fn(async() => ''),
  hashPassword: vi.fn(async() => ''),
  verifyPassword: vi.fn(async() => false),
  getAuthToken: vi.fn(() => null)
}));

import { verifyJWT } from '../../../lib/jwt';
import { requireAdmin, requireVendor } from '../../../tree/subscriptions/middleware';

const JWT_SECRET = 'test-jwt-secret-that-is-over-16-chars-long';

// Cast to the mock instance so we can call .mockResolvedValue / .mockClear each test.
// This matches how the original tests configured per-case mock return values.
const jwtMock = verifyJWT as unknown as {
  mockResolvedValue: (v: { role: string } | null) => void
  mockClear: () => void
};

function setJwt(role: string | null) {
  jwtMock.mockResolvedValue(role ? ({ role } as never) : null);
}

function mkCtx(overrides: { authHeader?: string } = {}): Record<string, unknown> {
  const header = overrides.authHeader;
  return {
    env: { JWT_SECRET },
    req: {
      header: (k: string) => k === 'Authorization' && header ? header : undefined
    },
    json: (_data: unknown, status = 200) => ({ status, body: _data })
  };
}

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jwtMock.mockClear();
    jwtMock.mockResolvedValue({ role: 'owner' });
  });

  it('returns 401 when no Authorization header', async() => {
    jwtMock.mockResolvedValue({ role: 'owner' });
    const res = await requireAdmin(mkCtx({ authHeader: undefined }) as never);
    expect((res as Response).status).toBe(401);
  });

  it('returns 401 when verifyJWT returns null (expired / bad signature)', async() => {
    jwtMock.mockResolvedValue(null);
    const res = await requireAdmin(mkCtx({ authHeader: 'Bearer bad' }) as never);
    expect((res as Response).status).toBe(401);
  });

  it('returns 403 for customer role', async() => {
    jwtMock.mockResolvedValue({ role: 'customer' });
    const res = await requireAdmin(mkCtx({ authHeader: 'Bearer tok' }) as never);
    expect((res as Response).status).toBe(403);
  });

  it('passes through for owner role', async() => {
    jwtMock.mockResolvedValue({ role: 'owner' });
    const res = await requireAdmin(mkCtx({ authHeader: 'Bearer tok' }) as never);
    expect(res).toBeNull();
  });

  it('passes through for admin role', async() => {
    jwtMock.mockResolvedValue({ role: 'admin' });
    const res = await requireAdmin(mkCtx({ authHeader: 'Bearer tok' }) as never);
    expect(res).toBeNull();
  });

  it('passes through for staff role', async() => {
    jwtMock.mockResolvedValue({ role: 'staff' });
    const res = await requireAdmin(mkCtx({ authHeader: 'Bearer tok' }) as never);
    expect(res).toBeNull();
  });
});

describe('requireVendor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jwtMock.mockClear();
    jwtMock.mockResolvedValue({ role: 'owner' });
  });

  it('returns 401 when no Authorization header', async() => {
    jwtMock.mockResolvedValue({ role: 'owner' });
    const res = await requireVendor(mkCtx({ authHeader: undefined }) as never);
    expect((res as Response).status).toBe(401);
  });

  it('returns 401 when verifyJWT returns null', async() => {
    jwtMock.mockResolvedValue(null);
    const res = await requireVendor(mkCtx({ authHeader: 'Bearer bad' }) as never);
    expect((res as Response).status).toBe(401);
  });

  it('passes through for customer role (vendor allowlist includes customer)', async() => {
    jwtMock.mockResolvedValue({ role: 'customer' });
    const res = await requireVendor(mkCtx({ authHeader: 'Bearer tok' }) as never);
    expect(res).toBeNull();
  });

  it('passes through for owner role', async() => {
    jwtMock.mockResolvedValue({ role: 'owner' });
    const res = await requireVendor(mkCtx({ authHeader: 'Bearer tok' }) as never);
    expect(res).toBeNull();
  });

  it('passes through for vendor role', async() => {
    jwtMock.mockResolvedValue({ role: 'vendor' });
    const res = await requireVendor(mkCtx({ authHeader: 'Bearer tok' }) as never);
    expect(res).toBeNull();
  });

  it('passes through for admin role', async() => {
    jwtMock.mockResolvedValue({ role: 'admin' });
    const res = await requireVendor(mkCtx({ authHeader: 'Bearer tok' }) as never);
    expect(res).toBeNull();
  });

  it('returns 403 for unknown role', async() => {
    jwtMock.mockResolvedValue({ role: 'robot' });
    const res = await requireVendor(mkCtx({ authHeader: 'Bearer tok' }) as never);
    expect((res as Response).status).toBe(403);
  });
});

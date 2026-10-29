/**
 * Unit tests for JWT auth middleware.
 */

import { describe, it, expect, vi } from 'vitest';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { TEST_JWT_SECRET, createMockKV, createStubDB, STAFF_ACCOUNT_ROW } from '../test-utils';
import { generateJWT } from '../../lib/jwt';

// The staff-session gate judges a presented token against the account row, so
// every staff token minted here has to have a live row to be judged against.
const staffAccount = { ...STAFF_ACCOUNT_ROW, id: 'USR_2', email: 'staff@b.com', name: 'B', role: 'staff' };

function mockHonoContext(opts: { method?: string; headers?: Record<string, string> } = {}) {
  const raw = new Request('https://test.com', {
    method: opts.method ?? 'GET',
    headers: opts.headers ?? {},
  });
  const ctx = {
    req: { raw, method: raw.method },
    env: {
      AUTH_KV: createMockKV(),
      AURA_DB: createStubDB(staffAccount),
      JWT_SECRET: TEST_JWT_SECRET,
    },
    json: vi.fn().mockReturnValue(new Response('')),
    set: vi.fn(),
    get: vi.fn()
  };
  return ctx as any;
}

function bearerHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function staffToken(): Promise<string> {
  return generateJWT({ email: 'staff@b.com', name: 'B', id: 'USR_2', role: 'staff' , authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web'},
    TEST_JWT_SECRET,
    '3600'
  );
}

describe('requireAuth', () => {
  it('allows request with valid token', async() => {
    const token = await generateJWT(
      { email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' },
      TEST_JWT_SECRET,
      '3600'
    );
    const c = mockHonoContext({ headers: bearerHeaders(token) });
    const next = vi.fn();
    await requireAuth(['customer', 'staff', 'owner'])(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks request without Authorization header', async() => {
    const c = mockHonoContext();
    const next = vi.fn();
    await requireAuth(['customer', 'staff', 'owner'])(c, next);
    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/Unauthorized|vui lòng/) }), 401);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks request with invalid token', async() => {
    const c = mockHonoContext({ headers: bearerHeaders('invalid-token') });
    const next = vi.fn();
    await requireAuth([])(c, next);
    expect(c.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('checks allowed roles', async() => {
    const token = await generateJWT(
      { email: 'b@b.com', name: 'B', id: 'USR_2', role: 'customer' },
      TEST_JWT_SECRET
    );
    const c = mockHonoContext({ headers: bearerHeaders(token) });
    const next = vi.fn();
    await requireAuth(['owner', 'staff'])(c, next);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Không đủ quyền truy cập' }),
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows matching role', async() => {
    const token = await staffToken();
    const c = mockHonoContext({ headers: bearerHeaders(token) });
    const next = vi.fn();
    await requireAuth(['owner', 'staff'])(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks all when allowedRoles array is empty', async() => {
    const token = await generateJWT(
      { email: 'd@d.com', name: 'D', id: 'USR_4', role: 'customer' },
      TEST_JWT_SECRET
    );
    const c = mockHonoContext({ headers: bearerHeaders(token) });
    const next = vi.fn();
    await requireAuth([])(c, next);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Không đủ quyền truy cập' }),
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── CSRF / cookie-auth guards ─────────────────────────────────────────

  it('rejects cookie-auth on POST (CSRF guard)', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'POST',
      headers: { Cookie: `access_token=${token}` },
    });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Yêu cầu thay đổi dữ liệu cần xác thực bằng token' }),
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects cookie-auth on PATCH (CSRF guard)', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'PATCH',
      headers: { Cookie: `access_token=${token}` },
    });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Yêu cầu thay đổi dữ liệu cần xác thực bằng token' }),
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects cookie-auth on PUT (CSRF guard)', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'PUT',
      headers: { Cookie: `access_token=${token}` },
    });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Yêu cầu thay đổi dữ liệu cần xác thực bằng token' }),
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects cookie-auth on DELETE (CSRF guard)', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'DELETE',
      headers: { Cookie: `access_token=${token}` },
    });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Yêu cầu thay đổi dữ liệu cần xác thực bằng token' }),
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows cookie-auth on GET (SSE read)', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'GET',
      headers: { Cookie: `access_token=${token}` },
    });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows cookie-auth on HEAD (read)', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'HEAD',
      headers: { Cookie: `access_token=${token}` },
    });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows cookie-auth on OPTIONS (preflight)', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'OPTIONS',
      headers: { Cookie: `access_token=${token}` },
    });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows Bearer token on POST (normal write)', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'POST',
      headers: bearerHeaders(token),
    });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows query-param token on GET /stream (SSE token parameter)', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'GET',
      headers: {},
    });
    c.req.raw = new Request(`https://test.com/stream?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('ignores the cookie when a Bearer header is also present on a write', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'POST',
      headers: { ...bearerHeaders(token), Cookie: `access_token=${token}` },
    });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('does not reject a read that carries no cookie at all', async() => {
    const c = mockHonoContext({ method: 'GET' });
    const next = vi.fn();
    await requireAuth(['staff', 'owner'])(c, next);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  it('sets the user from a query-param token on GET /stream', async() => {
    const token = await staffToken();
    const c = mockHonoContext({ method: 'GET' });
    c.req.raw = new Request(`https://test.com/stream?token=${encodeURIComponent(token)}`);
    const next = vi.fn();
    await optionalAuth()(c, next);
    expect(c.set).toHaveBeenCalledWith('user', expect.objectContaining({ id: 'USR_2', role: 'staff' }));
    expect(next).toHaveBeenCalled();
  });

  it('rejects cookie-only writes rather than silently turning Staff into a guest', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'POST',
      headers: { Cookie: `access_token=${token}` },
    });
    const next = vi.fn();
    await optionalAuth()(c, next);
    expect(c.set).not.toHaveBeenCalledWith('user', expect.anything());
    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }), 403);
    expect(next).not.toHaveBeenCalled();
  });

  it('still sets the user from a cookie on GET, because SSE reads need it', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'GET',
      headers: { Cookie: `access_token=${token}` },
    });
    const next = vi.fn();
    await optionalAuth()(c, next);
    expect(c.set).toHaveBeenCalledWith('user', expect.objectContaining({ id: 'USR_2', role: 'staff' }));
    expect(next).toHaveBeenCalled();
  });

  it('sets the user from a Bearer header on a write', async() => {
    const token = await staffToken();
    const c = mockHonoContext({
      method: 'POST',
      headers: bearerHeaders(token),
    });
    const next = vi.fn();
    await optionalAuth()(c, next);
    expect(c.set).toHaveBeenCalledWith('user', expect.objectContaining({ id: 'USR_2', role: 'staff' }));
    expect(next).toHaveBeenCalled();
  });

  it('stays a guest when no credential is present', async() => {
    const c = mockHonoContext({ method: 'GET' });
    const next = vi.fn();
    await optionalAuth()(c, next);
    expect(c.set).not.toHaveBeenCalledWith('user', expect.anything());
    expect(next).toHaveBeenCalled();
  });
});

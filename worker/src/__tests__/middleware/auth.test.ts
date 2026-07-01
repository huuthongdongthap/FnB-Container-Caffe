/**
 * Unit tests for JWT auth middleware.
 */

import { describe, it, expect, vi } from 'vitest';
import { requireAuth } from '../../middleware/auth';
import { TEST_JWT_SECRET, createMockKV } from '../test-utils';
import { generateJWT } from '../../lib/jwt';

function mockHonoContext(token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const raw = new Request('https://test.com', { headers });
  const ctx = {
    req: { raw },
    env: { AUTH_KV: createMockKV(), JWT_SECRET: TEST_JWT_SECRET },
    json: vi.fn().mockReturnValue(new Response('')),
    set: vi.fn(),
    get: vi.fn(),
  };
  return ctx as any;
}

describe('requireAuth', () => {
  it('allows request with valid token', async () => {
    const token = await generateJWT(
      { email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' },
      TEST_JWT_SECRET,
      '3600'
    );
    const c = mockHonoContext(token);
    const next = vi.fn();
    await requireAuth(['customer', 'staff', 'owner'])(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks request without Authorization header', async () => {
    const c = mockHonoContext();
    const next = vi.fn();
    await requireAuth(['customer', 'staff', 'owner'])(c, next);
    expect(c.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/Unauthorized|vui lòng/) }), 401);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks request with invalid token', async () => {
    const c = mockHonoContext('invalid-token');
    const next = vi.fn();
    await requireAuth([])(c, next);
    expect(c.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('checks allowed roles', async () => {
    const token = await generateJWT(
      { email: 'b@b.com', name: 'B', id: 'USR_2', role: 'customer' },
      TEST_JWT_SECRET
    );
    const c = mockHonoContext(token);
    const next = vi.fn();
    await requireAuth(['owner', 'staff'])(c, next);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Không đủ quyền truy cập' }),
      403
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows matching role', async () => {
    const token = await generateJWT(
      { email: 'c@c.com', name: 'C', id: 'USR_3', role: 'staff' },
      TEST_JWT_SECRET
    );
    const c = mockHonoContext(token);
    const next = vi.fn();
    await requireAuth(['owner', 'staff'])(c, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks all when allowedRoles array is empty', async () => {
    const token = await generateJWT(
      { email: 'd@d.com', name: 'D', id: 'USR_4', role: 'customer' },
      TEST_JWT_SECRET
    );
    const c = mockHonoContext(token);
    const next = vi.fn();
    await requireAuth([])(c, next);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Không đủ quyền truy cập' }),
      403
    );
    expect(next).not.toHaveBeenCalled();
  });
});

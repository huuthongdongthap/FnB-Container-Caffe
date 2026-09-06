/**
 * Unit tests for tenant middleware — tenant identity must come only
 * from the verified JWT, never from client-supplied headers.
 */

import { describe, it, expect, vi } from 'vitest';
import { tenantMiddleware } from '../../middleware/tenant';

interface MockUser {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
}

function mockContext(user?: MockUser, spoofedHeader?: string) {
  const headers: Record<string, string> = {};
  if (spoofedHeader) {
    headers['X-Tenant-Id'] = spoofedHeader;
  }
  const raw = new Request('https://test.com/api/saas/tenants/my', { headers });
  return {
    req: { raw, header: (k: string) => headers[k] },
    set: vi.fn(),
    get: vi.fn((key: string) => (key === 'user' ? user : undefined))
  } as any;
}

describe('tenantMiddleware', () => {
  it('resolves tenantId from authenticated JWT payload', async() => {
    const c = mockContext({ id: 'USR_1', email: 'a@b.com', role: 'owner', tenantId: 'tenant_owner' });
    await tenantMiddleware(c, vi.fn());
    expect(c.set).toHaveBeenCalledWith('tenantId', 'tenant_owner');
  });

  it('ignores spoofed X-Tenant-Id header for authenticated user', async() => {
    // User owns tenant_A but sends header claiming tenant_B — must still resolve tenant_A.
    const c = mockContext(
      { id: 'USR_1', email: 'a@b.com', role: 'owner', tenantId: 'tenant_A' },
      'tenant_B'
    );
    await tenantMiddleware(c, vi.fn());
    expect(c.set).toHaveBeenCalledWith('tenantId', 'tenant_A');
  });

  it('falls back to default when authenticated user lacks tenant binding', async() => {
    // Staff tokens carry no tenantId — resolves to shared default scope.
    const c = mockContext({ id: 'USR_2', email: 's@b.com', role: 'staff' }, 'tenant_B');
    await tenantMiddleware(c, vi.fn());
    expect(c.set).toHaveBeenCalledWith('tenantId', 'default');
  });

  it('defaults when no user is present on context', async() => {
    const c = mockContext(undefined, 'tenant_B');
    await tenantMiddleware(c, vi.fn());
    expect(c.set).toHaveBeenCalledWith('tenantId', 'default');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TenantCreatePage from '../onboard/tenant-create';
import { readClientSession, saveClientSession } from '@/lib/client-session';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe('TenantCreatePage self-serve session refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      user: {
        id: 'founder_1',
        name: 'Founder One',
        email: 'founder@example.com',
        role: 'customer',
        tenantId: 'default',
      },
      sessionVersion: 1,
      loading: false,
      error: null,
    });
    saveClientSession('old_customer_token', {
      id: 'founder_1',
      name: 'Founder One',
      email: 'founder@example.com',
      role: 'customer',
      tenantId: 'default',
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('persists refreshed owner token and user into client session and auth store after self-serve provisioning', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      token: 'new_owner_jwt_token',
      user: {
        id: 'founder_1',
        name: 'Founder One',
        email: 'founder@example.com',
        phone: '0909123456',
        role: 'owner',
        tenantId: 'tenant_new_123',
      },
      data: {
        id: 'tenant_new_123',
        slug: 'aura-sadec',
        token: 'new_owner_jwt_token',
      },
    });

    const preSubmitVersion = useAuthStore.getState().sessionVersion;

    render(<TenantCreatePage />);
    fireEvent.change(screen.getByPlaceholderText(/Business name/i), {
      target: { value: 'AURA Sa Dec' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /Tạo Workspace/i }).closest('form')!);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/saas/tenants/self-serve', {
        method: 'POST',
        body: JSON.stringify({ name: 'AURA Sa Dec' }),
      });
      expect(screen.getByText(/Workspace đã được tạo/i)).toBeTruthy();
    });

    const session = readClientSession();
    expect(session.token).toBe('new_owner_jwt_token');
    expect(session.user?.role).toBe('owner');
    expect(session.user?.tenantId).toBe('tenant_new_123');

    const storeState = useAuthStore.getState();
    expect(storeState.user?.role).toBe('owner');
    expect(storeState.user?.tenantId).toBe('tenant_new_123');
    expect(storeState.sessionVersion).toBeGreaterThan(preSubmitVersion);
    expect(localStorage.getItem('aura_tenant_id')).toBe('tenant_new_123');
  });

  it('keeps existing HQ session intact when self-serve returns null token and user', async () => {
    saveClientSession('hq_session_token', {
      id: 'hq_1',
      name: 'HQ Boss',
      email: 'hq@example.com',
      role: 'admin',
      tenantId: 'hq',
    });
    useAuthStore.setState({
      user: {
        id: 'hq_1',
        name: 'HQ Boss',
        email: 'hq@example.com',
        role: 'admin',
        tenantId: 'hq',
      },
      sessionVersion: 3,
      loading: false,
      error: null,
    });

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      token: null,
      user: null,
      data: {
        id: 'tenant_hq_created_456',
        slug: 'hq-store',
        token: null,
        user: null,
      },
    });

    render(<TenantCreatePage />);
    fireEvent.change(screen.getByPlaceholderText(/Business name/i), {
      target: { value: 'HQ Store' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /Tạo Workspace/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Workspace đã được tạo/i)).toBeTruthy();
    });

    const session = readClientSession();
    expect(session.token).toBe('hq_session_token');
    expect(session.user?.tenantId).toBe('hq');
    expect(useAuthStore.getState().user?.role).toBe('admin');
    expect(useAuthStore.getState().sessionVersion).toBe(3);
  });
});

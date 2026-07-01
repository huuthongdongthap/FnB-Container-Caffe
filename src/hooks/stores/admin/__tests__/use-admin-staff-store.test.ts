import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

function setAuthenticated() {
  useAuthStore.setState({
    token: 'valid-token',
    user: { id: '1', name: 'Admin', email: 'admin@aura.vn', role: 'owner' },
  });
}

function setUnauthenticated() {
  useAuthStore.setState({ token: null, user: null });
}

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe('useAdminStaffStore', () => {
  beforeEach(() => {
    useAdminStaffStore.setState({ staff: [], loading: false, error: null });
    setUnauthenticated();
    vi.restoreAllMocks();
  });

  it('starts with empty staff, loading=false, error=null', () => {
    const s = useAdminStaffStore.getState();
    expect(s.staff).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchStaff(): populates staff on success', async () => {
    setAuthenticated();
    const fakeStaff = [
      { id: 'S001', name: 'Nguyen Van A', role: 'Quản lý', phone: '0901234567', email: 'a@aura.vn', isActive: true, startedAt: '2024-01-15' },
    ];
    mockFetch(200, fakeStaff);

    await useAdminStaffStore.getState().fetchStaff();

    const s = useAdminStaffStore.getState();
    expect(s.staff).toEqual(fakeStaff);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchStaff(): sets error when no token', async () => {
    await useAdminStaffStore.getState().fetchStaff();

    expect(useAdminStaffStore.getState().error).toContain('Chưa đăng nhập');
  });

  it('registerStaff(): posts to register-staff endpoint', async () => {
    setAuthenticated();
    let posted = false;
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST' && url.includes('/api/auth/register-staff')) {
        posted = true;
        const body = JSON.parse(opts.body as string);
        expect(body.name).toBe('New Staff');
        expect(body.email).toBe('new@aura.vn');
        return Promise.resolve({
          ok: true, status: 201,
          json: () => Promise.resolve({ success: true, user: { id: 'S005', name: 'New Staff', role: 'Pha chế', phone: '0909999999', email: 'new@aura.vn', isActive: true, startedAt: '2026-07-01' } }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    await useAdminStaffStore.getState().registerStaff({
      name: 'New Staff',
      role: 'Pha chế',
      phone: '0909999999',
      email: 'new@aura.vn',
      password: 'password123',
    });

    expect(posted).toBe(true);
  });

  it('registerStaff(): sets error on 403', async () => {
    setAuthenticated();
    mockFetch(403, { message: 'Only owner can register staff' });

    await useAdminStaffStore.getState().registerStaff({
      name: 'New', role: 'Pha chế', phone: '0900000000', email: 'new@aura.vn', password: 'pw',
    });

    expect(useAdminStaffStore.getState().error).toContain('Only owner');
  });

  it('fetchStaff(): sets error on network failure', async () => {
    setAuthenticated();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useAdminStaffStore.getState().fetchStaff();

    expect(useAdminStaffStore.getState().error).toContain('Network');
  });
});

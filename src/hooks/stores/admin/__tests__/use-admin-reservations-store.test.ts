import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminReservationsStore } from '@/hooks/stores/admin/use-admin-reservations-store';
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

describe('useAdminReservationsStore', () => {
  beforeEach(() => {
    useAdminReservationsStore.setState({ reservations: [], loading: false, error: null });
    setUnauthenticated();
    vi.restoreAllMocks();
  });

  it('starts with empty reservations, loading=false, error=null', () => {
    const s = useAdminReservationsStore.getState();
    expect(s.reservations).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchReservations(): populates reservations on success', async () => {
    setAuthenticated();
    const fakeReservations = [
      { id: 'R001', customerName: 'Nguyen Van A', customerPhone: '0901234567', tableNumber: 'B01', zone: 'VIP', date: '2026-07-05', time: '19:00', guests: 4, status: 'confirmed' as const, createdAt: '2026-07-01T08:00:00Z' },
    ];
    mockFetch(200, { reservations: fakeReservations });

    await useAdminReservationsStore.getState().fetchReservations();

    const s = useAdminReservationsStore.getState();
    expect(s.reservations).toEqual(fakeReservations);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchReservations(): sets error when no token', async () => {
    await useAdminReservationsStore.getState().fetchReservations();

    expect(useAdminReservationsStore.getState().error).toContain('Chưa đăng nhập');
  });

  it('approveReservation(): calls approve endpoint', async () => {
    setAuthenticated();
    let approveCalled = false;
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (opts?.method === 'PATCH' && url.includes('/api/admin/reservations/R001/approve')) {
        approveCalled = true;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ reservations: [], totalCount: 0 }) });
    }));

    await useAdminReservationsStore.getState().approveReservation('R001');

    expect(approveCalled).toBe(true);
  });

  it('rejectReservation(): calls reject endpoint', async () => {
    setAuthenticated();
    let rejectCalled = false;
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (opts?.method === 'PATCH' && url.includes('/api/admin/reservations/R001/reject')) {
        rejectCalled = true;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ reservations: [], totalCount: 0 }) });
    }));

    await useAdminReservationsStore.getState().rejectReservation('R001');

    expect(rejectCalled).toBe(true);
  });

  it('approveReservation(): handles 403 gracefully', async () => {
    setAuthenticated();
    mockFetch(403, { message: 'Forbidden' });

    await useAdminReservationsStore.getState().approveReservation('R001');

    expect(useAdminReservationsStore.getState().error).toContain('Forbidden');
  });
});

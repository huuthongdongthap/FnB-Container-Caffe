import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminReservationsStore } from '@/hooks/stores/admin/use-admin-reservations-store';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function mockSuccess(data: unknown) {
  mockApiFetch.mockResolvedValue(data);
}

function mockError(message: string) {
  mockApiFetch.mockRejectedValue(new Error(message));
}

describe('useAdminReservationsStore', () => {
  beforeEach(() => {
    useAdminReservationsStore.setState({ reservations: [], loading: false, error: null, offset: 0, filters: {}, hasNext: false });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
  });

  it('starts with empty reservations, loading=false, error=null', () => {
    const s = useAdminReservationsStore.getState();
    expect(s.reservations).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchReservations(): populates reservations on success', async () => {
    const fakeReservations = [
      { id: 'R001', customerName: 'Nguyen Van A', customerPhone: '0901234567', tableNumber: 'B01', zone: 'VIP', date: '2026-07-05', time: '19:00', guests: 4, status: 'confirmed' as const, createdAt: '2026-07-01T08:00:00Z' },
    ];
    mockSuccess({ reservations: fakeReservations });

    await useAdminReservationsStore.getState().fetchReservations();

    const s = useAdminReservationsStore.getState();
    expect(s.reservations).toEqual(fakeReservations);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchReservations(): normalizes D1 snake_case rows from /api/reservations', async () => {
    mockSuccess({
      success: true,
      data: [
        {
          id: 'rsv_1',
          customer_name: 'Hoang E',
          customer_phone: '0987654321',
          table_number: 'T05',
          table_zone: 'Outdoor',
          date: '2026-10-15',
          time: '18:30',
          guest_count: 6,
          status: 'pending',
          created_at: '2026-10-14T15:00:00Z',
        },
      ],
    });

    await useAdminReservationsStore.getState().fetchReservations();

    const s = useAdminReservationsStore.getState();
    expect(s.reservations[0]).toMatchObject({
      id: 'rsv_1',
      customerName: 'Hoang E',
      customerPhone: '0987654321',
      tableNumber: 'T05',
      zone: 'Outdoor',
      date: '2026-10-15',
      time: '18:30',
      guests: 6,
      status: 'pending',
      createdAt: '2026-10-14T15:00:00Z',
    });
  });

  it('fetchReservations(): sets error on failure', async () => {
    mockError('Không thể tải danh sách đặt bàn');

    await useAdminReservationsStore.getState().fetchReservations();

    expect(useAdminReservationsStore.getState().error).toContain('Không thể tải danh sách đặt bàn');
  });

  it('approveReservation(): calls apiFetch with PATCH', async () => {
    mockSuccess({});
    mockSuccess({ reservations: [] });

    await useAdminReservationsStore.getState().approveReservation('R001');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/reservations/R001/approve', {
      method: 'PATCH',
    });
  });

  it('rejectReservation(): calls apiFetch with PATCH', async () => {
    mockSuccess({});
    mockSuccess({ reservations: [] });

    await useAdminReservationsStore.getState().rejectReservation('R001');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/admin/reservations/R001/reject', {
      method: 'PATCH',
    });
  });
  it('paginates past fifty records and sends date/status filters to the server', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({ id: `r${i}`, status: 'confirmed' }));
    mockApiFetch.mockImplementation(async (url: string) => {
      const offset = Number(new URL(url, 'https://example.test').searchParams.get('offset'));
      return { success: true, data: rows.slice(offset, offset + 50) };
    });
    await useAdminReservationsStore.getState().fetchReservations({ offset: 0, date: '2026-12-01', status: 'confirmed' });
    expect(useAdminReservationsStore.getState().hasNext).toBe(true);
    await useAdminReservationsStore.getState().fetchReservations({ offset: 50, date: '2026-12-01', status: 'confirmed' });
    expect(mockApiFetch).toHaveBeenLastCalledWith('/api/reservations?limit=50&offset=50&date=2026-12-01&status=confirmed');
    expect(useAdminReservationsStore.getState().reservations[0]?.id).toBe('r50');
    expect(useAdminReservationsStore.getState().hasNext).toBe(false);
  });

  it.each(['seated', 'completed', 'cancelled'])('uses the existing lifecycle API for %s', async status => {
    mockApiFetch.mockResolvedValue({ success: true, data: [] });
    expect(await useAdminReservationsStore.getState().changeStatus('confirmed-id', status)).toBe(true);
    expect(mockApiFetch).toHaveBeenCalledWith(`/api/reservations/confirmed-id/${status === 'cancelled' ? 'cancel' : 'status'}`, {
      method: status === 'cancelled' ? 'POST' : 'PATCH', ...(status === 'cancelled' ? {} : { body: JSON.stringify({ status }) }),
    });
  });

  it('keeps the saved row and reports insufficient permissions without refetching', async () => {
    mockApiFetch.mockRejectedValue(new Error('Insufficient permissions'));
    expect(await useAdminReservationsStore.getState().changeStatus('r1', 'completed')).toBe(false);
    expect(useAdminReservationsStore.getState().error).toBe('Insufficient permissions');
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });

});

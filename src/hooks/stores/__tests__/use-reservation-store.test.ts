import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useReservationStore } from '@/hooks/stores/use-reservation-store';

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

describe('useReservationStore', () => {
  beforeEach(() => {
    useReservationStore.setState({
      availableSlots: [],
      tables: [],
      currentReservation: null,
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
  });

  /* ── Initial state ── */
  it('starts with empty slots, tables, null reservation, and loading=false', () => {
    const s = useReservationStore.getState();
    expect(s.availableSlots).toEqual([]);
    expect(s.tables).toEqual([]);
    expect(s.currentReservation).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  /* ── fetchSlots ── */
  it('fetchSlots(): populates slots and tables from API', async () => {
    const fakeSlots = [
      { time: '07:00', available: true },
      { time: '08:00', available: false },
    ];
    const fakeTables = [
      { id: 't1', table_number: 'A1', zone: 'VIP', available: true },
    ];
    mockSuccess({ success: true, data: { slots: fakeSlots, tables: fakeTables } });

    await useReservationStore.getState().fetchSlots('2026-07-15', '19:00');

    const s = useReservationStore.getState();
    expect(s.availableSlots).toEqual(fakeSlots);
    expect(s.tables).toEqual(fakeTables);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchSlots(): sets error on API failure', async () => {
    mockError('Server error');

    await useReservationStore.getState().fetchSlots('2026-07-15', '19:00');

    expect(useReservationStore.getState().error).toBeTruthy();
    expect(useReservationStore.getState().loading).toBe(false);
  });

  it('fetchSlots(): calls apiFetch with correct path', async () => {
    mockSuccess({ data: { slots: [], tables: [] } });

    await useReservationStore.getState().fetchSlots('2026-07-15', '19:00');

    const calledUrl = mockApiFetch.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/\/api\/reservations\/availability\?date=2026-07-15&time=19/);
  });

  /* ── createReservation ── */
  it('createReservation(): returns reservation ID on success', async () => {
    mockSuccess({ data: { id: 'res-123', table_number: 'A1' } });

    const result = await useReservationStore.getState().createReservation({
      table_id: 't1',
      customer_name: 'Nguyen Van A',
      customer_phone: '0901234567',
      guest_count: 4,
      date: '2026-07-15',
      time: '19:00',
    });

    expect(result).toEqual({ id: 'res-123', table_number: 'A1' });
    expect(useReservationStore.getState().loading).toBe(false);
  });

  it('createReservation(): returns null on failure', async () => {
    mockError('Table not available');

    const result = await useReservationStore.getState().createReservation({
      table_id: 't1',
      customer_name: 'Nguyen Van A',
      customer_phone: '0901234567',
      guest_count: 4,
      date: '2026-07-15',
      time: '19:00',
    });

    expect(result).toBeNull();
    expect(useReservationStore.getState().error).toBeTruthy();
  });

  it('createReservation(): calls apiFetch with POST', async () => {
    mockSuccess({ data: { id: 'res-123' } });

    await useReservationStore.getState().createReservation({
      table_id: 't1',
      customer_name: 'Name',
      customer_phone: '0901234567',
      guest_count: 2,
      date: '2026-07-15',
      time: '19:00',
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/reservations', {
      method: 'POST',
      body: expect.any(String),
    });
  });

  it('clearError(): clears error state', () => {
    useReservationStore.setState({ error: 'test error' });
    useReservationStore.getState().clearError();
    expect(useReservationStore.getState().error).toBeNull();
  });

  it('reset(): clears all state', () => {
    useReservationStore.setState({
      availableSlots: [{ time: '07:00', available: true }],
      currentReservation: { id: 'res-1' },
    });
    useReservationStore.getState().reset();
    const s = useReservationStore.getState();
    expect(s.availableSlots).toEqual([]);
    expect(s.currentReservation).toBeNull();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useReservationStore } from '@/hooks/stores/use-reservation-store';

const API_BASE = 'https://aura-space-worker.agencyos-openclaw.workers.dev';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
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
    mockFetch(200, { success: true, data: { slots: fakeSlots, tables: fakeTables } });

    await useReservationStore.getState().fetchSlots('2026-07-15', '19:00');

    const s = useReservationStore.getState();
    expect(s.availableSlots).toEqual(fakeSlots);
    expect(s.tables).toEqual(fakeTables);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchSlots(): sets error on API failure', async () => {
    mockFetch(500, { message: 'Server error' });

    await useReservationStore.getState().fetchSlots('2026-07-15', '19:00');

    const s = useReservationStore.getState();
    expect(s.availableSlots).toEqual([]);
    expect(s.error).toContain('Server error');
    expect(s.loading).toBe(false);
  });

  it('fetchSlots(): sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useReservationStore.getState().fetchSlots('2026-07-15', '19:00');

    expect(useReservationStore.getState().error).toContain('Network');
  });

  /* ── createReservation ── */
  it('createReservation(): sets currentReservation on success', async () => {
    mockFetch(201, { success: true, data: { id: 'res-123' } });

    await useReservationStore.getState().createReservation({
      table_id: 't1',
      customer_name: 'Test',
      customer_phone: '0901234567',
      guest_count: 2,
      date: '2026-07-15',
      time: '19:00',
    });

    const s = useReservationStore.getState();
    expect(s.currentReservation).toEqual({ id: 'res-123' });
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('createReservation(): sets error when slot already taken', async () => {
    mockFetch(409, { message: 'Time slot already booked' });

    const result = await useReservationStore.getState().createReservation({
      table_id: 't1',
      customer_name: 'Test',
      customer_phone: '0901234567',
      guest_count: 2,
      date: '2026-07-15',
      time: '19:00',
    });

    expect(result).toBeNull();
    expect(useReservationStore.getState().error).toContain('already booked');
  });

  it('createReservation(): sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useReservationStore.getState().createReservation({
      table_id: 't1',
      customer_name: 'Test',
      customer_phone: '0901234567',
      guest_count: 2,
      date: '2026-07-15',
      time: '19:00',
    });

    expect(useReservationStore.getState().error).toContain('Network');
  });

  /* ── clearError ── */
  it('clearError(): resets error to null', () => {
    useReservationStore.setState({ error: 'Some error' });
    useReservationStore.getState().clearError();
    expect(useReservationStore.getState().error).toBeNull();
  });

  /* ── reset ── */
  it('reset(): clears all state back to initial', () => {
    useReservationStore.setState({
      availableSlots: [{ time: '07:00', available: true }],
      tables: [{ id: 't1', table_number: 'A1', zone: 'VIP', available: true }],
      currentReservation: { id: 'res-123' },
      error: 'some error',
    });

    useReservationStore.getState().reset();

    const s = useReservationStore.getState();
    expect(s.availableSlots).toEqual([]);
    expect(s.tables).toEqual([]);
    expect(s.currentReservation).toBeNull();
    expect(s.error).toBeNull();
  });
});

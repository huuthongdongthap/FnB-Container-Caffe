import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCheckinStore } from '@/hooks/stores/use-checkin-store';

const API_BASE = 'https://aura-space-worker.agencyos-openclaw.workers.dev';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe('useCheckinStore', () => {
  beforeEach(() => {
    useCheckinStore.setState({
      checkinResult: null,
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  /* ── Initial state ── */
  it('starts with null result, loading=false, error=null', () => {
    const s = useCheckinStore.getState();
    expect(s.checkinResult).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  /* ── submitCheckin ── */
  it('submitCheckin(): returns points earned on success', async () => {
    mockFetch(200, { success: true, data: { points: 20, reward: '20.000đ cashback' } });

    await useCheckinStore.getState().submitCheckin('0901234567');

    const s = useCheckinStore.getState();
    expect(s.checkinResult).toEqual({ points: 20, reward: '20.000đ cashback' });
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('submitCheckin(): sets error on invalid phone format', async () => {
    await useCheckinStore.getState().submitCheckin('123');

    const s = useCheckinStore.getState();
    expect(s.checkinResult).toBeNull();
    expect(s.error).toContain('không hợp lệ');
    expect(s.loading).toBe(false);
  });

  it('submitCheckin(): sets error on API failure', async () => {
    mockFetch(400, { message: 'Already checked in this month' });

    await useCheckinStore.getState().submitCheckin('0901234567');

    expect(useCheckinStore.getState().error).toContain('Already checked in');
  });

  it('submitCheckin(): sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useCheckinStore.getState().submitCheckin('0901234567');

    expect(useCheckinStore.getState().error).toContain('Network');
  });

  /* ── clearError ── */
  it('clearError(): resets error to null', () => {
    useCheckinStore.setState({ error: 'Some error' });
    useCheckinStore.getState().clearError();
    expect(useCheckinStore.getState().error).toBeNull();
  });

  /* ── reset ── */
  it('reset(): clears result, error, loading', () => {
    useCheckinStore.setState({
      checkinResult: { points: 20, reward: 'test' },
      error: 'some error',
      loading: true,
    });

    useCheckinStore.getState().reset();

    const s = useCheckinStore.getState();
    expect(s.checkinResult).toBeNull();
    expect(s.error).toBeNull();
    expect(s.loading).toBe(false);
  });
});

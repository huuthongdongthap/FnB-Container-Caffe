import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCheckinStore } from '@/hooks/stores/use-checkin-store';

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

describe('useCheckinStore', () => {
  beforeEach(() => {
    useCheckinStore.setState({
      checkinResult: null,
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
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
    mockSuccess({ success: true, data: { points: 20, reward: '20.000d cashback' } });

    await useCheckinStore.getState().submitCheckin('0901234567');

    const s = useCheckinStore.getState();
    expect(s.checkinResult).toEqual({ points: 20, reward: '20.000d cashback' });
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('submitCheckin(): sets error on invalid phone format', async () => {
    await useCheckinStore.getState().submitCheckin('123');

    const s = useCheckinStore.getState();
    expect(s.checkinResult).toBeNull();
    expect(s.error).toContain('hợp lệ');
    expect(s.loading).toBe(false);
  });

  it('submitCheckin(): sets error on API failure', async () => {
    mockError('Already checked in this month');

    await useCheckinStore.getState().submitCheckin('0901234567');

    expect(useCheckinStore.getState().error).toBeTruthy();
    expect(useCheckinStore.getState().loading).toBe(false);
  });

  it('submitCheckin(): calls apiFetch with POST', async () => {
    mockSuccess({ success: true, data: { points: 10, reward: 'ok' } });

    await useCheckinStore.getState().submitCheckin('0912345678');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/loyalty/checkin', {
      method: 'POST',
      body: JSON.stringify({ phone: '0912345678' }),
    });
  });

  it('clearError(): clears error state', () => {
    useCheckinStore.setState({ error: 'test error' });
    useCheckinStore.getState().clearError();
    expect(useCheckinStore.getState().error).toBeNull();
  });

  it('reset(): clears all state', () => {
    useCheckinStore.setState({
      checkinResult: { points: 10, reward: 'test' },
      error: 'test',
    });
    useCheckinStore.getState().reset();
    const s = useCheckinStore.getState();
    expect(s.checkinResult).toBeNull();
    expect(s.error).toBeNull();
  });
});

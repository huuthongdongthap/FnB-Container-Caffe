import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useContactStore } from '@/hooks/stores/use-contact-store';

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

describe('useContactStore', () => {
  beforeEach(() => {
    useContactStore.setState({
      submitted: false,
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
    mockApiFetch.mockReset();
  });

  /* ── Initial state ── */
  it('starts with submitted=false, loading=false, error=null', () => {
    const s = useContactStore.getState();
    expect(s.submitted).toBe(false);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  /* ── submitContact ── */
  it('submitContact(): sets submitted=true on success', async () => {
    mockSuccess({ success: true });

    await useContactStore.getState().submitContact('Nguyen Van A', '0901234567', 'Test message', 'a@example.com');

    const s = useContactStore.getState();
    expect(s.submitted).toBe(true);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('submitContact(): sets error on validation failure', async () => {
    await useContactStore.getState().submitContact('', '', '', '');

    const s = useContactStore.getState();
    expect(s.submitted).toBe(false);
    expect(s.error).toBeTruthy();
    expect(s.loading).toBe(false);
  });

  it('submitContact(): sets error on network failure', async () => {
    mockError('Network error');

    await useContactStore.getState().submitContact('Name', '0901234567', 'Hello');

    expect(useContactStore.getState().error).toBeTruthy();
    expect(useContactStore.getState().loading).toBe(false);
  });

  it('submitContact(): calls apiFetch with POST', async () => {
    mockSuccess({ success: true });

    await useContactStore.getState().submitContact('Name', '0901234567', 'Hello', 'a@example.com');

    expect(mockApiFetch).toHaveBeenCalledWith('/api/contact', {
      method: 'POST',
      body: expect.any(String),
    });
  });

  it('clearError(): clears error state', () => {
    useContactStore.setState({ error: 'test error' });
    useContactStore.getState().clearError();
    expect(useContactStore.getState().error).toBeNull();
  });

  it('reset(): clears all state', () => {
    useContactStore.setState({ submitted: true, error: 'test' });
    useContactStore.getState().reset();
    const s = useContactStore.getState();
    expect(s.submitted).toBe(false);
    expect(s.error).toBeNull();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useContactStore } from '@/hooks/stores/use-contact-store';

const API_BASE = 'https://aura-space-worker.agencyos-openclaw.workers.dev';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe('useContactStore', () => {
  beforeEach(() => {
    useContactStore.setState({
      submitted: false,
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
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
    mockFetch(200, { success: true });

    await useContactStore.getState().submitContact('Nguyen Van A', 'a@example.com', '0901234567', 'Test message');

    const s = useContactStore.getState();
    expect(s.submitted).toBe(true);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('submitContact(): sets error on validation failure', async () => {
    mockFetch(400, { message: 'Tên không được để trống' });

    await useContactStore.getState().submitContact('', 'invalid-email', '', '');

    const s = useContactStore.getState();
    expect(s.submitted).toBe(false);
    expect(s.error).toBeTruthy();
    expect(s.loading).toBe(false);
  });

  it('submitContact(): sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useContactStore.getState().submitContact('Name', 'a@b.com', '0901234567', 'Message');

    expect(useContactStore.getState().error).toContain('Network');
  });

  it('submitContact(): requires minimum fields (name, phone, message)', async () => {
    // Should validate required fields client-side before API call
    await useContactStore.getState().submitContact('', '', '', '');

    const s = useContactStore.getState();
    expect(s.submitted).toBe(false);
    expect(s.error).toBeTruthy();
  });

  /* ── clearError ── */
  it('clearError(): resets error to null', () => {
    useContactStore.setState({ error: 'Some error' });
    useContactStore.getState().clearError();
    expect(useContactStore.getState().error).toBeNull();
  });

  /* ── reset ── */
  it('reset(): clears submitted, error, loading', () => {
    useContactStore.setState({
      submitted: true,
      error: 'some error',
      loading: true,
    });

    useContactStore.getState().reset();

    const s = useContactStore.getState();
    expect(s.submitted).toBe(false);
    expect(s.error).toBeNull();
    expect(s.loading).toBe(false);
  });
});

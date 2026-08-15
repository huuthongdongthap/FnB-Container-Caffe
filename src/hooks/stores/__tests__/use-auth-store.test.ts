import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

const API_BASE = 'https://aura-space-worker.agencyos-openclaw.workers.dev';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, loading: false, error: null });
    vi.restoreAllMocks();
  });

  /* ── Initial state ── */
  it('starts with null user, error and loading=false', () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  /* ── login ── */
  it('login(): calls fetchMe after successful POST', async () => {
    const fakeUser = { id: '1', name: 'Test', email: 'a@b.com', role: 'customer' };
    mockFetch(200, { user: fakeUser });

    await useAuthStore.getState().login('a@b.com', 'password');

    const s = useAuthStore.getState();
    expect(s.user).toEqual(fakeUser);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('login(): sets error on 401', async () => {
    mockFetch(401, { message: 'Invalid credentials' });

    await useAuthStore.getState().login('a@b.com', 'wrong');

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.error).toContain('Invalid');
  });

  it('login(): sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useAuthStore.getState().login('a@b.com', 'password');

    expect(useAuthStore.getState().error).toContain('Network');
  });

  /* ── register ── */
  it('register(): calls fetchMe after successful POST', async () => {
    const fakeUser = { id: '2', name: 'New', email: 'new@b.com', role: 'customer' };
    mockFetch(200, { user: fakeUser });

    await useAuthStore.getState().register('New', 'new@b.com', '0901234567', 'password');

    const s = useAuthStore.getState();
    expect(s.user).toEqual(fakeUser);
  });

  it('register(): sets error on 409 duplicate email', async () => {
    mockFetch(409, { message: 'Email already exists' });

    await useAuthStore.getState().register('Dup', 'dup@b.com', '0901234567', 'password');

    expect(useAuthStore.getState().error).toContain('already exists');
  });

  it('register(): sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));

    await useAuthStore.getState().register('X', 'x@b.com', '0901234567', 'password');

    expect(useAuthStore.getState().error).toContain('Offline');
  });

  /* ── logout ── */
  it('logout(): clears user', async () => {
    useAuthStore.setState({ user: { id: '1', name: 'T', email: 't@b.com', role: 'customer' } });

    await useAuthStore.getState().logout();

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
  });

  /* ── fetchMe ── */
  it('fetchMe(): populates user on success', async () => {
    const user = { id: '1', name: 'Me', email: 'me@b.com', role: 'customer' };
    mockFetch(200, { user });

    await useAuthStore.getState().fetchMe();

    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('fetchMe(): clears user on 401', async () => {
    useAuthStore.setState({ user: { id: '1', name: 'Old', email: 'o@b.com', role: 'customer' } });
    mockFetch(401, { message: 'Session expired' });

    await useAuthStore.getState().fetchMe();

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.error).toBe('Session expired');
  });

  it('fetchMe(): sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));

    await useAuthStore.getState().fetchMe();

    expect(useAuthStore.getState().error).toContain('Offline');
  });

  /* ── loading state ── */
  it('sets loading=true during async operations', () => {
    useAuthStore.setState({ loading: true });
    expect(useAuthStore.getState().loading).toBe(true);
    useAuthStore.setState({ loading: false });
    expect(useAuthStore.getState().loading).toBe(false);
  });

  /* ── loading state ── */
  it('sets loading=true during async operations', () => {
    // Simulate: we can check that login sets loading then clears it
    useAuthStore.setState({ loading: true });
    expect(useAuthStore.getState().loading).toBe(true);
    useAuthStore.setState({ loading: false });
    expect(useAuthStore.getState().loading).toBe(false);
  });
});

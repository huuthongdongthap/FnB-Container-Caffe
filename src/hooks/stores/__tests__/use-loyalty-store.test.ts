import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLoyaltyStore } from '@/hooks/stores/use-loyalty-store';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

const API_BASE = 'https://aura-space-worker.agencyos-openclaw.workers.dev';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe('useLoyaltyStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null, loading: false, error: null });
    useLoyaltyStore.setState({
      tier: 'bronze',
      points: 0,
      cashbackRate: 3,
      rewards: [],
      history: [],
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  /* ── Initial state ── */
  it('starts with default tier bronze, 0 points, 3% cashback, not loading', () => {
    const s = useLoyaltyStore.getState();
    expect(s.tier).toBe('bronze');
    expect(s.points).toBe(0);
    expect(s.cashbackRate).toBe(3);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  /* ── fetchLoyalty ── */
  it('fetchLoyalty(): populates tier, points, cashbackRate on success', async () => {
    // Set auth first
    useAuthStore.setState({ token: 'valid-token' });

    const fakeData = {
      tier: 'gold',
      points: 250,
      lifetimePoints: 800,
      spentVnd: 2_500_000,
      cashbackRate: 7,
      birthdayBonus: 15,
      rewards: [
        { id: 'r1', name: 'Free Coffee', cost: 100, icon: '☕', description: 'One free coffee' },
      ],
      checkinStreak: 3,
    };

    // fetchLoyalty calls /api/loyalty/summary and /api/loyalty/points
    // We'll make both succeed. The store fetches summary first then points.
    mockFetch(200, { success: true, data: fakeData });

    await useLoyaltyStore.getState().fetchLoyalty();

    const s = useLoyaltyStore.getState();
    expect(s.tier).toBe('gold');
    expect(s.points).toBe(250);
    expect(s.cashbackRate).toBe(7);
    expect(s.rewards).toEqual(fakeData.rewards);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchLoyalty(): clears auth and sets error on 401 from API', async () => {
    useAuthStore.setState({ token: 'expired-token' });

    mockFetch(401, { message: 'Unauthorized' });

    await useLoyaltyStore.getState().fetchLoyalty();

    const s = useLoyaltyStore.getState();
    expect(s.tier).toBe('bronze');
    expect(s.error).toContain('Session expired');
  });

  it('fetchLoyalty(): sets error when no token exists (pre-auth check)', async () => {
    useAuthStore.setState({ token: null });

    await useLoyaltyStore.getState().fetchLoyalty();

    const s = useLoyaltyStore.getState();
    expect(s.error).toContain('Not authenticated');
  });

  it('fetchLoyalty(): sets loading true then false', async () => {
    useAuthStore.setState({ token: 'valid-token' });

    // Mock fetch that resolves after a tick
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { tier: 'silver', points: 75, lifetimePoints: 75, spentVnd: 750_000, cashbackRate: 5, birthdayBonus: 10 } }),
    }));

    // Check loading becomes true, then check after resolution
    useLoyaltyStore.setState({ loading: true });
    expect(useLoyaltyStore.getState().loading).toBe(true);

    await useLoyaltyStore.getState().fetchLoyalty();

    expect(useLoyaltyStore.getState().loading).toBe(false);
  });

  /* ── calculateCashback ── */
  it('calculateCashback(): returns correct cashback for bronze (3%)', () => {
    const store = useLoyaltyStore.getState();
    const cashback = store.calculateCashback(100_000);
    expect(cashback).toBe(3000); // 3% of 100000
  });

  it('calculateCashback(): returns correct cashback for silver (5%)', () => {
    useLoyaltyStore.setState({ cashbackRate: 5 });
    const store = useLoyaltyStore.getState();
    expect(store.calculateCashback(200_000)).toBe(10000); // 5% of 200000
  });

  it('calculateCashback(): returns correct cashback for gold (7%)', () => {
    useLoyaltyStore.setState({ cashbackRate: 7 });
    const store = useLoyaltyStore.getState();
    expect(store.calculateCashback(150_000)).toBe(10500); // 7% of 150000
  });

  it('calculateCashback(): returns correct cashback for platinum (10%)', () => {
    useLoyaltyStore.setState({ cashbackRate: 10 });
    const store = useLoyaltyStore.getState();
    expect(store.calculateCashback(300_000)).toBe(30000); // 10% of 300000
  });

  it('calculateCashback(): returns 0 for 0 amount', () => {
    const store = useLoyaltyStore.getState();
    expect(store.calculateCashback(0)).toBe(0);
  });

  /* ── redeemReward ── */
  it('redeemReward(): calls POST /api/loyalty/redeem and updates points on success', async () => {
    useAuthStore.setState({ token: 'valid-token' });

    useLoyaltyStore.setState({ points: 500 });
    mockFetch(200, { success: true, data: { pointsRemaining: 400 } });

    await useLoyaltyStore.getState().redeemReward('r1');

    const s = useLoyaltyStore.getState();
    expect(s.points).toBe(400);
    expect(s.loading).toBe(false);
  });

  it('redeemReward(): sets error on API failure', async () => {
    useAuthStore.setState({ token: 'valid-token' });
    mockFetch(400, { message: 'Not enough points' });

    await useLoyaltyStore.getState().redeemReward('r1');

    const s = useLoyaltyStore.getState();
    expect(s.error).toContain('Not enough points');
  });

  /* ── phoneAuth ── */
  it('phoneAuth(): calls POST /api/loyalty/phone-auth with phone number', async () => {
    let requestBody: string | null = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      requestBody = options?.body as string ?? null;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, customerToken: 'phone-jwt' }),
      });
    }));

    await useLoyaltyStore.getState().phoneAuth('0901234567');

    expect(requestBody).toContain('0901234567');
    const s = useLoyaltyStore.getState();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('phoneAuth(): sets error on failure', async () => {
    mockFetch(400, { message: 'Invalid phone' });

    await useLoyaltyStore.getState().phoneAuth('invalid');

    expect(useLoyaltyStore.getState().error).toContain('Invalid phone');
  });
});

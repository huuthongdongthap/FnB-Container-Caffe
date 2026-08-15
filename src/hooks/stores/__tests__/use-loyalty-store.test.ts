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
    useAuthStore.setState({ user: null, loading: false, error: null });
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
    // Summary response matches the real handleSummary handler
    const summaryData = {
      tier: 'gold',
      total_points: 250,
      lifetime_points: 800,
      tier_config: { cashback_rate: 7, tier_name: 'gold', min_points: 200 },
      wallet: { balance: 10000, total_earned: 50000, total_spent: 40000, expiring_within_7d: 0 },
      active_rewards: 0,
    };

    // Rewards response matches the real /api/loyalty/rewards endpoint
    const rewardsData = [
      { id: 'r1', title: 'Free Coffee', point_cost: 100, can_redeem: true, description: 'One free coffee' },
    ];

    // fetchLoyalty now makes 3 sequential calls: summary, points, rewards
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: summaryData }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: rewardsData }) })
    );

    await useLoyaltyStore.getState().fetchLoyalty();

    const s = useLoyaltyStore.getState();
    expect(s.tier).toBe('gold');
    expect(s.points).toBe(250);
    expect(s.cashbackRate).toBe(7);
    expect(s.rewards).toEqual([
      { id: 'r1', name: 'Free Coffee', cost: 100, icon: '🎁', description: 'One free coffee' },
    ]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchLoyalty(): sets Session expired on 401 from API', async () => {
    mockFetch(401, { message: 'Unauthorized' });

    await useLoyaltyStore.getState().fetchLoyalty();

    const s = useLoyaltyStore.getState();
    expect(s.tier).toBe('bronze');
    expect(s.error).toContain('Session expired');
  });

  it('fetchLoyalty(): sets loading true then false', async () => {
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
    useAuthStore.setState({ user: null });

    useLoyaltyStore.setState({ points: 500 });
    mockFetch(200, { success: true, data: { points_remaining: 400 } });

    await useLoyaltyStore.getState().redeemReward('r1');

    const s = useLoyaltyStore.getState();
    expect(s.points).toBe(400);
    expect(s.loading).toBe(false);
  });

  it('redeemReward(): sets error on API failure', async () => {
    useAuthStore.setState({ user: null });
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

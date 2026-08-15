import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useReferralStore } from '@/hooks/stores/use-referral-store';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe('useReferralStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useReferralStore.setState({
      referralCode: null,
      referralCount: 0,
      cashbackEarned: 0,
      codeUsage: 0,
      recentReferrals: [],
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  /* ── Initial state ── */
  it('starts with null referralCode, 0 referrals, no error', () => {
    const s = useReferralStore.getState();
    expect(s.referralCode).toBeNull();
    expect(s.referralCount).toBe(0);
    expect(s.cashbackEarned).toBe(0);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  /* ── fetchReferralData ── */
  it('fetchReferralData(): populates code + stats + cashbackEarned on success', async () => {

    const fakeData = {
      referral_code: 'FNB-ABC123',
      total_referrals: 5,
      total_cashback_earned_vnd: 50000,
      total_points_earned_legacy: 0,
      code_usage: 3,
      recent_referrals: [
        {
          id: 'ref1',
          referred_name: 'Nguyen Van A',
          referred_phone: '0901111111',
          status: 'completed',
          cashback_awarded_vnd: 10000,
          created_at: '2026-06-01',
        },
      ],
    };

    mockFetch(200, { success: true, data: fakeData });

    await useReferralStore.getState().fetchReferralData();

    const s = useReferralStore.getState();
    expect(s.referralCode).toBe('FNB-ABC123');
    expect(s.referralCount).toBe(5);
    expect(s.cashbackEarned).toBe(50000);
    expect(s.codeUsage).toBe(3);
    expect(s.recentReferrals).toHaveLength(1);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchReferralData(): sets error when not authenticated', async () => {
    mockFetch(401, { message: 'Not authenticated' });

    await useReferralStore.getState().fetchReferralData();

    const s = useReferralStore.getState();
    expect(s.error).toContain('Not authenticated');
    expect(s.loading).toBe(false);
  });

  it('fetchReferralData(): sets error on API failure', async () => {
    // api-client returns body.message when present, so error here should be backend-provided text
    mockFetch(500, { message: 'Server error' });

    await useReferralStore.getState().fetchReferralData();

    const s = useReferralStore.getState();
    expect(s.error).toContain('Server error');
  });

  /* ── applyReferralCode ── */
  it('applyReferralCode(): calls POST /api/loyalty/referral/apply on success', async () => {

    let requestBody: string | null = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/api/loyalty/referral/apply')) {
        requestBody = options?.body as string ?? null;
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { referrer_cashback_pending: 0, min_order_required: 20000, message: 'Code applied' } }),
      });
    }));

    await useReferralStore.getState().applyReferralCode('FNB-TEST');

    expect(requestBody).toContain('FNB-TEST');
    const s = useReferralStore.getState();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('applyReferralCode(): sets error on invalid code', async () => {
    mockFetch(400, { message: 'Invalid referral code' });

    await useReferralStore.getState().applyReferralCode('INVALID');

    const s = useReferralStore.getState();
    expect(s.error).toContain('Invalid referral code');
  });

  it('applyReferralCode(): sets error when not authenticated', async () => {
    mockFetch(401, { message: 'Not authenticated' });

    await useReferralStore.getState().applyReferralCode('FNB-TEST');

    const s = useReferralStore.getState();
    expect(s.error).toContain('Not authenticated');
  });

  /* ── copyReferralLink ── */
  it('copyReferralLink(): returns the referral link', () => {
    useReferralStore.setState({ referralCode: 'FNB-ABC123' });
    const link = useReferralStore.getState().copyReferralLink();
    expect(link).toContain('/referral?ref=FNB-ABC123');
  });

  it('copyReferralLink(): returns empty string when no code', () => {
    const link = useReferralStore.getState().copyReferralLink();
    expect(link).toBe('');
  });
});

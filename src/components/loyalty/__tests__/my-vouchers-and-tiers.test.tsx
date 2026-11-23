import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { MyVouchersSection } from '../MyVouchersSection';
import { TIER_POINTS, getTierProgress } from '@/pages/account/account-constants';

describe('MyVouchersSection & unified tier thresholds (#121, #124)', () => {
  it('renders active vouchers with code, copy button, and /checkout?promo= link', () => {
    renderWithProviders(
      <MyVouchersSection
        vouchers={[
          {
            id: 'v-1',
            rewardId: 'rew-1',
            code: 'VCH-FREE50',
            title: 'Giảm 50.000đ',
            status: 'active',
            expiresAt: '2099-12-31T00:00:00.000Z',
            createdAt: '2026-11-20T00:00:00.000Z',
          },
          {
            id: 'v-2',
            rewardId: 'rew-2',
            code: 'VCH-USED01',
            title: 'Miễn phí topping',
            status: 'used',
            expiresAt: null,
            createdAt: '2026-11-19T00:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('VCH-FREE50')).toBeInTheDocument();
    expect(screen.getByText('Giảm 50.000đ')).toBeInTheDocument();
    const useLinks = screen.getAllByRole('link', { name: /Dùng ngay/i });
    expect(useLinks).toHaveLength(1);
    expect(useLinks[0]).toHaveAttribute('href', '/checkout?promo=VCH-FREE50');
  });

  it('uses unified 0/50/200/500 tier thresholds matching backend tier_config', () => {
    expect(TIER_POINTS).toEqual({
      bronze: 0,
      silver: 50,
      gold: 200,
      platinum: 500,
    });

    const bronzeProgress = getTierProgress('bronze', 25);
    expect(bronzeProgress.nextTier).toBe('silver');
    expect(bronzeProgress.remaining).toBe(25);
    expect(bronzeProgress.percent).toBe(50);

    const goldProgress = getTierProgress('gold', 350);
    expect(goldProgress.nextTier).toBe('platinum');
    expect(goldProgress.remaining).toBe(150);
    expect(goldProgress.percent).toBe(50);
  });
});

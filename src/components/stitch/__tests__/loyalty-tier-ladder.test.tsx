import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { TierLadder } from '../loyalty-tier-ladder';
import type { LoyaltyTierLadderItem } from '../stitch-loyalty-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'loyalty.tierLadderTitle': 'Hệ thống cấp bậc thành viên',
        'loyalty.currentTier': 'Cấp bậc hiện tại',
        'loyalty.tierFromPoints': 'Từ {{points}} điểm',
        'loyalty.pointMultiplier': 'Hệ số điểm',
        'loyalty.cashbackRate': 'Hoàn tiền',
      };
      let text = map[key ?? ''] ?? key ?? '';
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          text = text.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return text;
    },
  }),
}));

const TIERS: LoyaltyTierLadderItem[] = [
  { tier_name: 'bronze', display_name_vi: 'Đồng', min_points: 0, point_multiplier: 1, cashback_rate: 0.03, is_current: true },
  { tier_name: 'silver', display_name_vi: 'Bạc', min_points: 50, point_multiplier: 1.1, cashback_rate: 0.05, is_current: false },
  { tier_name: 'gold', display_name_vi: 'Vàng', min_points: 200, point_multiplier: 1.3, cashback_rate: 0.07, is_current: false },
  { tier_name: 'platinum', display_name_vi: 'Bạch Kim', min_points: 500, point_multiplier: 1.5, cashback_rate: 0.10, is_current: false },
];

describe('TierLadder', () => {
  it('renders section title and all 4 tier names', () => {
    renderWithProviders(<TierLadder tiers={TIERS} />);
    expect(screen.getByText('Hệ thống cấp bậc thành viên')).toBeTruthy();
    expect(screen.getByText('Đồng')).toBeTruthy();
    expect(screen.getByText('Bạc')).toBeTruthy();
    expect(screen.getByText('Vàng')).toBeTruthy();
    expect(screen.getByText('Bạch Kim')).toBeTruthy();
  });

  it('renders multiplier values for each tier', () => {
    renderWithProviders(<TierLadder tiers={TIERS} />);
    expect(screen.getByText('1x')).toBeTruthy();
    expect(screen.getByText('1.1x')).toBeTruthy();
    expect(screen.getByText('1.3x')).toBeTruthy();
    expect(screen.getByText('1.5x')).toBeTruthy();
  });

  it('renders cashback percentages for each tier', () => {
    renderWithProviders(<TierLadder tiers={TIERS} />);
    expect(screen.getByText('3%')).toBeTruthy();
    expect(screen.getByText('5%')).toBeTruthy();
    expect(screen.getByText('7%')).toBeTruthy();
    expect(screen.getByText('10%')).toBeTruthy();
  });

  it('shows current tier badge only on the is_current tier', () => {
    renderWithProviders(<TierLadder tiers={TIERS} />);
    const badges = screen.getAllByText('Cấp bậc hiện tại');
    expect(badges.length).toBe(1);
  });

  it('interpolates min_points into tierFromPoints subtitle', () => {
    renderWithProviders(<TierLadder tiers={TIERS} />);
    expect(screen.getByText('Từ 0 điểm')).toBeTruthy();
    expect(screen.getByText('Từ 50 điểm')).toBeTruthy();
    expect(screen.getByText('Từ 200 điểm')).toBeTruthy();
    expect(screen.getByText('Từ 500 điểm')).toBeTruthy();
  });

  it('renders nothing when tiers is empty', () => {
    const { container } = renderWithProviders(<TierLadder tiers={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('uses fallback icon for unknown tier names', () => {
    const unknown: LoyaltyTierLadderItem[] = [
      { tier_name: 'diamond', display_name_vi: 'Kim Cương', min_points: 1000, point_multiplier: 2, cashback_rate: 0.15, is_current: true },
    ];
    renderWithProviders(<TierLadder tiers={unknown} />);
    expect(screen.getByText('★')).toBeTruthy();
    expect(screen.getByText('Kim Cương')).toBeTruthy();
    expect(screen.getByText('2x')).toBeTruthy();
    expect(screen.getByText('15%')).toBeTruthy();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { WeeklyStreak } from '../loyalty-weekly-streak';
import type { LoyaltyStreakDay } from '../stitch-loyalty-types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'loyalty.weeklyStreakAria': 'Weekly Streak',
        'loyalty.weeklyStreak': 'Weekly Streak',
        'loyalty.streakDescription': 'You have a {{count}} day streak!',
        'loyalty.checkinAria': 'Check in at Roastery',
        'loyalty.checkinRoastery': 'Check in at Roastery',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => {
    const map: Record<string, string> = {
      'loyalty.streakDescription': 'You have a 3 day streak!',
    };
    return map[i18nKey] ?? i18nKey;
  },
}));

const STREAK_DAYS: LoyaltyStreakDay[] = [
  { label: 'Mon', checked: true },
  { label: 'Tue', checked: true },
  { label: 'Wed', checked: true },
  { label: 'Thu', checked: false },
  { label: 'Fri', checked: false },
  { label: 'Sat', checked: false },
  { label: 'Sun', checked: false },
];

describe('WeeklyStreak', () => {
  it('renders section heading', () => {
    renderWithProviders(<WeeklyStreak days={STREAK_DAYS} streakCount={3} />);
    expect(screen.getByText('Weekly Streak')).toBeTruthy();
  });

  it('renders all day labels', () => {
    renderWithProviders(<WeeklyStreak days={STREAK_DAYS} streakCount={3} />);
    for (const day of STREAK_DAYS) {
      expect(screen.getByText(day.label)).toBeTruthy();
    }
  });

  it('renders streak count description', () => {
    renderWithProviders(<WeeklyStreak days={STREAK_DAYS} streakCount={3} />);
    expect(screen.getByText(/3 day streak/)).toBeTruthy();
  });

  it('calls onCheckIn when check-in button clicked', () => {
    const onCheckIn = vi.fn();
    renderWithProviders(<WeeklyStreak days={STREAK_DAYS} streakCount={3} onCheckIn={onCheckIn} />);
    screen.getByText('Check in at Roastery').click();
    expect(onCheckIn).toHaveBeenCalledOnce();
  });

  it('renders check-in button with aria-label', () => {
    renderWithProviders(<WeeklyStreak days={STREAK_DAYS} streakCount={0} />);
    expect(screen.getByLabelText('Check in at Roastery')).toBeTruthy();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchAccountDashNew } from '../StitchAccountDashNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {};
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  User: () => null,
  ShoppingBag: () => null,
  Gift: () => null,
  Star: () => null,
  Settings: () => null,
  LogOut: () => null,
  ChevronRight: () => null,
  Clock: () => null,
  CreditCard: () => null,
  LayoutDashboard: () => null,
  Coffee: () => null,
  RefreshCw: () => null,
  RotateCcw: () => null,
  Croissant: () => null,
  CupSoda: () => null,
  IceCream: () => null,
  Medal: () => null,
  ReceiptText: () => null,
  Armchair: () => null,
  Heart: () => null,
}));

describe('StitchAccountDashNew', () => {
  it('renders without per-page header (title now on MD3AppShell TopAppBar)', () => {
    // Header suppressed — AURA CAFE title renders on the shell's TopAppBar
    const { container } = renderWithProviders(<StitchAccountDashNew />);
    expect(container.querySelector('header')).toBeNull();
  });

  it('renders mock-free default profile name', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Khách hàng')).toBeTruthy();
    expect(screen.queryByText('Julian Vane')).toBeNull();
  });

  it('renders nav items via i18n fallback defaults', () => {
    renderWithProviders(<StitchAccountDashNew />);
    // t() returns fallback default strings for nav labels
    expect(screen.getByText('Reserve')).toBeTruthy();
    expect(screen.getByText('Orders')).toBeTruthy();
    expect(screen.getByText('Loyalty')).toBeTruthy();
    expect(screen.getByText('Account')).toBeTruthy();
  });

  it('renders loyalty progress text', () => {
    renderWithProviders(
      <StitchAccountDashNew
        loyalty={{ points: 1250, nextTier: 'Platinum', pointsToNext: 250, progressPercent: 83 }}
      />,
    );
    // pointsToNext (250) + pts + to go
    expect(screen.getByText(/250.*pts.*to go/)).toBeTruthy();
  });

  it('renders profile section with current balance', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Current Balance')).toBeTruthy();
  });
});

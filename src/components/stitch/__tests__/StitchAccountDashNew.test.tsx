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
  Menu: () => null,
}));

describe('StitchAccountDashNew', () => {
  it('renders the app title', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders profile name', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Alex Morgan')).toBeTruthy();
  });

  it('renders nav items via i18n keys', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Loyalty')).toBeTruthy();
    expect(screen.getByText('Orders')).toBeTruthy();
    expect(screen.getByText('Reserve')).toBeTruthy();
  });

  it('renders loyalty progress text', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('1,250')).toBeTruthy();
    expect(screen.getByText('to go')).toBeTruthy();
  });

  it('renders profile section with current balance', () => {
    renderWithProviders(<StitchAccountDashNew />);
    expect(screen.getByText('Current Balance')).toBeTruthy();
  });
});

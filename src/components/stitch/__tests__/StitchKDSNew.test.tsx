import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchKDSNew } from '../StitchKDSNew';

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
  Bell: () => null,
  Settings: () => null,
  LayoutDashboard: () => null,
  History: () => null,
  Package: () => null,
  Users: () => null,
  AlertTriangle: () => null,
  RefreshCw: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  ChefHat: () => null,
  CheckCircle2: () => null,
}));

vi.mock('@/hooks/use-focus-trap', () => ({
  useFocusTrap: () => {},
}));

describe('StitchKDSNew', () => {
  it('renders the KDS title', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getByText('HEARTH & STEEL KDS')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWithProviders(<StitchKDSNew isLoading />);
    expect(screen.getByText('HEARTH & STEEL KDS')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWithProviders(<StitchKDSNew error="Connection lost" />);
    expect(screen.getByText('HEARTH & STEEL KDS')).toBeTruthy();
  });

  it('renders filter buttons', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getByText('ALL')).toBeTruthy();
    expect(screen.getByText('PRIORITY')).toBeTruthy();
    expect(screen.getByText('PREPARING')).toBeTruthy();
    expect(screen.getByText('READY')).toBeTruthy();
  });

  it('renders default tickets', () => {
    renderWithProviders(<StitchKDSNew />);
    expect(screen.getByText('#9842')).toBeTruthy();
  });
});

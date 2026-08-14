import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchNotFoundNew } from '../StitchNotFoundNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'notFound.returnHome': 'Return Home / Quay ve trang chu',
        'notFound.subtitle': 'Khong tim thay trang',
        'notFound.title': 'Page not found',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Home: () => null,
  Search: () => null,
  HelpCircle: () => null,
}));

describe('StitchNotFoundNew', () => {
  it('renders the 404 page title', () => {
    renderWithProviders(<StitchNotFoundNew />);
    expect(screen.getByText('Page not found')).toBeTruthy();
  });

  it('renders subtitle', () => {
    renderWithProviders(<StitchNotFoundNew />);
    expect(screen.getByText('Khong tim thay trang')).toBeTruthy();
  });

  it('renders return home button', () => {
    const onNavigateHome = vi.fn();
    renderWithProviders(<StitchNotFoundNew onNavigateHome={onNavigateHome} />);
    const btn = screen.getByRole('button', { name: /Return Home/i });
    fireEvent.click(btn);
    expect(onNavigateHome).toHaveBeenCalled();
  });
});

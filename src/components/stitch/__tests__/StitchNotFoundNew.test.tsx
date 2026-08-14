import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchNotFoundNew } from '../StitchNotFoundNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.notFound': 'Page Not Found',
        'stitch.notFoundDesc': 'The page you are looking for does not exist.',
        'stitch.goHome': 'Go Home',
        'stitch.goBack': 'Go Back',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

describe('StitchNotFoundNew', () => {
  it('renders the 404 page', () => {
    renderWithProviders(<StitchNotFoundNew />);
    expect(screen.getByText('Page Not Found')).toBeTruthy();
  });

  it('renders description', () => {
    renderWithProviders(<StitchNotFoundNew />);
    expect(screen.getByText('The page you are looking for does not exist.')).toBeTruthy();
  });

  it('renders go home link', () => {
    renderWithProviders(<StitchNotFoundNew />);
    const homeLink = screen.getByText('Go Home').closest('a');
    expect(homeLink?.getAttribute('href')).toBe('/');
  });

  it('renders go back link', () => {
    renderWithProviders(<StitchNotFoundNew />);
    const backLink = screen.getByText('Go Back').closest('a');
    expect(backLink).toBeTruthy();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchLandingNew } from '../StitchLandingNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'stitch.landing': 'AURA CAFE Landing',
        'stitch.explore': 'Explore',
        'stitch.gallery': 'Gallery',
        'stitch.location': 'Location',
        'stitch.reservation': 'Reserve',
        'stitch.menu': 'Menu',
        'stitch.about': 'About',
        'stitch.hours': 'Hours',
        'stitch.phone': 'Phone',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  ArrowRight: () => null,
  ChevronRight: () => null,
  Coffee: () => null,
  ArmchairIcon: () => null,
  Truck: () => null,
  MapPin: () => null,
  Clock: () => null,
  Phone: () => null,
}));

describe('StitchLandingNew', () => {
  it('renders the landing page', () => {
    renderWithProviders(<StitchLandingNew />);
    // Should render hero section
    expect(screen.getByText(/AURA CAFE/i)).toBeTruthy();
  });

  it('renders with custom hero background URL', () => {
    const { container } = renderWithProviders(
      <StitchLandingNew heroBgUrl="https://example.com/hero.jpg" />,
    );
    expect(container).toBeTruthy();
  });

  it('renders gallery section', () => {
    renderWithProviders(<StitchLandingNew />);
    expect(screen.getByText(/gallery/i)).toBeTruthy();
  });

  it('renders location section', () => {
    renderWithProviders(<StitchLandingNew />);
    expect(screen.getByText(/location/i)).toBeTruthy();
  });

  it('renders reservation CTA', () => {
    renderWithProviders(<StitchLandingNew />);
    expect(screen.getByText(/reserve/i)).toBeTruthy();
  });
});

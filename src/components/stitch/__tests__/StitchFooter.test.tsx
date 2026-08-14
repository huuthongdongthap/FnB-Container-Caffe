import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import StitchFooter from '../StitchFooter';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'footer.brandName': 'AURA CAFE',
        'footer.description': 'Industrial luxury coffee experience.',
        'footer.spaces': 'SPACES',
        'footer.services': 'SERVICES',
        'footer.hours': 'HOURS',
        'footer.location': 'LOCATION',
        'footer.containerBar': 'Container Bar',
        'footer.voidLounge': 'Void Lounge',
        'footer.aurarium': 'Aurarium',
        'footer.sensoryLab': 'Sensory Lab',
        'footer.pourOver': 'Pour Over',
        'footer.coldBrew': 'Cold Brew',
        'footer.chemistBrew': 'Chemist Brew',
        'footer.signatureBlends': 'Signature Blends',
        'footer.weekdays': 'Weekdays: 08:00 - 23:00',
        'footer.weekends': 'Weekends: 09:00 - 01:00',
        'footer.kitchen': 'Kitchen: 11:00 - 22:00',
        'footer.addressLine1': 'No. 42 Industrial Avenue',
        'footer.addressLine2': 'Sa Dec, Dong Thap, Vietnam',
        'footer.quickLinks': 'QUICK LINKS',
        'footer.about': 'About',
        'footer.events': 'Events',
        'footer.loyalty': 'Loyalty',
        'footer.contact': 'Contact',
        'footer.gallery': 'Gallery',
        'footer.copyright': '2024 AURA CAFE. INDUSTRIAL LUXURY.',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  MapPin: () => null,
  Phone: () => null,
  Clock: () => null,
  Mail: () => null,
}));

describe('StitchFooter', () => {
  it('renders brand name', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders spaces section', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('SPACES')).toBeTruthy();
    expect(screen.getByText('Container Bar')).toBeTruthy();
  });

  it('renders services section', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('SERVICES')).toBeTruthy();
    expect(screen.getByText('Pour Over')).toBeTruthy();
  });

  it('renders hours section', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('HOURS')).toBeTruthy();
    expect(screen.getByText('Weekdays: 08:00 - 23:00')).toBeTruthy();
  });

  it('renders location section', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('LOCATION')).toBeTruthy();
    expect(screen.getByText('No. 42 Industrial Avenue')).toBeTruthy();
  });

  it('renders quick links', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('QUICK LINKS')).toBeTruthy();
    expect(screen.getByText('About')).toBeTruthy();
    expect(screen.getByText('Events')).toBeTruthy();
  });

  it('renders copyright', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('2024 AURA CAFE. INDUSTRIAL LUXURY.')).toBeTruthy();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import StitchFooter from '../StitchFooter';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'footer.descriptionVi': 'Trai nghiem cafe cong nghiep sang trong.',
        'footer.descriptionEn': 'Industrial luxury coffee experience.',
        'footer.services': 'SERVICES',
        'nav.menu': 'Menu',
        'nav.reservations': 'Reservations',
        'footer.trackOrder': 'Track Order',
        'footer.reviews': 'Reviews',
        'footer.subscriptions': 'Subscriptions',
        'footer.loyalty': 'Loyalty',
        'footer.referral': 'Referral',
        'footer.contact': 'Contact',
        'footer.brand': 'AURA CAFE',
        'footer.address': 'No. 42 Industrial Avenue, Sa Dec',
        'footer.weekdayHours': 'Weekdays: 08:00 - 23:00',
        'footer.weekendHours': 'Weekends: 09:00 - 01:00',
        'footer.zalo': 'Zalo',
        'footer.connect': 'CONNECT',
        'footer.facebook': 'Facebook',
        'footer.instagram': 'Instagram',
        'footer.tiktok': 'TikTok',
        'footer.copyright': '© {{year}} AURA CAFE. ALL RIGHTS RESERVED.',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      // Handle interpolation for footer.copyright etc
      if (optsOrFallback && typeof optsOrFallback === 'object' && !('defaultValue' in optsOrFallback)) {
        let text = map[key ?? ''] ?? key ?? '';
        for (const [k, v] of Object.entries(optsOrFallback)) {
          text = text.replaceAll(`{{${k}}}`, String(v));
        }
        return text;
      }
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
  it('renders description', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('Industrial luxury coffee experience.')).toBeTruthy();
  });

  it('renders services section', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('SERVICES')).toBeTruthy();
    expect(screen.getByText('Menu')).toBeTruthy();
    expect(screen.getByText('Reservations')).toBeTruthy();
  });

  it('renders contact info', () => {
    renderWithProviders(<StitchFooter />);
    // 'Contact' appears in nav link + section heading
    expect(screen.getAllByText('Contact').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/No. 42 Industrial Avenue/)).toBeTruthy();
  });

  it('renders hours', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('Weekdays: 08:00 - 23:00')).toBeTruthy();
    expect(screen.getByText('Weekends: 09:00 - 01:00')).toBeTruthy();
  });

  it('renders connect section', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText('CONNECT')).toBeTruthy();
  });

  it('renders copyright', () => {
    renderWithProviders(<StitchFooter />);
    expect(screen.getByText(/AURA CAFE\. ALL RIGHTS RESERVED/)).toBeTruthy();
  });
});

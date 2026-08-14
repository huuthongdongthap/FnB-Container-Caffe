import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { SiteFooter } from '../stitch-container-new2-site-footer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string) => {
      const map: Record<string, string> = {
        'common.footer': 'Footer',
        'containerNew2.share': 'Share',
        'containerNew2.location': 'Location',
      };
      return map[key ?? ''] ?? key ?? '';
    },
  }),
}));

const FOOTER_PROPS = {
  logo: 'AURA CAFE',
  addressLines: ['123 Architectural Way, Sa Dec', 'Dong Thap, Vietnam'],
  email: 'contact@auracafe.vn',
  linkGroups: [
    {
      id: 'explore',
      heading: 'Explore',
      links: [
        { id: 'menu', label: 'Menu', href: '#menu' },
        { id: 'story', label: 'Our Story', href: '#story' },
      ],
    },
    {
      id: 'legal',
      heading: 'Legal',
      links: [
        { id: 'privacy', label: 'Privacy Policy', href: '#privacy' },
      ],
    },
  ],
  legalLinks: [{ id: 'share', label: 'Share', href: '#share' }],
  copyright: '2024 AURA CAFE',
};

describe('SiteFooter', () => {
  it('renders logo', () => {
    renderWithProviders(<SiteFooter {...FOOTER_PROPS} />);
    expect(screen.getByText('AURA CAFE')).toBeTruthy();
  });

  it('renders address lines and email', () => {
    renderWithProviders(<SiteFooter {...FOOTER_PROPS} />);
    expect(screen.getByText('123 Architectural Way, Sa Dec')).toBeTruthy();
    expect(screen.getByText('Dong Thap, Vietnam')).toBeTruthy();
    expect(screen.getByText('contact@auracafe.vn')).toBeTruthy();
  });

  it('renders link group headings and links', () => {
    renderWithProviders(<SiteFooter {...FOOTER_PROPS} />);
    expect(screen.getByText('Explore')).toBeTruthy();
    expect(screen.getByText('Legal')).toBeTruthy();
    expect(screen.getByText('Menu')).toBeTruthy();
    expect(screen.getByText('Privacy Policy')).toBeTruthy();
  });

  it('renders copyright text', () => {
    renderWithProviders(<SiteFooter {...FOOTER_PROPS} />);
    expect(screen.getByText('2024 AURA CAFE')).toBeTruthy();
  });

  it('renders share and location icons in bottom bar', () => {
    renderWithProviders(<SiteFooter {...FOOTER_PROPS} />);
    const shareIcon = screen.getByLabelText('Share');
    const locationIcon = screen.getByLabelText('Location');
    expect(shareIcon).toBeTruthy();
    expect(locationIcon).toBeTruthy();
  });
});

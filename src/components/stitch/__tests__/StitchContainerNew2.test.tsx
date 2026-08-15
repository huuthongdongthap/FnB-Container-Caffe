import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { StitchContainerNew2 } from '../StitchContainerNew2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'common.error': 'Something went wrong',
        'containerNew2.home': 'Home',
        'containerNew2.menu': 'Menu',
        'containerNew2.location': 'Location',
        'containerNew2.heroTag': 'Premium Specialty Coffee',
        'containerNew2.heroTitle': 'AURA CAFE —',
        'containerNew2.heroSubtitle': 'Container Caffe & Space',
        'containerNew2.heroDescription': 'An avant-garde sanctuary.',
        'containerNew2.reservation': 'Book a Table',
        'containerNew2.viewGallery': 'View Gallery',
        'containerNew2.sectionTitle': 'The Container Aesthetic',
        'containerNew2.feature1Title': 'Architectural Precision',
        'containerNew2.feature1Desc': 'Industrial containers.',
        'containerNew2.feature2Title': 'Curated Brews',
        'containerNew2.feature2Desc': 'Specialty beans.',
        'containerNew2.feature3Title': 'Nocturnal Ambience',
        'containerNew2.feature3Desc': 'Twilight lighting.',
        'containerNew2.brandName': 'AURA CAFE',
        'containerNew2.copyright': '2024 AURA CAFE',
        'containerNew2.share': 'Share',
        'common.mainNavigation': 'Main Navigation',
        'common.footer': 'Footer',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
    },
  }),
}));

vi.mock('lucide-react', () => ({
  Sparkles: () => null,
  Building2: () => null,
  Coffee: () => null,
  MoonStar: () => null,
  Share2: () => null,
  MapPin: () => null,
}));

const PARTIAL_DATA = {
  navLinks: [{ id: 'home', label: 'Home', href: '#', isActive: true }],
  heroTag: 'Premium',
  heroTitle: 'AURA CAFE —',
  heroSubtitle: 'Container Caffe',
  heroDescription: 'Description.',
  reservationLabel: 'Book',
  viewGalleryLabel: 'Gallery',
  sectionTitle: 'Features',
  featureCards: [{ id: 'c1', icon: 'architecture', title: 'Card 1', description: 'Desc 1' }],
  atmosphereTitle: 'Atmosphere',
  atmosphereQuote: 'Quote',
  atmosphereAttribution: 'Author',
  atmosphereBgUrl: '',
  atmosphereBgAlt: 'Alt',
  menuSectionTitle: 'Menu',
  menuSectionSubtitle: 'Subtitle',
  signatureItems: [{ id: 'i1', name: 'Espresso', description: 'Dark', price: '$5' }],
  menuImageUrl: '',
  menuImageAlt: 'Alt',
  footerLogo: 'AURA CAFE',
  footerAddressLines: ['Address'],
  footerEmail: 'test@test.com',
  footerLinkGroups: [{ id: 'g1', heading: 'Explore', links: [{ id: 'l1', label: 'Menu', href: '#m' }] }],
  legalLinks: [{ id: 'll1', label: 'Privacy', href: '#p' }],
  copyright: '2024',
};

describe('StitchContainerNew2', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton when loadingState is loading', () => {
    const { container } = renderWithProviders(
      <StitchContainerNew2 loadingState="loading" />,
    );
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders error state when loadingState is error', () => {
    renderWithProviders(
      <StitchContainerNew2 loadingState="error" errorMessage="Server down" />,
    );
    expect(screen.getByText('Server down')).toBeTruthy();
  });

  it('renders default content when no data provided (uses default data)', () => {
    renderWithProviders(<StitchContainerNew2 />);
    expect(screen.getAllByText('AURA CAFE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Book a Table/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders hero section with CTA buttons', () => {
    renderWithProviders(<StitchContainerNew2 />);
    expect(screen.getAllByText(/Book a Table/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/View Gallery/).length).toBeGreaterThanOrEqual(1);
  });

  it('calls onReservation when reservation button clicked', () => {
    const onReservation = vi.fn();
    renderWithProviders(
      <StitchContainerNew2 onReservation={onReservation} />,
    );
    // Click the hero CTA button using fireEvent
    const heroButton = screen.getAllByText(/Book a Table/).find(
      (el) => el.tagName === 'BUTTON',
    );
    if (heroButton) fireEvent.click(heroButton);
    expect(onReservation).toHaveBeenCalled();
  });
});

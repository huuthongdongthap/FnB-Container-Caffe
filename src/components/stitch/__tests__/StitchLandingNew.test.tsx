import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils';
import { StitchLandingNew } from '../StitchLandingNew';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, optsOrFallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'landing.about': 'About',
        'landing.copyright': '© 2024 AURA CAFE SA DEC. ALL RIGHTS RESERVED.',
        'landing.exploreNow': 'Khám phá ngay',
        'landing.featureDeliveryLink': 'Đặt hàng',
        'landing.featureDeliveryTitle': 'Giao tận nơi',
        'landing.featureMenuLink': 'Xem chi tiết',
        'landing.featureMenuTitle': 'Menu đa dạng',
        'landing.featureReserveLink': 'Đặt chỗ ngay',
        'landing.featureReserveTitle': 'Đặt bàn nhanh',
        'landing.footerContact': 'Contact Us',
        'landing.footerFacebook': 'Facebook',
        'landing.footerInstagram': 'Instagram',
        'landing.footerPrivacy': 'Privacy Policy',
        'landing.footerTagline': 'Architectural Container Coffee Experience',
        'landing.footerTerms': 'Terms of Service',
        'landing.galleryBullet1Title': 'Vật liệu tinh tuyển',
        'landing.galleryBullet2Title': 'Ánh sáng cảm xúc',
        'landing.gallerySubtitle': 'Kiến Trúc Độc Bản',
        'landing.galleryTitle': 'Nơi Công Nghiệp Gặp Gỡ Sự Sang Trọng',
        'landing.heroTagline': 'Sa Dec • Premium Coffee',
        'landing.heroTitle': 'AURA CAFE',
        'landing.location': 'Location',
        'landing.locationHours': 'Mở cửa: 07:00 - 23:00 mỗi ngày',
        'landing.locationPhone': '+84 277 123 456',
        'landing.locationTitle': 'Ghé thăm chúng tôi tại Sa Đéc',
        'landing.orderNow': 'Order Now',
        'landing.reservation': 'Reservation',
        'landing.viewMenu': 'Thực đơn',
        'nav.menu': 'Menu',
      }
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof optsOrFallback === 'string') return optsOrFallback;
      if (optsOrFallback && typeof optsOrFallback === 'object' && 'defaultValue' in optsOrFallback) return optsOrFallback.defaultValue ?? key ?? '';
      return key ?? '';
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

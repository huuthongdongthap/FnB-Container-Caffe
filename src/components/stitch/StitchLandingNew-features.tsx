import { useTranslation } from 'react-i18next';
import { Coffee, ArmchairIcon as Seat, Truck, ChevronRight } from 'lucide-react';

/** Shared glass-card style for feature cards. */
const cardStyle = {
  background: 'rgba(148, 163, 184, 0.1)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-dim) 20%, transparent)',
} as const;

/** Shared icon container style. */
const iconContainerStyle = {
  border: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 30%, transparent)',
  borderRadius: 0,
  boxShadow: '0 0 20px color-mix(in srgb, var(--aura-chrome-bright) 15%, transparent)',
} as const;

/** Title typography for feature cards. */
const titleStyle = {
  fontFamily: "'EB Garamond', serif",
  fontSize: '24px',
  lineHeight: '1.4',
  fontWeight: 600,
  color: 'var(--aura-chrome-bright)',
} as const;

/** Body typography for feature cards. */
const bodyStyle = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '14px',
  lineHeight: '1.5',
  fontWeight: 400,
  color: 'var(--aura-chrome-soft)',
} as const;

/** Link typography for feature cards. */
const linkStyle = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '12px',
  lineHeight: '1',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: 'var(--aura-chrome-bright)',
};

/** Feature data for the three cards. */
const features = [
  {
    icon: Coffee,
    titleKey: 'landing.featureMenuTitle',
    titleFallback: 'Menu đa dạng',
    descKey: 'landing.featureMenuDesc',
    descFallback:
      'Từ những hát Arabica tuyển chọn đến những công thừc trà đặc biệt, được pha chỉ bởi những nghệ nhân barista tận tâm nhất.',
    linkKey: 'landing.featureMenuLink',
    linkFallback: 'Xem chi tiết',
    href: '/menu',
  },
  {
    icon: Seat,
    titleKey: 'landing.featureReserveTitle',
    titleFallback: 'Đặt bàn nhanh',
    descKey: 'landing.featureReserveDesc',
    descFallback:
      'Đảm bảo vị trí ngỗ lý tưởng trong không gian lounge sang trọng cho những cuộc gặp gủ quan trọng hoặc những giây phút thu gîn.',
    linkKey: 'landing.featureReserveLink',
    linkFallback: 'Đặt chỗ ngay',
    href: '/table-reservation',
  },
  {
    icon: Truck,
    titleKey: 'landing.featureDeliveryTitle',
    titleFallback: 'Giao tận nơi',
    descKey: 'landing.featureDeliveryDesc',
    descFallback:
      'Thưởng thức hương vị AURA ngay tại nhà hoặc văn phòng với dịch vụ giao hàng nhanh chóng trong khu vực Sa Đéc.',
    linkKey: 'landing.featureDeliveryLink',
    linkFallback: 'Đặt hàng',
    href: '/order',
  },
];

/** Three-column feature cards section (Menu, Reservation, Delivery). */
export function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section className="relative z-10 px-16 py-24 mb-32">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.titleKey}
              className="p-10 group transition-transform duration-500"
              style={cardStyle}
              data-glass-panel
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center mb-8"
                style={iconContainerStyle}
              >
                <Icon className="w-5 h-5" style={{ color: 'var(--aura-chrome-bright)' }} aria-hidden="true" />
              </div>
              <h3 className="mb-4" style={titleStyle}>
                {t(f.titleKey, f.titleFallback)}
              </h3>
              <p className="mb-8 leading-relaxed" style={bodyStyle}>
                {t(f.descKey, f.descFallback)}
              </p>
              <a
                href={f.href}
                className="group-hover:underline flex items-center gap-2"
                style={linkStyle}
              >
                {t(f.linkKey, f.linkFallback)}
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { useTranslation } from 'react-i18next';

const footerLinkStyle = {
  fontFamily: "var(--aura-font-body)",
  fontSize: '14px',
  lineHeight: '1.5',
  fontWeight: 400,
  color: 'var(--aura-chrome-soft)',
};

/** Footer with branding, navigation links, social links and copyright. */
export function LandingFooter({ brandName = 'AURA CAFE' }: { brandName?: string } = {}) {
  const { t } = useTranslation();

  return (
    <footer
      className="w-full border-t mt-20"
      style={{
        borderColor: 'color-mix(in srgb, var(--aura-chrome-dim) 20%, transparent)',
        backgroundColor: 'var(--aura-surface-dim)',
      }}
    >
      <div className="flex flex-col md:flex-row justify-between items-center px-16 py-12 w-full gap-8">
        {/* Brand */}
        <div className="flex flex-col gap-3">
          <a href="/" className="flex items-center gap-2.5">
            <img
              src="/images/aura-emblem.png"
              alt="AURA CAFE Logo"
              className="h-8 w-8 rounded-full border border-[var(--aura-chrome-mid)]/40 object-cover shadow-[0_0_8px_rgba(201,214,223,0.3)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/images/aura-master-logo.png';
              }}
            />
            <span
              style={{
                fontFamily: "var(--aura-font-display)",
                fontSize: '22px',
                lineHeight: '1.2',
                fontWeight: 700,
                color: 'var(--aura-chrome-bright)',
              }}
            >
              {brandName}
            </span>
          </a>
          <p
            className="max-w-xs uppercase tracking-widest text-[11px]"
            style={{ ...footerLinkStyle, opacity: 0.7 }}
          >
            {t('landing.footerTagline', 'Không gian cà phê container độc bản tại Sa Đéc • EST. 2018')}
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-8">
          <FooterLink href="/menu" linkKey="landing.footerMenu" fallback="Thực đơn" t={t} />
          <FooterLink href="/table-reservation" linkKey="landing.footerReservation" fallback="Đặt bàn" t={t} />
          <FooterLink href="/promotions" linkKey="landing.footerPromotions" fallback="Ưu đãi" t={t} />
          <FooterLink href="/about" linkKey="landing.footerAbout" fallback="Câu chuyện AURA" t={t} />
          <FooterLink href="/gallery" linkKey="landing.footerGallery" fallback="Không gian" t={t} />
          <FooterLink href="/reviews" linkKey="landing.footerReviews" fallback="Đánh giá" t={t} />
          <FooterLink href="/contact" linkKey="landing.footerContact" fallback="Liên hệ" t={t} />
        </div>

        {/* Copyright */}
        <div
          className="text-center md:text-left text-xs"
          style={{ ...footerLinkStyle, opacity: 0.6 }}
        >
          {`© ${new Date().getFullYear()} AURA CAFE SA ĐÉC. ĐÃ ĐĂNG KÝ BẢN QUYỀN.`}
        </div>
      </div>
    </footer>
  );
}

interface FooterLinkProps {
  href: string;
  linkKey: string;
  fallback: string;
  t: (key: string, fallback: string) => string;
  external?: boolean;
}

/** Single footer navigation link with hover effect. */
function FooterLink({ href, linkKey, fallback, t, external }: FooterLinkProps) {
  return (
    <a
      href={href}
      className="uppercase tracking-wider transition-colors"
      style={footerLinkStyle}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-bright)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
    >
      {t(linkKey, fallback)}
    </a>
  );
}

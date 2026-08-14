import { useTranslation } from 'react-i18next';

const footerLinkStyle = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '14px',
  lineHeight: '1.5',
  fontWeight: 400,
  color: 'var(--aura-chrome-soft)',
};

/** Footer with branding, navigation links, social links and copyright. */
export function LandingFooter() {
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
        <div className="flex flex-col gap-4">
          <div
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: '24px',
              lineHeight: '1.4',
              fontWeight: 600,
              color: 'var(--aura-chrome-bright)',
            }}
          >
            AURA CAFE
          </div>
          <p
            className="max-w-xs uppercase tracking-widest"
            style={{ ...footerLinkStyle, opacity: 0.6 }}
          >
            {t('landing.footerTagline', 'Architectural Container Coffee Experience')}
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          <FooterLink href="/contact" linkKey="landing.footerContact" fallback="Contact Us" t={t} />
          <FooterLink href="/privacy" linkKey="landing.footerPrivacy" fallback="Privacy Policy" t={t} />
          <FooterLink href="/terms" linkKey="landing.footerTerms" fallback="Terms of Service" t={t} />
          <FooterLink href="https://instagram.com/auracafe" linkKey="landing.footerInstagram" fallback="Instagram" t={t} external />
          <FooterLink href="https://facebook.com/auracafe" linkKey="landing.footerFacebook" fallback="Facebook" t={t} external />
        </div>

        {/* Copyright */}
        <div
          className="text-center md:text-left"
          style={{ ...footerLinkStyle, opacity: 0.6 }}
        >
          {t('landing.copyright', '© 2024 AURA CAFE SA DEC. ALL RIGHTS RESERVED.')}
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

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function LoyaltyFooter() {
  const { t } = useTranslation();

  return (
    <footer
      className="w-full bg-[var(--aura-bg-page)] border-t border-[rgba(255,255,255,0.05)] flex flex-col items-center gap-[24px] px-[64px] py-[48px]"
    >
      <div
        className="text-[48px] leading-[1.1] tracking-[-0.02em] font-normal"
        style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--aura-chrome-bright)' }}
      >
        AURA CAFE
      </div>
      <div
        className="flex flex-wrap justify-center gap-[24px] text-[12px] leading-none uppercase tracking-widest font-semibold"
        style={{ color: 'var(--aura-chrome-bright)', fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <Link to="/privacy" className="hover:text-[var(--aura-chrome-bright)] transition-colors duration-300">
          {t('loyalty.footerPrivacy', 'Privacy Policy')}
        </Link>
        <Link to="/terms" className="hover:text-[var(--aura-chrome-bright)] transition-colors duration-300">
          {t('loyalty.footerTerms', 'Terms of Service')}
        </Link>
        <Link to="/loyalty" className="hover:text-[var(--aura-chrome-bright)] transition-colors duration-300">
          {t('loyalty.footerBlackTier', 'Black Tier Benefits')}
        </Link>
        <Link to="/contact" className="hover:text-[var(--aura-chrome-bright)] transition-colors duration-300">
          {t('loyalty.footerContact', 'Contact Concierge')}
        </Link>
      </div>
      <p
        className="mt-4 text-[12px] leading-none font-semibold opacity-50"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}
      >
        {t('loyalty.footerCopyright', { year: 2024, defaultValue: '© 2024 AURA CAFE. ALL RIGHTS RESERVED.' })}
      </p>
    </footer>
  );
}

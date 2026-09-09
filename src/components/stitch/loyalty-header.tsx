import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function LoyaltyHeader() {
  const { t } = useTranslation();

  return (
    <header
      className="fixed top-0 w-full z-50 bg-[var(--aura-surface-dim)]/80 backdrop-blur-[8px] border-b border-[var(--aura-chrome-soft)]/10 flex justify-between items-center px-[64px] py-[8px] max-w-full mx-auto"
    >
      <Link
        to="/"
        className="text-[40px] leading-none tracking-widest uppercase"
        style={{ fontFamily: 'var(--aura-font-display)', color: 'var(--aura-chrome-bright)', fontWeight: '400' }}
      >
        AURA CAFE
      </Link>
      <nav className="hidden md:flex gap-[24px] items-center">
        <Link
          to="/loyalty"
          className="hover:text-[var(--aura-chrome-bright)] transition-colors duration-300"
          style={{ fontFamily: "var(--aura-font-body)", color: 'var(--aura-chrome-soft)', fontWeight: '500' }}
        >
          {t('loyalty.navTiers', 'Tiers')}
        </Link>
        <Link
          to="/loyalty"
          className="font-bold border-b-2 pb-1"
          style={{ color: 'var(--aura-chrome-bright)', borderColor: 'var(--aura-chrome-bright)', fontFamily: "var(--aura-font-body)" }}
        >
          {t('loyalty.navRewards', 'Rewards')}
        </Link>
        <Link
          to="/about"
          className="hover:text-[var(--aura-chrome-bright)] transition-colors duration-300"
          style={{ fontFamily: "var(--aura-font-body)", color: 'var(--aura-chrome-soft)', fontWeight: '500' }}
        >
          {t('loyalty.navLounge', 'Lounge')}
        </Link>
        <Link
          to="/contact"
          className="hover:text-[var(--aura-chrome-bright)] transition-colors duration-300"
          style={{ fontFamily: "var(--aura-font-body)", color: 'var(--aura-chrome-soft)', fontWeight: '500' }}
        >
          {t('loyalty.navConcierge', 'Concierge')}
        </Link>
      </nav>
      <div className="flex items-center gap-[12px]">
        <button
         type="button"
          className="px-[24px] py-2 border border-[var(--aura-chrome-bright)]/30 rounded-full hover:bg-[var(--aura-chrome-bright)]/10 transition-all"
          style={{
            fontFamily: "var(--aura-font-body)",
            fontSize: '12px',
            lineHeight: '1',
            letterSpacing: '0.1em',
            fontWeight: '600',
            color: 'var(--aura-chrome-bright)',
          }}
        >
          {t('loyalty.membership', 'Membership')}
        </button>
        <div className="w-10 h-10 rounded-full border border-[var(--aura-chrome-bright)]/20 p-0.5 overflow-hidden">
          <img
            className="w-full h-full object-cover rounded-full"
            alt={t('loyalty.profileAvatar', 'Profile')}
            src="/photos/IMG_6698.webp"
          />
        </div>
      </div>
    </header>
  );
}

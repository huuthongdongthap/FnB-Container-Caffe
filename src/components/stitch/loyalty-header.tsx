import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

export function LoyaltyHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const initials = (user?.name || 'AC')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'AC';

  const scrollToSection = (sectionId: string) => {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate(`/loyalty#${sectionId}`);
  };

  return (
    <header
      className="w-full bg-[var(--aura-surface-dim)]/80 backdrop-blur-[8px] border-b border-[var(--aura-chrome-soft)]/10 flex justify-between items-center px-6 md:px-[64px] py-[10px] max-w-full mx-auto"
    >
      <Link
        to="/"
        className="text-[28px] md:text-[36px] leading-none tracking-widest uppercase"
        style={{ fontFamily: 'var(--aura-font-display)', color: 'var(--aura-chrome-bright)', fontWeight: '400' }}
      >
        AURA CAFE
      </Link>
      <nav className="hidden md:flex gap-[24px] items-center">
        <button
          type="button"
          onClick={() => scrollToSection('loyalty-tiers-section')}
          className="hover:text-[var(--aura-chrome-bright)] transition-colors duration-300 cursor-pointer"
          style={{ fontFamily: "var(--aura-font-body)", color: 'var(--aura-chrome-soft)', fontWeight: '500' }}
        >
          {t('loyalty.navTiers', 'Tiers')}
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('loyalty-rewards-section')}
          className="font-bold border-b-2 pb-1 cursor-pointer"
          style={{ color: 'var(--aura-chrome-bright)', borderColor: 'var(--aura-chrome-bright)', fontFamily: "var(--aura-font-body)" }}
        >
          {t('loyalty.navRewards', 'Rewards')}
        </button>
        <Link
          to="/menu"
          className="hover:text-[var(--aura-chrome-bright)] transition-colors duration-300"
          style={{ fontFamily: "var(--aura-font-body)", color: 'var(--aura-chrome-soft)', fontWeight: '500' }}
        >
          {t('nav.menu', 'Thực đơn')}
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
          onClick={() => navigate('/account')}
          className="px-[20px] py-2 border border-[var(--aura-chrome-bright)]/30 rounded-full hover:bg-[var(--aura-chrome-bright)]/10 transition-all cursor-pointer"
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
        <Link
          to="/account"
          aria-label={t('loyalty.profileAvatar', 'Profile')}
          className="w-10 h-10 rounded-full border border-[var(--aura-chrome-bright)]/30 bg-white/10 flex items-center justify-center text-xs font-bold text-[var(--aura-chrome-bright)] hover:bg-white/20 transition-colors"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}

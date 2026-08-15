import { cn } from '@/lib/cn';
import { useTranslation } from 'react-i18next';

const NAV_ITEMS = [
  { key: 'navTiers', label: 'Tiers' },
  { key: 'navRewards', label: 'Rewards' },
  { key: 'navLounge', label: 'Lounge' },
  { key: 'navConcierge', label: 'Concierge' },
] as const;

export function LoyaltyHeader() {
  const { t } = useTranslation();

  return (
    <header
      className="fixed top-0 w-full z-50 border-b backdrop-blur-xl flex justify-between items-center px-5 md:px-16 py-2 mx-auto"
      style={{
        background: 'rgba(5, 20, 36, 0.8)',
        borderColor: 'rgba(161, 141, 127, 0.1)',
      }}
    >
      <div
        className="tracking-widest uppercase"
        style={{
          fontFamily: "'Libre Caslon Text', serif",
          fontSize: '40px',
          lineHeight: '1',
          fontWeight: '400',
          color: 'var(--aura-tertiary)',
        }}
      >
        AURA CAFE
      </div>

      <nav className="hidden md:flex gap-6 items-center">
        {NAV_ITEMS.map(({ key }) => {
          const isActive = key === 'navRewards';
          return (
            <a
              key={key}
              href="#"
              className={cn(
                'text-sm font-medium transition-colors duration-300',
                isActive && 'font-bold border-b-2 pb-1',
              )}
              style={{
                color: isActive ? 'var(--aura-tertiary)' : '#d8c2b2',
                borderColor: isActive ? 'var(--aura-tertiary)' : 'transparent',
              }}
            >
              {t(`loyalty.${key}`)}
            </a>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <button
          className="px-6 py-2 text-xs font-semibold tracking-[0.1em] rounded-full border transition-all hover:bg-white/5"
          style={{
            borderColor: 'rgba(205,127,50,0.3)',
            color: 'var(--aura-tertiary)',
          }}
        >
          {t('loyalty.membership')}
        </button>
        <div
          className="w-10 h-10 rounded-full border p-0.5 overflow-hidden"
          style={{ borderColor: 'rgba(205,127,50,0.2)' }}
        >
          <img
            className="w-full h-full object-cover rounded-full"
            alt={t('loyalty.memberProfileAlt')}
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_Oxyq1zrTrXQ-uyuJYfLRy8IFFqmzEHbnEXxIUveRL23mJRBnSxK-c9OIOkxZSfOmXN0c8G4GRUaYb_NMLeRoySWCtvjIx62nk_KpJRdKtUCsX6Dc0Kg754MPsYj9fEGkFuVRngOx9w4M5ncO5c_wLbsdcH_ee8NxAasSgQdHynopzhjGsB0yBRttQ4JfDGRNZRzZcgIDEVbU52i2F__EDsJzIegpEIenyZKYmrQCb-e14odxLXJ8H5Y6cHD4Vj_6aPENmx-OThk"
          />
        </div>
      </div>
    </header>
  );
}

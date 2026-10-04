import { useTranslation } from 'react-i18next';
import { Gift } from 'lucide-react';

export function LoyaltyEmpty() {
  const { t } = useTranslation();

  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
      role="status"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--aura-bg-high) 40%, transparent)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid color-mix(in srgb, var(--aura-glass-bg) 5%, transparent)',
      }}
    >
      <Gift className="h-12 w-12" style={{ color: 'var(--aura-chrome-soft)' }} />
      <h3 className="text-xl font-semibold" style={{ fontFamily: 'var(--aura-font-display)', color: 'var(--aura-chrome-bright)' }}>
        {t('loyalty.emptyTitle')}
      </h3>
      <p style={{ color: 'var(--aura-chrome-soft)', fontFamily: "var(--aura-font-body)" }}>
        {t('loyalty.emptyDescription')}
      </p>
      <a
        href="/menu"
        className="btn-primary inline-flex items-center justify-center gap-2 mt-2 px-6 py-3 rounded-lg font-bold transition-all active:scale-95 text-sm"
        style={{
          backgroundColor: 'var(--aura-chrome-bright)',
          color: 'var(--aura-noir-deep)',
          fontFamily: 'var(--aura-font-body)',
        }}
      >
        <span>{t('loyalty.exploreMenu', 'Khám Phá Thực Đơn')}</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </a>
    </div>
  );
}

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
    </div>
  );
}

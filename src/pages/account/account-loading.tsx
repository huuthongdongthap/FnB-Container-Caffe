/**
 * Skeleton loading state for Account page.
 */
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';

export function AccountLoading() {
  const { t } = useTranslation('account');

  return (
    <>
      <HelmetHead
        title="Account — AURA CAFE"
        description="Your AURA CAFE account dashboard. Trang tai khoan AURA CAFE."
      />
      <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        <div
          className="animate-pulse space-y-4"
          aria-label={t('loadingData')}
          role="status"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-6"
              style={{
                backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))',
                border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))',
              }}
            >
              <div className="h-6 w-3/4 rounded" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
              <div className="h-3 w-1/2 rounded mt-3" style={{ backgroundColor: 'var(--aura-bg-high, #1e3550)' }} />
            </div>
          ))}
          <span className="sr-only">{t('loading')}</span>
        </div>
      </div>
    </>
  );
}

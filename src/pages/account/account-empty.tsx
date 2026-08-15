/**
 * Empty state (no profile data) for Account page.
 */
import { useTranslation } from 'react-i18next';
import { Gift } from 'lucide-react';
import { HelmetHead } from '@/components/seo/HelmetHead';

export function AccountEmpty() {
  const { t } = useTranslation('account');

  return (
    <>
      <HelmetHead
        title="Account — AURA CAFE"
        description="Your AURA CAFE account dashboard. Trang tai khoan AURA CAFE."
      />
      <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-xl p-10 text-center"
          style={{
            backgroundColor: 'rgba(30, 41, 59, 0.4)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Gift
            className="h-10 w-10"
            style={{ color: 'var(--aura-text-disabled, #5a6270)' }}
          />
          <p
            className="text-sm"
            style={{
              color: 'var(--aura-text-secondary, #a0a8b0)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('noData')}
          </p>
        </div>
      </div>
    </>
  );
}

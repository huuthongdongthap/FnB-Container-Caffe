/**
 * Error state for Account page.
 */
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { HelmetHead } from '@/components/seo/HelmetHead';

interface AccountErrorProps {
  error: string;
  onRetry: () => void;
}

export function AccountError({ error, onRetry }: AccountErrorProps) {
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
            backgroundColor: 'var(--aura-bg-glass, rgba(255,255,255,0.03))',
            backdropFilter: 'blur(var(--aura-glass-blur, 12px))',
            WebkitBackdropFilter: 'blur(var(--aura-glass-blur, 12px))',
            border: '1px solid var(--aura-glass-border, rgba(255,255,255,0.08))',
          }}
          role="alert"
        >
          <AlertCircle
            className="h-12 w-12"
            style={{ color: 'var(--aura-error, #ffb4ab)' }}
          />
          <h3
            className="text-xl font-semibold"
            style={{
              fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
              color: 'var(--aura-text-primary, #e8e8e8)',
            }}
          >
            {t('error.title')}
          </h3>
          <p
            className="text-sm"
            style={{
              color: 'var(--aura-text-secondary, #a0a8b0)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="px-6 py-3 rounded-lg font-bold text-sm transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--aura-primary, #c6c6c7)',
              color: 'var(--aura-on-primary, #1a1a2e)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('error.retry')}
          </button>
        </div>
      </div>
    </>
  );
}

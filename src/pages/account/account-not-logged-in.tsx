/**
 * Not-logged-in state for Account page.
 */
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { User, ArrowRight } from 'lucide-react';
import { HelmetHead } from '@/components/seo/HelmetHead';

export function AccountNotLoggedIn() {
  const navigate = useNavigate();
  const { t } = useTranslation('account');

  return (
    <>
      <HelmetHead
        title="Account — AURA CAFE"
        description="Your AURA CAFE account dashboard. Trang tai khoan AURA CAFE."
      />
      <div className="mx-auto max-w-2xl px-[var(--aura-container-padding,24px)] pt-8 pb-24">
        <div
          className="flex flex-col items-center justify-center gap-5 rounded-xl p-12 text-center"
          style={{
            backgroundColor: 'rgba(30, 41, 59, 0.4)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }}
          >
            <User
              className="h-8 w-8"
              style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
            />
          </div>
          <h3
            className="text-2xl font-semibold"
            style={{
              fontFamily: 'var(--aura-font-display, "EB Garamond", Georgia, serif)',
              color: 'var(--aura-text-primary, #e8e8e8)',
            }}
          >
            {t('notLoggedIn.title')}
          </h3>
          <p
            className="max-w-xs text-sm"
            style={{
              color: 'var(--aura-text-secondary, #a0a8b0)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('notLoggedIn.body')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="px-8 py-3 rounded-lg font-bold text-sm flex items-center gap-2 transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--aura-primary, #c6c6c7)',
              color: 'var(--aura-on-primary, #1a1a2e)',
              fontFamily: 'var(--aura-font-body, "Space Grotesk", system-ui, sans-serif)',
            }}
          >
            {t('notLoggedIn.cta')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

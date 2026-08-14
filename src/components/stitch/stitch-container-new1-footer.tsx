'use client';

import { useTranslation } from 'react-i18next';
import { Globe, Share2 } from 'lucide-react';

/**
 * Footer for AURA CAFE container page.
 */
export function ContainerCafeFooter() {
  const { t } = useTranslation();
  return (
    <footer
      className="w-full border-t py-20"
      style={{
        backgroundColor: '#000e22',
        borderColor: 'color-mix(in srgb, var(--aura-chrome-dim) 40%, transparent)',
      }}
      aria-label={t('common.footer', { defaultValue: 'Footer' })}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-8 text-center">
        {/* Brand */}
        <div
          className="text-[24px] leading-[1.4] tracking-widest uppercase"
          style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontWeight: 400,
            color: 'var(--aura-noir-void)',
          }}
        >
          AURA CAFE
        </div>

        {/* Links */}
        <div className="flex gap-12">
          <a
            href="#"
            className="uppercase tracking-widest opacity-80 transition-all hover:opacity-100"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              fontWeight: 500,
              color: 'var(--aura-chrome-soft)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-noir-void)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
          >
            {t('common.privacyPolicy', { defaultValue: 'Privacy' })}
          </a>
          <a
            href="#"
            className="uppercase tracking-widest opacity-80 transition-all hover:opacity-100"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              fontWeight: 500,
              color: 'var(--aura-chrome-soft)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-noir-void)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
          >
            {t('common.termsOfService', { defaultValue: 'Terms' })}
          </a>
          <a
            href="#"
            className="uppercase tracking-widest opacity-80 transition-all hover:opacity-100"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              lineHeight: '1.0',
              letterSpacing: '0.1em',
              fontWeight: 500,
              color: 'var(--aura-chrome-soft)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--aura-noir-void)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
          >
            {t('containerNew1.contact', { defaultValue: 'Contact' })}
          </a>
        </div>

        {/* Copyright */}
        <p
          className="mt-6 text-xs uppercase leading-[1.0] tracking-widest"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            color: 'color-mix(in srgb, var(--aura-chrome-soft) 60%, transparent)',
          }}
        >
          {t('containerNew1.copyright', {
            year: new Date().getFullYear(),
            defaultValue: '© 2024 AURA CAFE. ALL RIGHTS RESERVED.',
          })}
        </p>

        {/* Social icons */}
        <div className="mt-6 flex gap-6">
          <div
            className="group flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
            style={{ borderColor: 'rgba(198, 198, 199, 0.2)' }}
            aria-label={t('containerNew1.socialWebsite', { defaultValue: 'Website' })}
            role="button"
            tabIndex={0}
          >
            <Globe className="h-5 w-5 transition-colors" style={{ color: '#c6c6c7' }} />
          </div>
          <div
            className="group flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
            style={{ borderColor: 'rgba(198, 198, 199, 0.2)' }}
            aria-label={t('containerNew1.socialShare', { defaultValue: 'Share' })}
            role="button"
            tabIndex={0}
          >
            <Share2 className="h-5 w-5 transition-colors" style={{ color: '#c6c6c7' }} />
          </div>
        </div>
      </div>
    </footer>
  );
}

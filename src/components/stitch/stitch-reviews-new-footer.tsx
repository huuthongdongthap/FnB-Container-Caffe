/**
 * StitchReviewsNew — Footer section
 *
 * Minimal dark footer with brand, legal/utility links, and copyright.
 * Matches the original Stitch AI HTML export exactly.
 */

import { useTranslation } from 'react-i18next';

const FOOTER_LINK_STYLE = {
  fontFamily: "'Space Grotesk', system-ui, sans-serif",
  fontSize: '12px',
  lineHeight: '1.0',
  letterSpacing: '0.1em',
  fontWeight: 600 as const,
  textTransform: 'uppercase' as const,
  color: 'var(--aura-chrome-soft)',
  textDecorationColor: 'var(--aura-chrome-bright)',
  textUnderlineOffset: '4px',
};

export function ReviewsFooter() {
  const { t } = useTranslation();

  return (
    <footer
      className="mt-16 w-full border-t"
      style={{ borderColor: 'rgba(68, 71, 77, 0.1)', backgroundColor: '#000f22' }}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between px-6 py-8 md:flex-row">
        <span
          className="mb-4 text-2xl font-bold md:mb-0"
          style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            lineHeight: '1.3',
            fontWeight: 500,
            color: 'var(--aura-noir-void)',
          }}
        >
          Aura Cafe
        </span>

        <div className="mb-4 flex flex-wrap justify-center gap-8 md:mb-0">
          {[
            { key: 'footerPrivacy', default: 'Privacy Policy' },
            { key: 'footerTerms', default: 'Terms of Service' },
            { key: 'footerContact', default: 'Contact Us' },
            { key: 'footerPressKit', default: 'Press Kit' },
          ].map(({ key, default: label }) => (
            <a
              key={key}
              className="transition-all hover:underline"
              href="#"
              style={FOOTER_LINK_STYLE}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#d3e4ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--aura-chrome-soft)'; }}
            >
              {t(`stitch.${key}`, { defaultValue: label })}
            </a>
          ))}
        </div>

        <span
          className="uppercase tracking-widest opacity-60"
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: '12px',
            lineHeight: '1.0',
            letterSpacing: '0.1em',
            fontWeight: 600,
            color: 'var(--aura-chrome-soft)',
          }}
        >
          {t('stitch.footerCopyright', { defaultValue: '© 2024 Aura Cafe. Precision. Darkness. Luxury.' })}
        </span>
      </div>
    </footer>
  );
}

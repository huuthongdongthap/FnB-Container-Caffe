/**
 * StitchStoryNew-footer — CTA section + Footer.
 *
 * Full-width call-to-action banner with glow orbs and a CTA button,
 * followed by the site footer with brand info, link columns, social
 * icons, and copyright line.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { ArrowRight, Megaphone, Map, Mail } from 'lucide-react';

/* ─── CTA Section ───────────────────────────────────────────────────── */

interface CtaSectionProps {
  onCtaClick?: () => void;
}

export function CtaSection({ onCtaClick }: CtaSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="py-40 px-[64px] text-center bg-[var(--aura-surface-container)]">
      <div
        className="max-w-4xl mx-auto p-24 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid color-mix(in srgb, var(--aura-chrome-dim), transparent 80%)',
        }}
      >
        {/* Glow orbs */}
        <div
          className="absolute -top-24 -left-24 w-64 h-64 rounded-full"
          style={{ backgroundColor: 'color-mix(in srgb, var(--aura-chrome-bright), transparent 90%)', filter: 'blur(100px)' }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full"
          style={{ backgroundColor: 'color-mix(in srgb, var(--aura-noir-void), transparent 90%)', filter: 'blur(100px)' }}
        />

        <h2
          className="text-5xl md:text-7xl text-white mb-8"
          style={{ fontFamily: "var(--aura-font-display, 'EB Garamond', serif)" }}
        >
          {t('storyNew.ctaTitle', { defaultValue: 'Join the Pulse.' })}
        </h2>
        <p className="text-[var(--aura-chrome-soft)] mb-12 max-w-xl mx-auto font-light leading-relaxed" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('storyNew.ctaDesc', {
            defaultValue:
              "Experience the convergence of architectural design and the world's most precise caffeine delivery system.",
          })}
        </p>
        <button
          type="button"
          onClick={onCtaClick}
          className="bg-[var(--aura-surface-dim)] hover:bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] px-12 py-4 font-bold text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-3 mx-auto"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--aura-surface-dim), transparent 90%), 0 4px 6px -4px color-mix(in srgb, var(--aura-surface-dim), transparent 90%)',
          }}
        >
          {t('storyNew.ctaButton', { defaultValue: 'Experience the Precision' })}
          <ArrowRight size={24} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────────────────── */

export function FooterSection() {
  const { t } = useTranslation();

  const footerLinkGroups = [
    {
      heading: t('storyNew.footerLegalHeading', { defaultValue: 'Legal & Ethics' }),
      links: [
        { label: t('storyNew.footerPrivacy', { defaultValue: 'Privacy Policy' }), key: 'privacy' },
        { label: t('storyNew.footerTerms', { defaultValue: 'Terms of Service' }), key: 'terms' },
        { label: t('storyNew.footerSustainability', { defaultValue: 'Sustainability' }), key: 'sustainability' },
      ],
    },
    {
      heading: t('storyNew.footerCompanyHeading', { defaultValue: 'Company' }),
      links: [
        { label: t('storyNew.footerCareers', { defaultValue: 'Careers' }), key: 'careers' },
        { label: t('storyNew.footerPressKit', { defaultValue: 'Press Kit' }), key: 'press' },
        { label: t('storyNew.footerContact', { defaultValue: 'Contact' }), key: 'contact' },
      ],
    },
  ];

  const socialIcons = [
    { icon: Megaphone, label: t('storyNew.footerSocialMegaphone', { defaultValue: 'Brand Awareness' }), key: 'brand' },
    { icon: Map, label: t('storyNew.footerSocialLocation', { defaultValue: 'Location' }), key: 'location' },
    { icon: Mail, label: t('storyNew.footerSocialEmail', { defaultValue: 'Email' }), key: 'email' },
  ];

  return (
    <footer
      className="border-t border-[color-mix(in_srgb,var(--aura-chrome-dim)_20%,transparent)] py-20 px-[64px]"
      style={{ backgroundColor: 'var(--aura-surface-dim)' }}
      aria-label="Site footer"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-[24px] max-w-[1280px] mx-auto">
        {/* Brand column */}
        <div className="md:col-span-2">
          <div
            className="text-[var(--aura-noir-void)] uppercase mb-6"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontSize: '24px' }}
          >
            AURA CAFE
          </div>
          <p className="text-[var(--aura-chrome-soft)] max-w-sm text-xs leading-relaxed mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('storyNew.footerTagline', {
              defaultValue:
                'ENGINEERED ELEGANCE. NOCTURNAL SANCTUARY. RE-DEFINING THE ARCHITECTURE OF HOSPITALITY THROUGH PRECISION AND SALVAGE.',
            })}
          </p>
          <div className="flex gap-6">
            {socialIcons.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.key}
                  href="#"
                  className="text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors"
                  aria-label={item.label}
                >
                  <Icon size={20} aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>

        {/* Link columns */}
        {footerLinkGroups.map((group) => (
          <div key={group.heading} className="flex flex-col gap-4">
            <h5 className="text-white font-bold uppercase tracking-widest text-xs mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {group.heading}
            </h5>
            {group.links.map((link) => (
              <a
                key={link.key}
                href="#"
                className="text-xs text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-transform active:translate-x-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </div>

      <div className="max-w-[1280px] mx-auto mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-[var(--aura-chrome-soft)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('storyNew.footerCopyright', { defaultValue: '© 2024 AURA CAFE. ENGINEERED ELEGANCE.' })}
        </p>
        <p className="text-[10px] tracking-widest text-[var(--aura-chrome-soft)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('storyNew.footerVersion', { defaultValue: 'VERSION 2.0.4 // SYSTEM: ACTIVE' })}
        </p>
      </div>
    </footer>
  );
}

/**
 * Site footer with brand, address, link groups, and bottom bar.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { Share2, MapPin } from 'lucide-react';
import { COLORS, FONTS, type FooterLinkGroup } from './stitch-container-new2-types';

export function SiteFooter({
  logo,
  addressLines,
  email,
  linkGroups,
  legalLinks: _legalLinks,
  copyright,
}: {
  logo: string;
  addressLines: string[];
  email: string;
  linkGroups: FooterLinkGroup[];
  legalLinks: Array<{ id: string; label: string; href: string }>;
  copyright: string;
}) {
  const { t } = useTranslation();
  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: COLORS.surfaceContainerLowest,
        borderColor: 'color-mix(in srgb, var(--aura-chrome-dim) 10%, transparent)',
      }}
      aria-label={t('common.footer')}
    >
      {/* Main footer content */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-5 md:px-[64px] py-16 max-w-[1280px] mx-auto gap-12">
        {/* Brand column */}
        <div className="space-y-6">
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: '24px',
              lineHeight: '32px',
              fontWeight: 500,
              color: COLORS.primary,
            }}
          >
            {logo}
          </div>
          <address
            className="not-italic space-y-2"
            style={{
              fontFamily: FONTS.body,
              fontSize: '16px',
              lineHeight: '24px',
              fontWeight: 400,
              color: COLORS.onSurfaceVariant,
            }}
          >
            {addressLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            <p className="mt-4" style={{ color: COLORS.primary }}>
              {email}
            </p>
          </address>
        </div>

        {/* Link groups */}
        <div className="grid grid-cols-2 gap-16">
          {linkGroups.map((group) => (
            <div key={group.id} className="flex flex-col space-y-4">
              <span
                className="uppercase tracking-widest mb-2"
                style={{
                  fontFamily: FONTS.body,
                  fontSize: '12px',
                  lineHeight: '16px',
                  letterSpacing: '0.05em',
                  fontWeight: 500,
                  color: COLORS.secondary,
                }}
              >
                {group.heading}
              </span>
              {group.links.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  className="transition-colors hover:text-[var(--aura-chrome-bright)]"
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: '16px',
                    lineHeight: '24px',
                    fontWeight: 400,
                    color: COLORS.onSurfaceVariant,
                  }}
                  aria-label={link.label}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t px-5 md:px-[64px] py-8 max-w-[1280px] mx-auto"
        style={{ borderColor: 'color-mix(in srgb, var(--aura-chrome-dim) 5%, transparent)' }}
      >
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: '12px',
              lineHeight: '16px',
              letterSpacing: '0.05em',
              fontWeight: 500,
              color: COLORS.onSurfaceVariant,
            }}
          >
            {copyright}
          </p>
          <div className="flex space-x-6">
            <span
              className="cursor-pointer transition-colors hover:text-[var(--aura-chrome-bright)]"
              style={{ color: COLORS.onSurfaceVariant }}
              aria-label={t('containerNew2.share')}
            >
              <Share2 className="h-5 w-5" />
            </span>
            <span
              className="cursor-pointer transition-colors hover:text-[var(--aura-chrome-bright)]"
              style={{ color: COLORS.onSurfaceVariant }}
              aria-label={t('containerNew2.location')}
            >
              <MapPin className="h-5 w-5" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

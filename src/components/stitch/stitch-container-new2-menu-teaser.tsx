/**
 * Menu teaser section with signature items list and image.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, type SignatureItem } from './stitch-container-new2-types';

export function MenuTeaserSection({
  sectionTitle,
  sectionSubtitle,
  items,
  imageUrl,
  imageAlt,
  onMenuItemClick,
}: {
  sectionTitle: string;
  sectionSubtitle: string;
  items: SignatureItem[];
  imageUrl: string;
  imageAlt: string;
  onMenuItemClick?: (itemId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="py-32 px-5 md:px-[64px] max-w-[1280px] mx-auto"
      aria-labelledby="menu-heading"
    >
      <div className="grid grid-cols-12 items-center" style={{ gap: '24px' }}>
        {/* Text column */}
        <div className="col-span-12 md:col-span-6 space-y-12">
          <div>
            <h2
              id="menu-heading"
              className="mb-6"
              style={{
                fontFamily: FONTS.display,
                fontSize: '32px',
                lineHeight: '40px',
                fontWeight: 500,
                color: COLORS.onSurface,
              }}
            >
              {sectionTitle}
            </h2>
            <p
              style={{
                fontFamily: FONTS.body,
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 400,
                color: COLORS.onSurfaceVariant,
              }}
            >
              {sectionSubtitle}
            </p>
          </div>

          {/* Menu items list */}
          <ul className="space-y-6" role="list">
            {items.map((item) => (
              <li
                key={item.id}
                className="group flex justify-between items-end border-b pb-4"
                style={{
                  borderColor: 'color-mix(in srgb, var(--aura-chrome-dim) 30%, transparent)',
                }}
                onClick={() => onMenuItemClick?.(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onMenuItemClick?.(item.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={item.name}
              >
                <div className="space-y-1">
                  <span
                    className="uppercase"
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: '14px',
                      lineHeight: '20px',
                      letterSpacing: '0.1em',
                      fontWeight: 600,
                      color: COLORS.primary,
                    }}
                  >
                    {item.name}
                  </span>
                  <p
                    className="text-sm"
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: '14px',
                      color: COLORS.onSurfaceVariant,
                    }}
                  >
                    {item.description}
                  </p>
                </div>
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: '14px',
                    lineHeight: '20px',
                    letterSpacing: '0.1em',
                    fontWeight: 600,
                    color: COLORS.onSurface,
                  }}
                >
                  {item.price}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Image column */}
        <div className="col-span-12 md:col-span-6 h-[500px] relative overflow-hidden">
          <img
            className="w-full h-full object-cover"
            src={imageUrl}
            alt={imageAlt}
            loading="lazy"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              border: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
              margin: '16px',
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
}

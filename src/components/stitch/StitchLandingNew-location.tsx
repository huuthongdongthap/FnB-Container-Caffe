import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Phone, Navigation } from 'lucide-react';

/** Real Google Maps pin for AURA CAFE Sa Đéc */
const AURA_MAPS_URL = 'https://maps.app.goo.gl/KMKbeDY4gM2FBBpw9';

interface LocationSectionProps {
  locationMapUrl: string;
}

/** Location and contact information with embedded map. */
export function LocationSection({ locationMapUrl }: LocationSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="relative z-10 px-16 py-24 mb-16">
      <div
        className="p-12"
        style={{
          background: 'color-mix(in srgb, var(--aura-glass-border) 10%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-dim) 20%, transparent)',
        }}
        data-glass-panel
      >
        <div className="flex flex-col md:flex-row justify-between items-center gap-12">
          {/* Contact details */}
          <div className="max-w-md w-full">
            <h2
              className="mb-6"
              style={{
                fontFamily: "var(--aura-font-display)",
                fontSize: '32px',
                lineHeight: '1.3',
                fontWeight: 500,
                color: 'var(--aura-chrome-bright)',
              }}
            >
              {t('landing.locationTitle', 'Ghé thăm chúng tôi tại Sa Đéc')}
            </h2>
            <div className="space-y-4 mb-8">
              <ContactRow icon={MapPin} labelKey="landing.locationAddress" labelFallback="29 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp" t={t} />
              <ContactRow icon={Clock} labelKey="landing.locationHours" labelFallback="Mở cửa: 06:00 - 23:00 mỗi ngày" t={t} />
              <ContactRow icon={Phone} labelKey="landing.locationPhone" labelFallback="+84 946 013 633" t={t} />
            </div>
            {/* Directions CTA */}
            <a
              href={AURA_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[var(--aura-chrome-bright)]/40 text-sm font-semibold text-[var(--aura-chrome-bright)] hover:bg-[var(--aura-chrome-bright)]/10 transition-all"
            >
              <Navigation className="w-4 h-4" aria-hidden="true" />
              Chỉ đường trên Google Maps
            </a>
          </div>

          {/* Map image — clickable to open Maps */}
          <a
            href={AURA_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-1/2 h-64 overflow-hidden block group"
            aria-label="Mở bản đồ AURA CAFE trên Google Maps"
            style={{
              background: 'color-mix(in srgb, var(--aura-glass-border) 10%, transparent)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid color-mix(in srgb, var(--aura-chrome-dim) 30%, transparent)',
            }}
            data-glass-panel
          >
            <div className="relative w-full h-full">
              <div
                className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url('${locationMapUrl}')` }}
                role="img"
                aria-hidden="true"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#0A1A2E]/80 text-[var(--aura-chrome-bright)] text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                  Mở Google Maps
                </span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

interface ContactRowProps {
  icon: React.ComponentType<Record<string, unknown>>;
  labelKey: string;
  labelFallback: string;
  t: (key: string, fallback: string) => string;
}

/** Single contact info row with icon and text. */
function ContactRow({ icon: Icon, labelKey, labelFallback, t }: ContactRowProps) {
  return (
    <div className="flex items-center gap-4" style={{ color: 'var(--aura-chrome-soft)' }}>
      <Icon
        className="w-5 h-5 shrink-0"
        style={{ color: 'var(--aura-chrome-bright)' }}
        aria-hidden="true"
      />
      <span
        style={{
          fontFamily: "var(--aura-font-body)",
          fontSize: '16px',
          lineHeight: '1.6',
          fontWeight: 400,
        }}
      >
        {t(labelKey, labelFallback)}
      </span>
    </div>
  );
}

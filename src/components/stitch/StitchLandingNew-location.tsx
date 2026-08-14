import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Phone } from 'lucide-react';

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
          background: 'rgba(148, 163, 184, 0.1)',
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
                fontFamily: "'EB Garamond', serif",
                fontSize: '32px',
                lineHeight: '1.3',
                fontWeight: 500,
                color: 'var(--aura-chrome-bright)',
              }}
            >
              {t('landing.locationTitle', 'Ghé thăm chúng tôi tại Sa Đéc')}
            </h2>
            <div className="space-y-4">
              <ContactRow icon={MapPin} labelKey="landing.locationAddress" labelFallback="Đường Nguyễn Sinh Sắc, Phường 2, Sa Đéc, Đồng Tháp" t={t} />
              <ContactRow icon={Clock} labelKey="landing.locationHours" labelFallback="Mở cửa: 07:00 - 23:00 mỗi ngày" t={t} />
              <ContactRow icon={Phone} labelKey="landing.locationPhone" labelFallback="+84 277 123 456" t={t} />
            </div>
          </div>

          {/* Map image */}
          <div
            className="w-full md:w-1/2 h-64 overflow-hidden"
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid color-mix(in srgb, var(--aura-chrome-dim) 30%, transparent)',
            }}
            data-glass-panel
          >
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url('${locationMapUrl}')` }}
              role="img"
              aria-label={t(
                'landing.locationMapAlt',
                'Map showing AURA CAFE location in Sa Dec, Dong Thap',
              )}
            />
          </div>
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
          fontFamily: "'Space Grotesk', sans-serif",
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

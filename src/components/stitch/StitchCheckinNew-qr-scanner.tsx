/**
 * StitchCheckinNew — QR Scanner viewfinder section
 */

import { useTranslation } from 'react-i18next';
import { Scan } from 'lucide-react';
import { cn } from '@/lib/cn';
import { glassCardClasses } from './StitchCheckinNew-constants';

const QR_IMAGE_URL =
  '/photos/IMG_6581.webp';

export function QrScanner() {
  const { t } = useTranslation();

  return (
    <>
      {/* QR divider */}
      <div className="flex items-center gap-4 mb-12">
        <div className="h-px flex-1 bg-white/10" />
        <span className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-bright)]/50">
          {t('checkin.orScan', 'OR SCAN CODE')}
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* QR Scanner Viewfinder */}
      <section className="flex flex-col items-center">
        <div
          className={cn(
            glassCardClasses,
            'rounded-lg overflow-hidden relative flex items-center justify-center group',
          )}
          style={{ width: 180, height: 180 }}
        >
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[var(--aura-chrome-bright)]" />
          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[var(--aura-chrome-bright)]" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[var(--aura-chrome-bright)]" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[var(--aura-chrome-bright)]" />

          {/* Scan placeholder */}
          <div className="w-full h-full relative">
            <div
              className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700"
              style={{
                backgroundImage: `url("${QR_IMAGE_URL}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            {/* Laser scan line */}
            <div
              className="absolute left-0 w-full h-[2px] bg-[var(--aura-bronze-shimmer)]"
              style={{
                boxShadow: '0px 0px 10px var(--aura-bronze-shimmer)',
                animation: 'aura-scan 3s ease-in-out infinite',
              }}
            />
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-[var(--aura-bronze-shimmer)]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <Scan className="w-9 h-9 text-[var(--aura-bronze-shimmer)]" />
          </div>
        </div>
        <p className="mt-6 font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-bright)] text-center tracking-widest">
          {t('checkin.qrHint', 'POSITION QR CODE IN FRAME')}
        </p>
      </section>
    </>
  );
}

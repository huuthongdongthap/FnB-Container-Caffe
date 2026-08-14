/**
 * StitchOrderSuccessNew-location — Location card component
 *
 * Glass card with background image, gradient overlay, and map pin icon
 * for displaying the AURA CAFE location on the order success screen.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import { glassPanelClasses, DEFAULT_LOCATION_IMAGE } from './stitch-order-success-default';

interface LocationCardProps {
  locationName: string;
  imageUrl?: string;
}

export function LocationCard({ locationName, imageUrl }: LocationCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'glass-card rounded-[24px] overflow-hidden w-full h-40 relative group cursor-pointer transition-all duration-500 hover:border-[color-mix(in_oklab,var(--aura-chrome-bright)_40%,transparent)]',
        glassPanelClasses,
      )}
      role="region"
      aria-label={`${t('stitch.orderSuccessNewLocation')}: ${locationName}`}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
        style={{ backgroundImage: `url('${imageUrl || DEFAULT_LOCATION_IMAGE}')` }}
        role="img"
        aria-label={locationName}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-surface-dim)] to-transparent opacity-80" />

      {/* Location label */}
      <div className="absolute bottom-4 left-4 flex flex-col z-10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#c49271]">
          {t('stitch.orderSuccessNewLocation', {
            defaultValue: 'LOCATION',
          })}
        </span>
        <span className="text-2xl font-medium text-[var(--aura-chrome-bright)]">
          {locationName}
        </span>
      </div>

      {/* Map icon */}
      <div className="absolute top-4 right-4 z-10 bg-[color-mix(in_oklab,var(--aura-surface-dim)_60%,transparent)] backdrop-blur-md p-2 rounded-full border border-white/10">
        <MapPin className="text-[var(--aura-chrome-bright)]" size={18} aria-hidden="true" />
      </div>
    </div>
  );
}

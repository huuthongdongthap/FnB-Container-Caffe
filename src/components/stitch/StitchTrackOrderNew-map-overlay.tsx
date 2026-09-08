/**
 * MapOverlay — grayscale map preview below the CTA
 */

import { cn } from '@/lib/cn';
import { GLASS_CARD_CLASSES } from './StitchTrackOrderNew-constants';

export function MapOverlay() {
  return (
    <div className="mt-12 mb-20 opacity-60">
      <div className={cn(GLASS_CARD_CLASSES, 'w-full h-32 rounded-xl overflow-hidden relative grayscale contrast-125')}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              'url("/photos/IMG_6593.webp")',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-surface-dim)] to-transparent" />
      </div>
    </div>
  );
}

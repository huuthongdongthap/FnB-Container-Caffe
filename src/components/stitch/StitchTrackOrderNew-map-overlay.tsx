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
              'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA90WxYaHlUtsvBh5534XaBjg3-fyQzGcu9QrG8G_nEQu4rgCaHQbZzovFYquvVmqJ_sOldR6kY6wTGueiGtBVeKCTFkLR0fA-CcWscaVkcZ26ZYtbSXO76dQQWSpoLYCaBK-zl_h4QrJ0zHmHn0xUz131HlKl8mLPvzFCqI7ADhgbPX4bx1RlFukblIah1zs6ntPM1SOcoMvHdnxxj5T1DSAULw3dUQbMCDPP3dI-09iV0EDvwWAj0ga_AWpjCaxj2DO_NAcMyMjo")',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-surface-dim)] to-transparent" />
      </div>
    </div>
  );
}

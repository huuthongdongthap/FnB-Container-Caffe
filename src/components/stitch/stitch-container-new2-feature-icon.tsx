/**
 * Icon mapper for feature card icons.
 */
'use client';

import { Building2, Coffee, MoonStar } from 'lucide-react';
import { COLORS } from './stitch-container-new2-types';

export function FeatureIcon({ icon, className = 'text-4xl' }: { icon: string; className?: string }) {
  const iconStyle = { color: COLORS.primary };
  switch (icon) {
    case 'architecture':
      return (
        <span className={className} style={iconStyle} aria-hidden="true">
          <Building2 className="inline-block h-9 w-9" />
        </span>
      );
    case 'coffee_maker':
    case 'coffee':
      return (
        <span className={className} style={iconStyle} aria-hidden="true">
          <Coffee className="inline-block h-9 w-9" />
        </span>
      );
    case 'nights_stay':
      return (
        <span className={className} style={iconStyle} aria-hidden="true">
          <MoonStar className="inline-block h-9 w-9" />
        </span>
      );
    default:
      return null;
  }
}

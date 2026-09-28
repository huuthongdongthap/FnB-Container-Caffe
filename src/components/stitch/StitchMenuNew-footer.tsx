'use client';

/**
 * StitchMenuNewFooter — thin wrapper around the shared LandingFooter
 * so all public pages (menu, landing, etc.) have one consistent footer.
 * `brandName` prop is accepted for compatibility but LandingFooter uses
 * its own brand config internally.
 */
import { LandingFooter } from './StitchLandingNew-footer';

interface StitchMenuNewFooterProps {
  /** Accepted for API compatibility; LandingFooter uses brand config directly. */
  brandName?: string;
}

export function StitchMenuNewFooter({ brandName }: StitchMenuNewFooterProps) {
  return <LandingFooter brandName={brandName} />;
}

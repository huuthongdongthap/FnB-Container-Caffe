/**
 * Types for StitchPromotionsNew component.
 */

export type PromoOfferStatus = 'active' | 'exclusive' | 'members-only';

export interface PromoOffer {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  badge?: { label: string; variant?: 'default' | 'glass' };
  schedule?: string;
  isLocked?: boolean;
  tags?: string[];
  cta?: string;
}

export interface StitchPromotionsNewProps {
  /** Duration of countdown in seconds */
  countdownSeconds?: number;
  /** Hero promotion data */
  hero?: PromoOffer;
  /** Active offers grid */
  offers?: PromoOffer[];
}

import type { CSSProperties } from 'react';

export interface StitchHeroNewProps {
  /** Background image URL for the hero visual teaser section */
  bgImageUrl?: string;
  /** Top navigation logo text */
  brandName?: string;
}

export const DEFAULT_BG_IMAGE =
  '/photos/IMG_6565.webp';

export const SPACE_GROTESK = 'var(--aura-font-body)';
export const LIBRE_CASLON = 'var(--aura-font-display)';

export const GLASS_PANEL: CSSProperties = {
  background: 'color-mix(in srgb, var(--aura-glass-bg) 5%, transparent)',
  backdropFilter: 'blur(8px)',
  border: '1px solid color-mix(in srgb, var(--aura-chrome-light) 15%, transparent)',
};

export const CHROME_LINE: CSSProperties = {
  background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--aura-chrome-light) 30%, transparent), transparent)',
  height: '1px',
  width: '100%',
};

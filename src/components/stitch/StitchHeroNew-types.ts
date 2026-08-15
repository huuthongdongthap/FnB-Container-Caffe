import type { CSSProperties } from 'react';

export interface StitchHeroNewProps {
  /** Background image URL for the hero visual teaser section */
  bgImageUrl?: string;
  /** Top navigation logo text */
  brandName?: string;
}

export const DEFAULT_BG_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBfNKpadgwatJIDobwM9ttZy3Q69wVsM3Vn0TJErgSvTAFZ_fpQDjSL2aR3DOyPPysLqE5q83CIynNaNUnjrYsxvkC_AxpMq3c2ZP5oLCcQoZ1SA3CZoBPgNyio99x3VPl4Cp2rvs5c1Bxo-wYTyx6i9R73q1npmzbQY9LKGy0CjwP3Eo99wiLLFgRQ3dA__JvvA579RlpXZKzFZsCzdteQwjRhiC7UY0aYzs5OOQE0SC_I2NGbhRqk98Vt6b2hSAKi2wGJnyGL7QE';

export const SPACE_GROTESK = "'Space Grotesk', sans-serif";
export const LIBRE_CASLON = "'Libre Caslon Text', Georgia, serif";

export const GLASS_PANEL: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(198, 198, 199, 0.15)',
};

export const CHROME_LINE: CSSProperties = {
  background: 'linear-gradient(90deg, transparent, rgba(198, 198, 199, 0.3), transparent)',
  height: '1px',
  width: '100%',
};

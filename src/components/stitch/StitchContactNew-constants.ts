/**
 * StitchContactNew — Shared constants
 */

export const glassPanelClasses =
  'bg-[rgba(var(--aura-chrome-light),0.1)] backdrop-blur-[8px] border-t border-l border-[rgba(var(--aura-chrome-light),0.3)] border-r border-b border-[var(--aura-bronze-shimmer)]/50';

export const FOOTER_LINKS = [
  { i18nKey: 'contact.footerSupport', fallback: 'Support', path: '/support' },
  { i18nKey: 'contact.footerPrivacy', fallback: 'Privacy Policy', path: '/privacy' },
  { i18nKey: 'contact.footerTerms', fallback: 'Terms of Service', path: '/terms' },
] as const;

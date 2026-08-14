/**
 * Shared types and design tokens for StitchContainerNew2 components.
 */

/* ─── Types ────────────────────────────────────────────────────────── */

export interface SignatureItem {
  id: string;
  name: string;
  description: string;
  price: string;
}

export interface NavLink {
  id: string;
  label: string;
  href: string;
  isActive?: boolean;
}

export interface FeatureCard {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface FooterLinkGroup {
  id: string;
  heading: string;
  links: Array<{ id: string; label: string; href: string }>;
}

export interface ContainerCafeNew2Data {
  navLinks: NavLink[];
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  reservationLabel: string;
  viewGalleryLabel: string;
  sectionTitle: string;
  featureCards: FeatureCard[];
  atmosphereTitle: string;
  atmosphereQuote: string;
  atmosphereAttribution: string;
  atmosphereBgUrl: string;
  atmosphereBgAlt: string;
  menuSectionTitle: string;
  menuSectionSubtitle: string;
  signatureItems: SignatureItem[];
  menuImageUrl: string;
  menuImageAlt: string;
  footerLogo: string;
  footerAddressLines: string[];
  footerEmail: string;
  footerLinkGroups: FooterLinkGroup[];
  legalLinks: Array<{ id: string; label: string; href: string }>;
  copyright: string;
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchContainerNew2Props {
  data?: ContainerCafeNew2Data;
  loadingState?: LoadingState;
  errorMessage?: string;
  onReservation?: () => void;
  onViewGallery?: () => void;
  onMenuItemClick?: (itemId: string) => void;
  onNavClick?: (linkId: string) => void;
}

/* ─── Design Tokens ────────────────────────────────────────────────── */

export const COLORS = {
  background: 'var(--aura-surface-dim)',
  surface: 'var(--aura-surface-dim)',
  surfaceContainer: 'var(--aura-surface-container)',
  surfaceContainerLowest: 'var(--aura-bg-page)',
  onSurface: 'var(--aura-chrome-bright)',
  onSurfaceVariant: 'var(--aura-chrome-soft)',
  primary: 'var(--aura-chrome-bright)',
  primaryFixedDim: 'var(--aura-chrome-bright)',
  primaryContainer: 'var(--aura-chrome-bright)',
  onPrimary: 'var(--aura-noir-deep)',
  onPrimaryContainer: 'var(--aura-noir-deep)',
  secondary: 'var(--aura-chrome-soft)',
  outlineVariant: 'var(--aura-chrome-dim)',
  error: 'var(--aura-error)',
} as const;

export const FONTS = {
  display: "'EB Garamond', Georgia, serif",
  body: "'Space Grotesk', sans-serif",
} as const;

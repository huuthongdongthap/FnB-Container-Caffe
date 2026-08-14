/**
 * TypeScript interfaces and types for StitchEventsNew2 components.
 * Extracted from StitchEventsNew2.tsx to keep individual files under 200 LOC.
 */

/* ─── Event Data ─────────────────────────────────────────────────── */

export interface EventCard2 {
  id: string;
  dateLabel: string;
  title: string;
  description: string;
  metaLabel: string;
  metaIcon: string;
  imageUrl: string;
  imageAlt: string;
}

export interface ArchiveEvent2 {
  id: string;
  monthLabel: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
}

/* ─── Navigation & Filtering ─────────────────────────────────────── */

export interface FilterMonth {
  key: string;
  label: string;
}

export interface NavLinkItem {
  key: string;
  label: string;
  href: string;
  active?: boolean;
}

/* ─── Page Data & Loading ────────────────────────────────────────── */

export interface EventsNew2PageData {
  heroTag: string;
  heroTitle: string;
  heroDescription: string;
  heroImageUrl: string;
  heroImageAlt: string;
  navLinks: NavLinkItem[];
  filterMonths: FilterMonth[];
  featuredEvents: EventCard2[];
  pastArchives: ArchiveEvent2[];
  footerLinks: Array<{ key: string; label: string; href: string }>;
  copyright: string;
}

export type LoadingState = 'idle' | 'loading' | 'error';

/* ─── Component Props ────────────────────────────────────────────── */

export interface StitchEventsNew2Props {
  data?: EventsNew2PageData;
  loadingState?: LoadingState;
  errorMessage?: string;
  activeMonth?: string;
  onMonthChange?: (month: string) => void;
  onBookTable?: (eventId: string) => void;
  onReserveSpot?: () => void;
  onViewDetails?: () => void;
  onViewArchive?: () => void;
  onNavClick?: (linkKey: string) => void;
  onFilterByType?: () => void;
}

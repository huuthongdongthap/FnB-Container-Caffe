/**
 * Types and icon map for StitchAbout component.
 */
import {
  Building2,
  Coffee,
  Moon,
  Verified,
  Settings2,
  Leaf,
  ScrollText,
  QrCode,
  Smartphone,
  MapPin,
  Star,
} from 'lucide-react';

export const ICON_MAP = {
  architecture: Building2,
  precision_manufacturing: Settings2,
  nights_stay: Moon,
  verified: Verified,
  settings_input_component: Coffee,
  eco: Leaf,
  scroll_text: ScrollText,
  qr_code: QrCode,
  smartphone: Smartphone,
  map_pin: MapPin,
  star: Star,
} as const;

export interface Zone {
  id: string;
  name: string;
  role: string;
  imageUrl: string;
  imageAlt: string;
}

export interface TimelinePhase {
  id: string;
  phase: string;
  year: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  isActive?: boolean;
}

export interface StoryCard {
  id: string;
  icon: keyof typeof ICON_MAP;
  title: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
  span: string;
}

export interface ValueCard {
  id: string;
  icon: keyof typeof ICON_MAP;
  title: string;
  description: string;
}

export interface AboutPageData {
  heroTitle: string;
  heroSubtitle: string;
  storyTitle: string;
  storyLead: string;
  storyCards: StoryCard[];
  timelinePhases: TimelinePhase[];
  values: ValueCard[];
  zones: Zone[];
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchAboutProps {
  data?: AboutPageData;
  loadingState?: LoadingState;
  errorMessage?: string;
  onCtaClick?: () => void;
  onZoneClick?: (zoneId: string) => void;
}

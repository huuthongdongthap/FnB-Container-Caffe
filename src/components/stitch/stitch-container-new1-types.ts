/**
 * Types for StitchContainerNew1 component.
 */

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  imageAlt: string;
}

export interface NocturnalFeature {
  id: string;
  number: string;
  title: string;
  description: string;
}

export interface ContainerCafeData {
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroImageUrl: string;
  heroImageAlt: string;
  sectionTitle: string;
  featureCardTitle: string;
  featureCardText: string;
  featureImageUrl: string;
  featureImageAlt: string;
  detailCards: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    highlight?: boolean;
  }>;
  loungeTag: string;
  loungeTitle: string;
  loungeDescription: string;
  loungeImageUrl: string;
  loungeImageAlt: string;
  loungeFeatures: NocturnalFeature[];
  menuSectionTitle: string;
  menuSectionSubtitle: string;
  menuItems: MenuItem[];
}

export type LoadingState = 'idle' | 'loading' | 'error';

export interface StitchContainerNew1Props {
  data?: ContainerCafeData;
  loadingState?: LoadingState;
  errorMessage?: string;
  onReservation?: () => void;
  onExploreMenu?: () => void;
  onViewSpace?: () => void;
  onMenuItemClick?: (itemId: string) => void;
}

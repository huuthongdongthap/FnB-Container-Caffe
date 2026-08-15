/**
 * Types for StitchGalleryNew component
 */

export type FilterId = 'all' | 'industrial' | 'luxury' | 'tech';

export interface GalleryItem {
  id: string;
  label: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
  filter: FilterId;
}

export interface StitchGalleryNewProps {
  items?: GalleryItem[];
  onItemClick?: (itemId: string) => void;
  onLoadMore?: () => void;
}

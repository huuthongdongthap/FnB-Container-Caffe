/**
 * Default gallery items and filter options for StitchGalleryNew
 */

import type { FilterId, GalleryItem } from './StitchGalleryNew-types';

export const defaultItems: GalleryItem[] = [
  {
    id: 'precision-pos',
    label: 'MODULE 01',
    title: 'PRECISION POS',
    filter: 'tech',
    imageUrl:
      '/photos/IMG_6693.webp',
    imageAlt: 'A moody architectural detail shot of a modular industrial cafe POS terminal system',
  },
  {
    id: 'kinetic-kitchen',
    label: 'MODULE 02',
    title: 'KINETIC KITCHEN',
    filter: 'industrial',
    imageUrl:
      '/photos/IMG_6694.webp',
    imageAlt: 'A dramatic wide shot of a kinetic open kitchen layout with brushed chrome surfaces and warm bronze hood lighting',
  },
  {
    id: 'nocturnal-loyalty',
    label: 'MODULE 03',
    title: 'NOCTURNAL LOYALTY',
    filter: 'luxury',
    imageUrl:
      '/photos/IMG_6697.webp',
    imageAlt: 'An elegant nocturnal loyalty program interface displayed on a sleek tablet surrounded by dark navy velvet textures',
  },
  {
    id: 'atmospheric-grid',
    label: 'MODULE 04',
    title: 'ATMOSPHERIC GRID',
    filter: 'tech',
    imageUrl:
      '/photos/IMG_6565.webp',
    imageAlt: 'An abstract atmospheric grid visualization showing ambient cafe sensor data rendered in bronze and navy tones',
  },
];

export const filterOptions: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'industrial', label: 'INDUSTRIAL' },
  { id: 'luxury', label: 'LUXURY' },
  { id: 'tech', label: 'TECH' },
];

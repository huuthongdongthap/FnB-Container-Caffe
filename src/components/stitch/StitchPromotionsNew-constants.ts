/**
 * Default data for StitchPromotionsNew component.
 */
import type { PromoOffer } from './StitchPromotionsNew-types';

export const defaultHero: PromoOffer = {
  id: 'hero',
  title: 'The Nocturnal Reserve',
  description:
    'Experience the depth of our signature dark roast. 20% off all signature brews for a limited time.',
  imageUrl:
    '/photos/IMG_6702.webp',
  imageAlt:
    'A moody, high-contrast close-up of a premium espresso machine portafilter dispensing a rich, dark crema espresso',
  badge: { label: 'Limited Release', variant: 'default' },
};

export const defaultOffers: PromoOffer[] = [
  {
    id: 'golden-hour',
    title: 'Golden Hour Ritual',
    description:
      '2-for-1 on all cold brews during the final hour of service.',
    imageUrl:
      '/photos/IMG_6556-frame.webp',
    imageAlt:
      'Two glasses of chilled nitro cold brew coffee on a brushed metal counter',
    badge: { label: 'Active', variant: 'default' },
    schedule: 'DAILY 8PM - 9PM',
  },
  {
    id: 'inner-circle',
    title: 'Inner Circle Exclusive',
    description:
      '15% off artisanal pastries for our Inner Circle members.',
    imageUrl:
      '/photos/IMG_6699.webp',
    imageAlt:
      'A selection of artisanal pastries arranged on a sleek black slate tray',
    badge: { label: 'Exclusive', variant: 'glass' },
    isLocked: true,
  },
  {
    id: 'weekend-solace',
    title: 'Weekend Solace',
    description:
      'Receive a complimentary chrome-plated vessel with all bulk bean purchases this weekend only.',
    imageUrl:
      '/photos/IMG_6696.webp',
    imageAlt:
      'A sleek, minimalist chrome-plated reusable coffee vessel on a dark industrial surface',
    badge: { label: 'Limited', variant: 'default' },
    tags: ['CHROME SERIES', 'LIMITED STOCK'],
    cta: 'Details',
  },
];

/**
 * Default menu data and category definitions for AURA CAFE mobile ordering.
 */
import type { MenuItem } from './StitchMobileOrderNew-types';

export const DEFAULT_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Midnight Espresso',
    description: 'Double shot of reserve beans, notes of dark cocoa and star anise.',
    price: 6.5,
    priceLabel: '$6.50',
    category: 'coffee',
    badge: 'Signature',
    featured: true,
    imageSrc:
      '/photos/IMG_6581.webp',
    imageAlt:
      'Cinematic close-up of a Midnight Espresso in a minimalist glass cup against a dark industrial cafe background with subtle blue neon accents',
  },
  {
    id: '2',
    name: 'Chrome Velvet Latte',
    description: 'Silky texture with a hint of vanilla and silver-dusted topping.',
    price: 7.25,
    priceLabel: '$7.25',
    category: 'coffee',
    featured: true,
    imageSrc:
      '/photos/IMG_6554-frame.webp',
    imageAlt:
      'Premium Chrome Velvet Latte with intricate latte art in a textured ceramic mug set against metallic silver and navy blue accents',
  },
  {
    id: '3',
    name: 'Smoky Amber Cold Brew',
    description: '18-hour cold steeped with smoked cedar infusion.',
    price: 8.0,
    priceLabel: '$8.00',
    category: 'cold-brew',
    badge: 'Signature',
    imageSrc:
      '/photos/IMG_6555-frame.webp',
    imageAlt:
      'Sophisticated presentation of a Smoky Amber Cold Brew in a tall crystal glass with large clear ice spheres against blurred high-end lounge background',
  },
  {
    id: '4',
    name: 'Jasmine Pearl Tea',
    description: 'Hand-rolled jasmine pearls steeped to perfection.',
    price: 5.5,
    priceLabel: '$5.50',
    category: 'tea',
    imageSrc:
      '/photos/IMG_6564.webp',
    imageAlt:
      'Delicate jasmine pearl tea in a clear glass teapot with steam rising against a warm ambient background',
  },
  {
    id: '5',
    name: 'Golden Turmeric Latte',
    description: 'Plant-based golden milk with ginger, honey, and black pepper.',
    price: 6.75,
    priceLabel: '$6.75',
    category: 'signature',
    badge: 'Signature',
    featured: true,
    imageSrc:
      '/photos/IMG_6693.webp',
    imageAlt:
      'Vibrant golden turmeric latte in a ceramic cup with artistic foam pattern on a dark wooden surface',
  },
];

export const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'tea', label: 'Tea' },
  { key: 'signature', label: 'Signature' },
  { key: 'cold-brew', label: 'Cold Brew' },
] as const;

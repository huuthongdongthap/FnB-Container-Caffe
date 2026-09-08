import { MenuItem2Data, CategoryData } from './StitchMenu2New-types';

export const DEFAULT_ITEMS: MenuItem2Data[] = [
  {
    id: '1',
    name: 'Midnight Espresso',
    description: 'Double-shot ristretto, obsidian blend with notes of dark chocolate and smoke.',
    price: '$6.50',
    imageSrc:
      '/photos/IMG_6555-frame.webp',
    imageAlt:
      'A moody high-contrast photograph of a rich dark espresso shot being poured into a heavy obsidian ceramic cup with tiny golden crema bubbles on top',
    category: 'coffee',
    badge: 'Featured',
    gaugeLabel: 'Intensity',
    gaugeValue: 9,
  },
  {
    id: '2',
    name: 'Chrome Velvet Latte',
    description: 'Charcoal-infused micro-foam, Madagascar vanilla, and velvet-texture espresso.',
    price: '$8.00',
    imageSrc:
      '/photos/IMG_6564.webp',
    imageAlt:
      'A sophisticated latte in a clear glass cup showing distinct layers of charcoal-infused grey milk and rich espresso with a geometric foam pattern on top',
    category: 'coffee',
    gaugeLabel: 'Sweetness',
    gaugeValue: 4,
  },
  {
    id: '3',
    name: 'Industrial Cold Brew',
    description: '24-hour slow drip through stainless steel filtration. Served over a single crystal sphere.',
    price: '$7.50',
    imageSrc:
      '/photos/IMG_6693.webp',
    imageAlt:
      'A minimalist glass carafe filled with deep amber-colored cold brew coffee beside a glass with a single large clear ice sphere on brushed aluminum surface',
    category: 'cold-brew',
    gaugeLabel: 'Caffeine',
    gaugeValue: 10,
  },
  {
    id: '4',
    name: 'Bronze Chai',
    description: 'Hand-ground spices, local wild honey, and premium black tea steeped for 8 minutes.',
    price: '$7.00',
    imageSrc:
      '/photos/IMG_6694.webp',
    imageAlt:
      'A warm creamy chai latte in a rustic bronze-colored mug with steam rising, cinnamon sticks and star anise scattered on a dark slate surface',
    category: 'tea',
    gaugeLabel: 'Spice Level',
    gaugeValue: 7,
  },
];

export const CATEGORIES: CategoryData[] = [
  { key: 'all', label: 'All' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'tea', label: 'Tea' },
  { key: 'signature', label: 'Signature' },
  { key: 'cold-brew', label: 'Cold Brew' },
];

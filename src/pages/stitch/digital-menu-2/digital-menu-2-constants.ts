import type { FilterBtn, MenuItem } from './digital-menu-2-types';

export const FILTERS: readonly FilterBtn[] = [
  { label: 'All', active: true },
  { label: 'Coffee' },
  { label: 'Tea' },
  { label: 'Signature' },
  { label: 'Cold Brew' },
] as const;

export const MENU_ITEMS: readonly MenuItem[] = [
  {
    title: 'Midnight Espresso',
    subtitle: 'Double-shot ristretto, obsidian blend with notes of dark chocolate and smoke.',
    price: '$6.50',
    image: '/photos/IMG_6555-frame.webp',
    imageAlt: 'Moody high-contrast photograph of a dark espresso shot poured into an obsidian ceramic cup. Golden crema bubbles on top. Dark industrial coffee bar with chrome accents and dim warm lighting. Deep navy and bronze tones.',
    tag: 'Featured',
    metric: { label: 'Intensity', value: '9/10', pct: 90 },
  },
  {
    title: 'Chrome Velvet Latte',
    subtitle: 'Charcoal-infused micro-foam, Madagascar vanilla, and velvet-texture espresso.',
    price: '$8.00',
    image: '/photos/IMG_6564.webp',
    imageAlt: 'Sophisticated latte in a clear glass cup showing distinct layers of charcoal-infused grey milk and rich espresso. Foam decorated with geometric patterns. Polished stainless steel surface reflecting soft blue and silver light.',
    metric: { label: 'Sweetness', value: '4/10', pct: 40 },
  },
  {
    title: 'Industrial Cold Brew',
    subtitle: '24-hour slow drip through stainless steel filtration. Served over a single crystal sphere.',
    price: '$7.50',
    image: '/photos/IMG_6693.webp',
    imageAlt: 'Minimalist glass carafe filled with deep amber cold brew next to a glass with a large clear ice sphere. Laboratory-like environment with brushed aluminum textures. Cool navy and silver palette.',
    metric: { label: 'Caffeine', value: '10/10', pct: 100 },
  },
  {
    title: 'Bronze Chai',
    subtitle: 'Hand-ground spices, local wild honey, and premium black tea steeped for 8 minutes.',
    price: '$7.00',
    image: '/photos/IMG_6694.webp',
    imageAlt: 'Warm atmospheric shot of a creamy chai latte in a rustic refined bronze-colored mug. Steam rises in elegant curls. Hand-ground spices scattered on a dark slate surface. Rich brown, gold, deep navy tones.',
    metric: { label: 'Spice Level', value: '7/10', pct: 70 },
  },
] as const;

export const NAV_LINKS = [
  { label: 'Menu', href: '#menu' },
  { label: 'Reservation', href: '#reservation' },
  { label: 'Location', href: '#location' },
  { label: 'About', href: '#about' },
] as const;

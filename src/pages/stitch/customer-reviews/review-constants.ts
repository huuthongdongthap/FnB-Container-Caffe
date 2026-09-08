import type { Review } from './review-types';

export const FILTERS = ['All', '5 Star', 'Photo', 'Latest'] as const;

export const REVIEWS: Review[] = [
  {
    name: 'Isabella Vane',
    initials: 'IV',
    date: 'Oct 14, 2023',
    rating: 5,
    text: '"The midnight espresso selection is unparalleled. The industrial architecture of the space creates a cocoon of luxury that makes every visit feel like a secret ritual. The texture of the velvet seating against the cold steel is pure sensory genius."',
    likes: 42,
    isChefsChoice: true,
    photos: [
      '/photos/IMG_6565.webp',
      '/photos/IMG_6566.webp',
    ],
  },
  {
    name: 'Julian Thorne',
    initials: 'JT',
    date: 'Oct 12, 2023',
    rating: 4,
    text: 'A masterclass in atmosphere. The lighting design alone is worth the reservation. Perfect for late-night meetings where privacy and aesthetics are paramount.',
    likes: 18,
    photos: [
      '/photos/IMG_6556-frame.webp',
    ],
  },
  {
    name: 'Sienna Ray',
    initials: 'SR',
    date: 'Oct 09, 2023',
    rating: 5,
    text: 'The smoked truffle croissant is a revelation. I\'ve never seen such attention to detail in cafe service. It feels more like a private lounge than a cafe.',
    likes: 24,
  },
  {
    name: 'Marcus Sterling',
    initials: 'MS',
    date: 'Oct 05, 2023',
    rating: 5,
    text: 'Aura provides the precision I require. Quiet, dark, and perfectly balanced. The architecture speaks to a forgotten era of high-end craftsmanship.',
    likes: 12,
  },
  {
    name: 'Leo Chen',
    initials: 'LC',
    date: 'Sep 28, 2023',
    rating: 5,
    text: 'Unreal aesthetics. Every corner is a photograph waiting to happen. The Dark Velvet latte is a must-try.',
    likes: 89,
    photos: [
      '/photos/IMG_6703.webp',
    ],
  },
  {
    name: 'Elena K.',
    initials: 'EK',
    date: 'Sep 25, 2023',
    rating: 4,
    text: 'The acoustic dampening here is incredible. Even when full, it maintains this serene, heavy silence that is so rare in the city.',
    likes: 5,
  },
] as const;

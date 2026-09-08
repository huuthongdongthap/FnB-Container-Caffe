import type { EventItem, ArchiveItem } from './events-promotions-2-types';

/* ── Data ─────────────────────────────────────────────────────────────── */

export const MONTHS = ['OCT', 'NOV', 'DEC', 'JAN'] as const;

export const EVENTS: readonly EventItem[] = [
  {
    id: 1,
    date: 'OCT 14',
    title: 'Aura Mixology Masterclass',
    description:
      'Uncover the secrets behind our signature nocturnal infusions with our lead mixologist.',
    time: '19:00 - 21:00',
    timeIcon: '🕐',
    tag: 'WORKSHOP',
    image:
      '/photos/IMG_6702.webp',
    alt: 'Cocktail preparation in dark industrial bar with dry ice vapor in crystal coupe glass',
  },
  {
    id: 2,
    date: 'OCT 21',
    title: 'Industrial Degustation',
    description:
      'A curated 7-course culinary journey inspired by raw industrial elements and rare botanicals.',
    time: 'VIP LOUNGE',
    timeIcon: '🍽️',
    tag: 'DINING',
    image:
      '/photos/IMG_6556-frame.webp',
    alt: 'Exclusive tasting menu set on dark charcoal stone table in industrial loft',
  },
  {
    id: 3,
    date: 'OCT 28',
    title: 'Echoes: Digital Art Night',
    description:
      'A sensory immersion combining generative digital art with experimental electronic soundscapes.',
    time: '22:00 - LATE',
    timeIcon: '🎫',
    tag: 'EXHIBITION',
    image:
      '/photos/IMG_6699.webp',
    alt: 'Private art gallery with digital art neon glow on polished dark floor during nocturnal exhibition',
  },
] as const;

export const ARCHIVES: readonly ArchiveItem[] = [
  {
    title: 'Vinyl & Cognac',
    month: 'SEPTEMBER',
    image:
      '/photos/IMG_6696.webp',
  },
  {
    title: 'Velvet Cinema Night',
    month: 'SEPTEMBER',
    image:
      '/photos/IMG_6698.webp',
  },
  {
    title: 'Cyber-Lounge Launch',
    month: 'AUGUST',
    image:
      '/photos/IMG_6703.webp',
  },
] as const;

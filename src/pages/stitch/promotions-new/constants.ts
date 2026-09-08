import type { CardOffer } from './types';

export const OFFERS: CardOffer[] = [
  {
    id: 1,
    badge: 'Limited Release',
    title: 'The Nocturnal Reserve',
    desc: 'Experience the depth of our signature dark roast. 20% off all signature brews for a limited time.',
    image: '/photos/IMG_6554-frame.webp',
  },
  {
    id: 2,
    badge: 'ACTIVE',
    title: 'Golden Hour Ritual',
    desc: '2-for-1 on all cold brews during the final hour of service.',
    image: '/photos/IMG_6556-frame.webp',
    iconAfter: '📍',
    tag: 'DAILY 8PM - 9PM',
  },
  {
    id: 3,
    badge: 'EXCLUSIVE',
    title: 'Inner Circle Exclusive',
    desc: '15% off artisanal pastries for our Inner Circle members.',
    image: '/photos/IMG_6699.webp',
    iconAfter: '🔒',
    tag: 'MEMBERS ONLY',
  },
  {
    id: 4,
    badge: '',
    title: 'Weekend Solace',
    desc: 'Receive a complimentary chrome-plated vessel with all bulk bean purchases this weekend only.',
    image: '/photos/IMG_6696.webp',
    isFullWidth: true,
    btnLabel: 'Details',
  },
];

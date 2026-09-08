export interface NavItem {
  readonly label: string;
  readonly href: string;
}

export interface Promotion {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly cta: string;
  readonly image: string;
}

export interface Event {
  readonly month: string;
  readonly day: string;
  readonly title: string;
  readonly time: string;
  readonly status: string;
  readonly action: 'add' | 'close';
  readonly disabled: boolean;
}

/* ── Data ─────────────────────────────────────────────────────────────── */

export const NAV_LINKS: readonly NavItem[] = [
  { label: 'Vessels', href: '#vessels' },
  { label: 'Events', href: '#events' },
  { label: 'Journal', href: '#journal' },
  { label: 'Location', href: '#location' },
];

export const PROMOTIONS: readonly Promotion[] = [
  {
    id: 'golden-hour',
    label: 'Promotion',
    title: 'Golden Hour',
    description:
      'Half-price signature brews from 4:00 PM to 6:00 PM. A transition from day to dusk.',
    cta: 'Details',
    image: '/photos/IMG_6696.webp',
  },
  {
    id: 'bean-craft',
    label: 'Workshop',
    title: 'Bean Craft Workshop',
    description:
      'Monthly cupping sessions exploring single-origin profiles and technical brewing methods.',
    cta: 'Reserve Seat',
    image: '/photos/IMG_6698.webp',
  },
  {
    id: 'midnight-jazz',
    label: 'Live Performance',
    title: 'Midnight Jazz',
    description:
      'Immersive live sets starting at 10:00 PM. Dark tones for the late-night observer.',
    cta: 'View Lineup',
    image: '/photos/IMG_6703.webp',
  },
];

export const EVENTS: readonly Event[] = [
  {
    month: 'OCT',
    day: '14',
    title: 'Cold Brew Chemistry',
    time: '7:00 PM — 9:00 PM',
    status: 'Limited Capacity',
    action: 'add',
    disabled: false,
  },
  {
    month: 'OCT',
    day: '21',
    title: 'The Blue Note Collective',
    time: '10:00 PM — 1:00 AM',
    status: 'Sold Out',
    action: 'close',
    disabled: true,
  },
  {
    month: 'OCT',
    day: '28',
    title: 'Single Origin Symposium',
    time: '6:00 PM — 8:00 PM',
    status: '8 Spots Left',
    action: 'add',
    disabled: false,
  },
];

export const FOOTER_CONNECT = ['Instagram', 'Spotify Playlist', 'Contact'] as const;

export const FOOTER_LEGAL = ['Terms of Service', 'Privacy Policy', 'Sustainability'] as const;

export const actionIcon = (action: string) => {
  if (action === 'add') return '+';
  if (action === 'close') return '✕';
  return '';
};

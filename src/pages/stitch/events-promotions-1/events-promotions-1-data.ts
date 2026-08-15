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
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAm3VcyJQVXnfbrL2pi1TM6GVGawTaENyJSeAN4enTNuUnfB2TmqN-2Wz3XWYNWRtMzFBgPxW1J5SkkbIuzltOxCkvrsEoisR4rqq7bUykFeCMprxT7E7_0ccP5-S56sTMKkvKitGo47vT_KgZEhSX-h_NE9s3cAVSM801J8vHO0_o7EVkZN3FvT7_YJBcR8xVBP5v3Ah-OxgQIVyraUnnIHiJ10sz38lwaojq6yTg16Db_Lw1RtX1kTi3lKTK5-96WtkEaSqMfnjI',
  },
  {
    id: 'bean-craft',
    label: 'Workshop',
    title: 'Bean Craft Workshop',
    description:
      'Monthly cupping sessions exploring single-origin profiles and technical brewing methods.',
    cta: 'Reserve Seat',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCEM9xvKBOCwsH1fGEEPUsrO2fXD6WzF3rs_Wel972P79cE5qUXKZ1sz7X7mLSYXF-vVdxF9KfCwGUH4G7SEMJDy9DRxhk2p7zGoWBz8Rj7jCeb3q9PVKIK_Jh1WUXJf4lIysyr6uMU2kgJkNG4J_FNCyZoNBIYhP5nt7dxTA8vgm0YCmijJ1DZNfBmkN9HZNjvMIysgfxwzGc6BD7zJ6CGm-gASrY02URP0KUVbDnU_MvRSbTsMpmbY6kSMj-2AFdYhszlfSMT2U8',
  },
  {
    id: 'midnight-jazz',
    label: 'Live Performance',
    title: 'Midnight Jazz',
    description:
      'Immersive live sets starting at 10:00 PM. Dark tones for the late-night observer.',
    cta: 'View Lineup',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDdl4TPNPqDmqsr7ahmEfsxFKyyXQSHuugMuxDecD9et__KiRCpFXjtxuwVglaUCo0P0BoqwQ2TOyHFinoND10WlG2_mAH18gMJGoM2J9GQ1BH9ed-0JKy4LMQVFDxo0x7Rk6fh6aNPOYCU31rJvVuxco8oBYXdlfeX60Udp4Aduw5myJW-nLqI3LdTzJNrbmdF8DDHVXamcIclCkjsuwTpyExpk1yyTvGO5kthwU4KQyL7ZWuXDdZp3MZqEPGeckhje0Svf_Ci2Ik',
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

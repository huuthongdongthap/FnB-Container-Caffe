/**
 * Default page data factory for StitchEventsNew2.
 * Extracted from StitchEventsNew2.tsx to keep individual files under 200 LOC.
 * Uses i18n translations for all user-facing strings.
 */

import type { EventsNew2PageData } from './StitchEventsNew2-types';

/**
 * Creates default page data with i18n-translated strings.
 * Must be called inside a component context where useTranslation is available.
 */
export function createDefaultEventsData(t: (key: string, options?: unknown) => string): EventsNew2PageData {
  return {
    heroTag: t('events.featured'),
    heroTitle: t('events.defaultTitle'),
    heroDescription: t('events.defaultDescription'),
    heroImageUrl:
      '/photos/IMG_6566.webp',
    heroImageAlt: t('events.heroAriaLabel'),
    navLinks: [
      { key: 'menu', label: t('nav.menu'), href: '#', active: false },
      { key: 'events', label: t('nav.events'), href: '#', active: true },
      { key: 'reservations', label: t('nav.reservations'), href: '#', active: false },
      { key: 'location', label: t('nav.spaces'), href: '#', active: false },
    ],
    filterMonths: [
      { key: 'oct', label: t('eventsNew2.monthOct') },
      { key: 'nov', label: t('eventsNew2.monthNov') },
      { key: 'dec', label: t('eventsNew2.monthDec') },
      { key: 'jan', label: t('eventsNew2.monthJan') },
    ],
    featuredEvents: [
      {
        id: 'mixology-masterclass',
        dateLabel: 'OCT 14',
        title: t('eventsNew2.mixologyTitle'),
        description: t('eventsNew2.mixologyDesc'),
        metaIcon: 'schedule',
        metaLabel: '19:00 - 21:00',
        imageUrl:
          '/photos/IMG_6702.webp',
        imageAlt: t('eventsNew2.mixologyImageAlt'),
      },
      {
        id: 'industrial-degustation',
        dateLabel: 'OCT 21',
        title: t('eventsNew2.degustationTitle'),
        description: t('eventsNew2.degustationDesc'),
        metaIcon: 'restaurant',
        metaLabel: 'VIP LOUNGE',
        imageUrl:
          '/photos/IMG_6556-frame.webp',
        imageAlt: t('eventsNew2.degustationImageAlt'),
      },
      {
        id: 'digital-art-night',
        dateLabel: 'OCT 28',
        title: t('eventsNew2.digitalArtTitle'),
        description: t('eventsNew2.digitalArtDesc'),
        metaIcon: 'ticket',
        metaLabel: '22:00 - LATE',
        imageUrl:
          '/photos/IMG_6699.webp',
        imageAlt: t('eventsNew2.digitalArtImageAlt'),
      },
    ],
    pastArchives: [
      {
        id: 'vinyl-cognac',
        monthLabel: t('eventsNew2.monthSeptember'),
        title: t('eventsNew2.vinylTitle'),
        imageUrl:
          '/photos/IMG_6696.webp',
        imageAlt: t('eventsNew2.vinylImageAlt'),
      },
      {
        id: 'velvet-cinema',
        monthLabel: t('eventsNew2.monthSeptember'),
        title: t('eventsNew2.velvetTitle'),
        imageUrl:
          '/photos/IMG_6698.webp',
        imageAlt: t('eventsNew2.velvetImageAlt'),
      },
      {
        id: 'cyber-lounge',
        monthLabel: t('eventsNew2.monthAugust'),
        title: t('eventsNew2.cyberLoungeTitle'),
        imageUrl:
          '/photos/IMG_6703.webp',
        imageAlt: t('eventsNew2.cyberLoungeImageAlt'),
      },
    ],
    footerLinks: [
      { key: 'privacy', label: t('common.privacyPolicy'), href: '#' },
      { key: 'terms', label: t('common.termsOfService'), href: '#' },
      { key: 'contact', label: t('common.contactUs'), href: '#' },
    ],
    copyright: t('eventsNew2.copyright', { year: new Date().getFullYear() }),
  };
}

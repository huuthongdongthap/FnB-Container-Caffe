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
export function createDefaultEventsData(t: (key: string, options?: Record<string, unknown>) => string): EventsNew2PageData {
  return {
    heroTag: t('events.featured'),
    heroTitle: t('events.defaultTitle'),
    heroDescription: t('events.defaultDescription'),
    heroImageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDlmjmyOnjgZOt4V18ClaqGfhQ_r0HMirAh8VM5O_hIQ1sTpZ6oosG3oDxnhFsFugi2q5EerPpl5lfFhl1NSUJJTiW1Q-XbjjbyMy0AUccp-uZBZO0pRf9purCQ7jAci8IPzR-Wkh2N9pmD-AGIgTt2T3O3d5qel--M4Myq4EIDioeuEHRxz6mOhiyiJzIppQlKa7MoXQzCTZVkZznyFTcalEDKgDLqr0rZnZzzDfu8t1vXTQVpYBenN1RVPicJCT3rFq9QShz7W_U',
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
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDArV05s4bg-ehkkouTASvhXigAIWBNNSiyeh-2aXFy9_I0YIX9dby9vcSBVh96T_sg_RZU6yFsm9-siWe_MMgo0JUUrMK55O8VKw0lDGdjJ9tYHmG3ehmjpGI74JAEsNmhuIVbkJ7SwECnMGsD27WAd9DOT0mgNzOjAZYh-uvMSWnXdg9Iqh_tH6pNc-9ssvd2n7hQA02-azKO4qRrtKx0KMvcKRGqxs6qRDa9qd2SFD-yV_3y2aiJAZzvuOIiJzSIac6-A4lEwvQ',
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
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDyQt6Cr8A_YQeCu9rB_g3rAlg8eYTXwHYBfACraXep5zt6-32Eoz7rnP4w__MYoAFekQVuduS8aBoLFTUecWLwA83wIsD0F1zCbx0DXwhJQD0Qw0ySZSJizG99tABqtCs7rkiV3dB8h-AX0tGSBtMKtpWBVgHqWKSqf48zgbA0IWjUD-0iXfCjEs8AwDRs4mTgFrYyENpfb9izSzC_hnNnP8tqCjYJX_XWfVHO1EjZZYjz7eOcH3VshbxXfhG4IWrqhOugzn5CGHE',
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
          'https://lh3.googleusercontent.com/aida-public/AB6AXuBtLIALh8AfaCbn2IG6TIK4CG3C78jLtLkUXrI0NNm-afGt0U_jML5W4A_KifeTUgb524UhXEtevHjgxko8a0zt-FXmBAb1nFk-NK6bfGVg7P1o_hmkSNnnPto3YvtVKioTGTDYYjC9W0y1egUQU5sKJBdl8dwuMTNCydjT0jlWgAbUji7U0VCtgkdaXGPbPaupTcLu1GabqjwX7KFQdwDKQbrWakY_gpkWSVFKhe_FwkqI3P2FP3XBa3MC95tP2Iel_Yeg0rMnsjs',
        imageAlt: t('eventsNew2.digitalArtImageAlt'),
      },
    ],
    pastArchives: [
      {
        id: 'vinyl-cognac',
        monthLabel: t('eventsNew2.monthSeptember'),
        title: t('eventsNew2.vinylTitle'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuD4aLtsQZNIKe4bt9ny41tokhubrryL9ufhaItSy79jiR2doe4ycWGXZYxE_gyzLOXL7cELCtna355cSaxXlVjxcOaCZqLe4lmwwgnTT0UvHL0VuEfhciwsMfvgp3EXjRjV_1ZhxptyX6ohcapEKgNmQZVUqDK9mwnzAc6dicwRvHtZYVejgq-Hgj1X-e28e5ZbAax6uyAUtkYZS2-ZJ5VJmdBBMFxX3WcgbvUiCC7KTjpDaLHNoccr1YIBCMn-gObDgFJ-lxrUvQE',
        imageAlt: t('eventsNew2.vinylImageAlt'),
      },
      {
        id: 'velvet-cinema',
        monthLabel: t('eventsNew2.monthSeptember'),
        title: t('eventsNew2.velvetTitle'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCRwUZrKfKMQBMJ7_27QmlHYjUbgt-a-4kVShwRVD3QZ8EIsV4xBmNNknl6jraXFMF_ml-p11DJjUFeqU4sNBtexaW8yvKzt33S7YUhRiAi_QBC-zjzbcaD_2-lWKQUK-9d3LxyThr3i6S3oQ0o2FNjgyaz75tpVqJqenIXmVRWE4wKnlY0M7hP-YYU6cHnXEGLScM-ffP9IONGT98newMgqvFn1qZrmqzhJ8VScExyf4g8pf4TRK0qAc6HfFzMMmmgOGQgKLWOC2s',
        imageAlt: t('eventsNew2.velvetImageAlt'),
      },
      {
        id: 'cyber-lounge',
        monthLabel: t('eventsNew2.monthAugust'),
        title: t('eventsNew2.cyberLoungeTitle'),
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCS9SO54RS39npGil7TyjXO-nRFBFK1aow6IbtiI6lSE5pNXh9eyUXAzrn3AV7FYiRDeAWbcTbKvErPQnSTHCsG0xmeixmh_u8Sr4j362AjWRlFCd2voHtefnbJVcsswsSFgmrjDlG3hNq84NtpyvMkCtVF6Q5bIxzKmeWJSY6s2AInaV5Qahn7eUxEt5j24bZhkneZs_z5L0UPMEHqZO4bullFoQbEghq1DdozmZ_ZkzUkyUIzVOjhyIPVEg9OgxDJdZZ8n_pGmbI',
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

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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDArV05s4bg-ehkkouTASvhXigAIWBNNSiyeh-2aXFy9_I0YIX9dby9vcSBVh96T_sg_RZU6yFsm9-siWe_MMgo0JUUrMK55O8VKw0lDGdjJ9tYHmG3ehmjpGI74JAEsNmhuIVbkJ7SwECnMGsD27WAd9DOT0mgNzOjAZYh-uvMSWnXdg9Iqh_tH6pNc-9ssvd2n7hQA02-azKO4qRrtKx0KMvcKRGqxs6qRDa9qd2SFD-yV_3y2aiJAZzvuOIiJzSIac6-A4lEwvQ',
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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDyQt6Cr8A_YQeCu9rB_g3rAlg8eYTXwHYBfACraXep5zt6-32Eoz7rnP4w__MYoAFekQVuduS8aBoLFTUecWLwA83wIsD0F1zCbx0DXwhJQD0Qw0ySZSJizG99tABqtCs7rkiV3dB8h-AX0tGSBtMKtpWBVgHqWKSqf48zgbA0IWjUD-0iXfCjEs8AwDRs4mTgFrYyENpfb9izSzC_hnNnP8tqCjYJX_XWfVHO1EjZZYjz7eOcH3VshbxXfhG4IWrqhOugzn5CGHE',
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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBtLIALh8AfaCbn2IG6TIK4CG3C78jLtLkUXrI0NNm-afGt0U_jML5W4A_KifeTUgb524UhXEtevHjgxko8a0zt-FXmBAb1nFk-NK6bfGVg7P1o_hmkSNnnPto3YvtVKioTGTDYYjC9W0y1egUQU5sKJBdl8dwuMTNCydjT0jlWgAbUji7U0VCtgkdaXGPbPaupTcLu1GabqjwX7KFQdwDKQbrWakY_gpkWSVFKhe_FwkqI3P2FP3XBa3MC95tP2Iel_Yeg0rMnsjs',
    alt: 'Private art gallery with digital art neon glow on polished dark floor during nocturnal exhibition',
  },
] as const;

export const ARCHIVES: readonly ArchiveItem[] = [
  {
    title: 'Vinyl & Cognac',
    month: 'SEPTEMBER',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD4aLtsQZNIKe4bt9ny41tokhubrryL9ufhaItSy79jiR2doe4ycWGXZYxE_gyzLOXL7cELCtna355cSaxXlVjxcOaCZqLe4lmwwgnTT0UvHL0VuEfhciwsMfvgp3EXjRjV_1ZhxptyX6ohcapEKgNmQZVUqDK9mwnzAc6dicwRvHtZYVejgq-Hgj1X-e28e5ZbAax6uyAUtkYZS2-ZJ5VJmdBBMFxX3WcgbvUiCC7KTjpDaLHNoccr1YIBCMn-gObDgFJ-lxrUvQE',
  },
  {
    title: 'Velvet Cinema Night',
    month: 'SEPTEMBER',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCRwUZrKfKMQBMJ7_27QmlHYjUbgt-a-4kVShwRVD3QZ8EIsV4xBmNNknl6jraXFMF_ml-p11DJjUFeqU4sNBtexaW8yvKzt33S7YUhRiAi_QBC-zjzbcaD_2-lWKQUK-9d3LxyThr3i6S3oQ0o2FNjgyaz75tpVqJqenIXmVRWE4wKnlY0M7hP-YYU6cHnXEGLScM-ffP9IONGT98newMgqvFn1qZrmqzhJ8VScExyf4g8pf4TRK0qAc6HfFzMMmmgOGQgKLWOC2s',
  },
  {
    title: 'Cyber-Lounge Launch',
    month: 'AUGUST',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCS9SO54RS39npGil7TyjXO-nRFBFK1aow6IbtiI6lSE5pNXh9eyUXAzrn3AV7FYiRDeAWbcTbKvErPQnSTHCsG0xmeixmh_u8Sr4j362AjWRlFCd2voHtefnbJVcsswsSFgmrjDlG3hNq84NtpyvMkCtVF6Q5bIxzKmeWJSY6s2AInaV5Qahn7eUxEt5j24bZhkneZs_z5L0UPMEHqZO4bullFoQbEghq1DdozmZ_ZkzUkyUIzVOjhyIPVEg9OgxDJdZZ8n_pGmbI',
  },
] as const;

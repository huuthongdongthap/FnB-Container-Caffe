/**
 * Default data for StitchPromotionsNew component.
 */
import type { PromoOffer } from './StitchPromotionsNew-types';

export const defaultHero: PromoOffer = {
  id: 'hero',
  title: 'The Nocturnal Reserve',
  description:
    'Experience the depth of our signature dark roast. 20% off all signature brews for a limited time.',
  imageUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBXZc7z3nQmqBI7wSM2YrEtK1XTa5i0dvuhUMsh5rfegDYqwjttjsQO9GT17jSAne54AnoItLlzu_Ud88YY3JeZtgF5mnAOtYtcbyd-X3bOZ5rhyYwZvSE5AfUp1egeyWWm7OdELUfAtyxsw3mwr9WLu7MSzU43wlPjirTR7933KNwj9l61kJ0IseGLXYCYqdneq1DIqHgdN_CQzzWKDxMlicX-L6ZYAj328cMZnw_VCTd1Kebp5CZA27o7xpxFhJH6BqiQbdh7c8w',
  imageAlt:
    'A moody, high-contrast close-up of a premium espresso machine portafilter dispensing a rich, dark crema espresso',
  badge: { label: 'Limited Release', variant: 'default' },
};

export const defaultOffers: PromoOffer[] = [
  {
    id: 'golden-hour',
    title: 'Golden Hour Ritual',
    description:
      '2-for-1 on all cold brews during the final hour of service.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBbz03dO05LEHW8M7oOjgzUtUMuj1i6D2gS_stoSDAmOWc9sH6WACJ2JrzKsHIzyRcGZKOHtssAbhshucUIBuCuUU9r7pMKyE7He-K10RAgHSSK0HTlEaUIQAuXRgp6uwrCIV4-FThy2vj8lq8e4V4vbENn5_ywgyxSdEA1NOj4pX6ZvqGyt92CbtI-nfWioIQEmkZvVMN0wU-WyF6rvMWJOeA_-p05SY0znfSB6KhtDAn0Y_cGy1P5q4iUDBHgNfxSdQ-tm7WdOTM',
    imageAlt:
      'Two glasses of chilled nitro cold brew coffee on a brushed metal counter',
    badge: { label: 'Active', variant: 'default' },
    schedule: 'DAILY 8PM - 9PM',
  },
  {
    id: 'inner-circle',
    title: 'Inner Circle Exclusive',
    description:
      '15% off artisanal pastries for our Inner Circle members.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBO9jQXkMZApig7yiTKPXWTtp9c4wtV486LyQu8ryem0dlXjYwvnH__gC5P22OJ7MRJXYh-plld-3gzvdP0uOwJMn1mTq9D1e4AhDQ8ict72nmNEf2mNQB3iLKUUfUPGA_k5FgvXgyAcIbhmrvyMTaslf8YvnGIHJU_nrzPo3mslDSwH0wwrVHdJ1DX0OTp5tAw4m5gnhgAaEWpLowE3J5YRuaDmonae_6rDq2YFHE6t6mBCr3EEDzMh-HC4j28k2jJCuG5I7XYrn8',
    imageAlt:
      'A selection of artisanal pastries arranged on a sleek black slate tray',
    badge: { label: 'Exclusive', variant: 'glass' },
    isLocked: true,
  },
  {
    id: 'weekend-solace',
    title: 'Weekend Solace',
    description:
      'Receive a complimentary chrome-plated vessel with all bulk bean purchases this weekend only.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA41EThFPJ_vHeqAPS8kNCeuPv3tCQCBjUwACrxNlKGu-ijeLCSgc3r8-UdsK5_uHU7fgTMo6fnPswmcKHVqjagEbKyodeWLeyVxbWNnO7JOSLqrEYyDIw0EZGcr5ahAODc5I6vjb7VyuGiQ4K9xcbZRYV6YaPZZaapXMQ70IuzKVbuqVS1_-alWHI-t6yGNlz7oIxPPu7U3Q01SJjfJHgxDLw7SiOsEMMl6vs9Lxyl112YhnbViCz5eEkTQYmx6Ot1j5fg10yPfh4',
    imageAlt:
      'A sleek, minimalist chrome-plated reusable coffee vessel on a dark industrial surface',
    badge: { label: 'Limited', variant: 'default' },
    tags: ['CHROME SERIES', 'LIMITED STOCK'],
    cta: 'Details',
  },
];

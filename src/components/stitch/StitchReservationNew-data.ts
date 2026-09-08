/**
 * Default zone data and reservation form constants.
 */

import type { ZoneData } from './StitchReservationNew-types';

export const defaultZones: ZoneData[] = [
  {
    id: 'indoor',
    name: 'Indoor',
    description: 'Lush velvet & industrial vibes.',
    imageUrl: '/photos/IMG_6694.webp',
    imageAlt: 'A moody, high-end indoor cafe interior with industrial exposed piping and warm Edison bulb lighting',
  },
  {
    id: 'outdoor',
    name: 'Outdoor',
    description: 'Garden breeze & fire pits.',
    imageUrl: '/photos/IMG_6697.webp',
    imageAlt: 'An elegant outdoor dining terrace at night with minimalist architectural lines and fire pits',
  },
  {
    id: 'rooftop',
    name: 'Rooftop',
    description: 'City views & night breeze.',
    imageUrl: '/photos/IMG_6565.webp',
    imageAlt: 'A stunning rooftop bar view overlooking a metropolitan skyline at night',
  },
  {
    id: 'vip',
    name: 'VIP Lounge',
    description: 'Private booths & top service.',
    imageUrl: '/photos/IMG_6566.webp',
    imageAlt: 'A private VIP dining booth with dark navy palette and bronze metallic chamfered table edge',
  },
];

export const partySizes: (number | string)[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, '10+'];

export const timeSlots = ['6:00 PM', '7:30 PM', '8:00 PM', '9:30 PM', '10:00 PM', '11:30 PM'];

export const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 12).filter((d) => d <= 31);

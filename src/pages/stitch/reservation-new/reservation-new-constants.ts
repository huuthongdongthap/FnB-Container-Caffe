export const GUEST_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'] as const;
export const TIMES = ['6:00 PM', '7:30 PM', '8:00 PM', '9:30 PM', '10:00 PM', '11:30 PM'] as const;
export const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export interface Zone {
  id: number;
  name: string;
  desc: string;
  image: string;
  alt: string;
}

export const ZONES: Zone[] = [
  {
    id: 1,
    name: 'Indoor',
    desc: 'Lush velvet & industrial vibes.',
    image: '/photos/IMG_6694.webp',
    alt: 'A moody, high-end indoor cafe interior with industrial exposed piping, warm Edison bulb lighting, and dark velvet seating.',
  },
  {
    id: 2,
    name: 'Outdoor',
    desc: 'Garden breeze & fire pits.',
    image: '/photos/IMG_6697.webp',
    alt: 'An elegant outdoor dining terrace at night with minimalist architectural lines, scattered fire pits, and warm golden lighting.',
  },
  {
    id: 3,
    name: 'Rooftop',
    desc: 'City views & night breeze.',
    image: '/photos/IMG_6565.webp',
    alt: 'A stunning rooftop bar view overlooking a metropolitan skyline at night with glass railings, bronze metallic finishes, and soft ambient glowing lights.',
  },
  {
    id: 4,
    name: 'VIP Lounge',
    desc: 'Private booths & top service.',
    image: '/photos/IMG_6566.webp',
    alt: 'A private VIP dining booth with a dramatic dark navy color palette and a bronze metallic chamfered table edge with focused theatrical lighting.',
  },
] as const;

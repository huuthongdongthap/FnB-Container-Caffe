/**
 * StitchReviewsNew — Default mock review data
 *
 * Hardcoded review entries used when no live data is provided.
 * Includes aggregate stats (4.9 avg, 1248 reviews) and 6 sample entries
 * with various ratings, images, and highlight states.
 */

import type { ReviewEntry, ReviewsPageData } from './stitch-reviews-new-types';

export const DEFAULT_REVIEWS: ReviewEntry[] = [
  {
    id: 'r1',
    author: 'Isabella Vane',
    avatarUrl:
      '/photos/IMG_6697.webp',
    avatarAlt:
      'A sophisticated close-up portrait of an elegant woman with minimalist jewelry, dimly lit by warm amber cafe lights.',
    rating: 5,
    content:
      'The midnight espresso selection is unparalleled. The industrial architecture of the space creates a cocoon of luxury that makes every visit feel like a secret ritual. The texture of the velvet seating against the cold steel is pure sensory genius.',
    liked: true,
    likeCount: 42,
    date: 'Oct 14, 2023',
    isHighlighted: true,
    badge: "Chef's Choice",
    images: [
      {
        url: '/photos/IMG_6565.webp',
        alt: 'A dark, cinematic shot of a perfectly crafted latte with intricate foam art, placed on a black marble table.',
      },
      {
        url: '/photos/IMG_6566.webp',
        alt: 'Interior shot of Aura Cafe showing a minimalist glass partition reflecting low-key warm lighting.',
      },
    ],
  },
  {
    id: 'r2',
    author: 'Julian Thorne',
    avatarUrl:
      '/photos/IMG_6702.webp',
    avatarAlt:
      'Portrait of a well-groomed man in a dark charcoal turtleneck, looking away thoughtfully. Soft, directional side-lighting in a dark setting.',
    rating: 4,
    content:
      'A masterclass in atmosphere. The lighting design alone is worth the reservation. Perfect for late-night meetings where privacy and aesthetics are paramount.',
    liked: false,
    likeCount: 18,
    date: 'Oct 12, 2023',
    images: [
      {
        url: '/photos/IMG_6556-frame.webp',
        alt: 'Wide angle shot of a dark cafe interior featuring large floor-to-ceiling windows with a nocturnal city view.',
      },
    ],
  },
  {
    id: 'r3',
    author: 'Sienna Ray',
    avatarUrl:
      '/photos/IMG_6699.webp',
    avatarAlt:
      'Close up of a creative professional woman with sleek dark hair, lit by the glow of a tablet in a dark, atmospheric environment.',
    rating: 5,
    content:
      "The smoked truffle croissant is a revelation. I've never seen such attention to detail in cafe service. It feels more like a private lounge than a cafe.",
    liked: false,
    likeCount: 24,
    date: 'Oct 09, 2023',
  },
  {
    id: 'r4',
    author: 'Marcus Sterling',
    avatarUrl:
      '/photos/IMG_6696.webp',
    avatarAlt:
      'Portrait of an older man with silver hair and a sharp navy blazer, sitting in a high-end cafe chair.',
    rating: 5,
    content:
      'Aura provides the precision I require. Quiet, dark, and perfectly balanced. The architecture speaks to a forgotten era of high-end craftsmanship.',
    liked: false,
    likeCount: 12,
    date: 'Oct 05, 2023',
  },
  {
    id: 'r5',
    author: 'Leo Chen',
    avatarUrl:
      '/photos/IMG_6698.webp',
    avatarAlt:
      'Stylized portrait of a young man with glasses, looking at a menu. Reflection of a neon chrome sign on his glasses.',
    rating: 5,
    content:
      'Unreal aesthetics. Every corner is a photograph waiting to happen. The Dark Velvet latte is a must-try.',
    liked: false,
    likeCount: 89,
    date: 'Sep 28, 2023',
    images: [
      {
        url: '/photos/IMG_6703.webp',
        alt: 'Macro shot of a dark chocolate dessert with gold leaf topping, served on a textured silver plate.',
      },
    ],
  },
  {
    id: 'r6',
    author: 'Elena K.',
    avatarUrl:
      '/photos/IMG_6631.webp',
    avatarAlt:
      'Modern minimalist portrait of a woman with a sharp bob haircut, silhouetted against a softly lit glass wall.',
    rating: 4,
    content:
      'The acoustic dampening here is incredible. Even when full, it maintains this serene, heavy silence that is so rare in the city.',
    liked: false,
    likeCount: 5,
    date: 'Sep 25, 2023',
  },
];

/** Aggregate page data used as the default prop value */
export const DEFAULT_REVIEWS_DATA: ReviewsPageData = {
  aggregateRating: 4.9,
  totalReviews: 1248,
  reviews: DEFAULT_REVIEWS,
};

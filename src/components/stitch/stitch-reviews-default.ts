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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBRZTGRw_I-Xip7jYDLvA8Lt6wHWaFWzBe-xuoc31GO6nB9rYfPxwntNHW1AoFtTOse2NOwrHOgcZ2opcWNDeiy-7niEXlpjPWe_b1XifqZnlew6SYL1C0SkLXAx4YLlpYldf2nHydS6L3IcerPDA8off3jyd8tyhWr4oAz5IGrocg-6tIQq2f7VS1cwXMkQnR3PQHjzwjXTNbMVgliBSo0-jbi2cnDxJEaXbw0R3fHodRRDSO4eA2Po157DGe5qH6DPuekbrrR748',
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
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIkJkLEhh-JIpZhIAzqfMhhYbYnd1pfAjiUu7WCfxGO-hkBGjkWkxrysLkQFz7Wk6Dquqde11XlB8vqlCkScep50xLHZLl1dqtyvhzIaTqdhhGk2nUvb1OLaYKqr33X5vgGc1xRoNkmsHooRsxRt4Gq3YdXzPNkWoePeYxfjBER26Gh1XnVBGVAId6AK37X8G0If0vZXcqGYMGPl_GOKt3TTS39-Zmqu1rIWOu9PtobvagRB-e_UcM51EUA8VemSiJoasQiUKAj5A',
        alt: 'A dark, cinematic shot of a perfectly crafted latte with intricate foam art, placed on a black marble table.',
      },
      {
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDY0kZTzu_eDCzdeNtwOb5PDzk6AfBvfpyjeWYa5QzAiHJ-V7rJxv6OhovjTg1Ca882ie74XGdCsyf9DJuMbTBSChCk_g466fqeUEM8buyQg6-QN3uEko28b9oLrb9QJBycRc3Mph8WR4k4kdHoWKQ78slLnQqlORIUn0U9qs3H1Ei6Xi4C6iVwaMnkXjBdk_FpN18e_pQEV9uHpz12Eb1QdQPytGC2_P5hW4zauK1GcNBAptGSjej-2LKVGjjtKRlDeaJKOb77MdA',
        alt: 'Interior shot of Aura Cafe showing a minimalist glass partition reflecting low-key warm lighting.',
      },
    ],
  },
  {
    id: 'r2',
    author: 'Julian Thorne',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAZtfpoH6WXtP2CbmVXqWYVHvMv1WpAHWf3ikBODhROUfMIAcbI3qyrYLJv3OcWHqisRWfcFHuCpk5WFsQe70rdircMLzWc7RhOjzohSt9jsTqKoLReJYP5ENxiXCSSj-DBaCevpGYshcEb_QZnJrT26FLzSb5x28saeqJza6bITZwrOG8_YP2TWM44GNVTdC6dZ1lYrWIdriA54bV8b48wOswGqPsMTL_vJZJ5t_YUAh8FnRQ5ceQ4EGbJmf_Grap0nBsO0iVUVZU',
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
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBkfvITRussIW0rvnfjcteP4oPrgMESCj_3jKFknxAbcunHPHF88S5dZD2S3ybXK5KxveDqm99bXCiJT6L2_ko1AipvopRS8Y6fgVcUkE1O7jSEhDw34b_I6kQ49pR_-7I0ryKgwWkBk1OvmaZFnLVbyX4hnEvWzb_88hZJijVKL_ygD8dIt7pvuto86_uyzrEn8ucykKvla9s5kc8ZGNEn-jG0IALJe3QIpuThXsyLHJ18oIRjKvC5avIA44wfXVRkNUzm42Yij2k',
        alt: 'Wide angle shot of a dark cafe interior featuring large floor-to-ceiling windows with a nocturnal city view.',
      },
    ],
  },
  {
    id: 'r3',
    author: 'Sienna Ray',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC3uNkiVtFXChMrZPskDLX_8x0PhSJEqRnuXrCpQa-sY1LGVZhx2s9L3s7bWuhlwoxucXLb_G5ZY0Vn__PlasXzU8cjRc2TO4bmk3Zy-aZjiOjk35xl3SDNHTJnoKsPekuoJRTEKz4tkZa1tMTJmJpoeuHJlIIGDb-WRR2FBHagn6eIo1yi7GMMDumYYXp7_OrzCqNRfS9h508qD48W1Idx-7yosjk-hyvR9yfcno_PUtVqlrDOWzxCMm5PC3UseljrIXW6Z2HUl9U',
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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDCl21e8B8y_p-chcJY0g2yge7sAlLGi5f_QHyHyaY4iMCAHb-2z8t_oxKXnEqtb-GD2cDynmx-sBVNU7WcYQFauwW-G9hjPihKhK6EJfSbLzz17WFI3_gMqjZC_M1f-4klxSRrgUI3DSfA8d8mRZiYtxfRb3LNP2iGytC9uPRcKV2D9VE9KzHE05RNo_zaYKhg2BjWG5U1nKA-hVuIF-l7h55H5jTa-M3uHo6DyNqVMl16v5T1fgEntSfOATE86AaikwXpZf1kGeY',
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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDdewO5H_wE6ciuCLdEe-S0Yb_1lKWv8GO97Zc-CmoTk3R4X3YnIGR3kUfW9EPphByxWknPs4Yce-TR8UUdhylWFISZYwe33NI2HiKkXN1fZ8GGynkDb7PvriY6OcxKebVoiiweb3S8VYRkh-ZIBAAcsCcbIWV2fNAmJabnKyQIYp6seJc5-PnfGH8or8kKf9BHcnnw8vTFGuVZ2y0z14ah-tyGl3Wo294HGCs8mcEo1cbvEylyzTx_w6EZsvE0B90V5S1z0IJlNMA',
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
        url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC8u_4wEl-rwdM8Hd9TgLS0ObzY6HdeIWjzv_PSQGKLNOueo8BoU59WNmUTimKCNUBdsSq0VXiQ4wDRhn0AggL4fDq1bT4829jW4woP05iP6g7ycQnIq25y9JU-KYLTU8ujLEOMJyijEvvgvBLhtfwkYqdQ-BfFsBNlMIxO0bms-ilqVJ49Xl8W80pcK3FR0rwm7WspFFUOHGG2ELxNLJEf8GJpSYIJ3I91UF9idV71wiVLuusdwJGvxNSoY_2PO-O8Ff0SNhBv6UQ',
        alt: 'Macro shot of a dark chocolate dessert with gold leaf topping, served on a textured silver plate.',
      },
    ],
  },
  {
    id: 'r6',
    author: 'Elena K.',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA8N1q8_L2ppbrtWF0UX06qbfE8r_UqN3Ft929qG0S3rczb4bOFZUaEFDUW3Nev4IpPEvsZql0ILR9Z5pCcQEwkUYiTJ4IgFTn6BgL-gxWcReSIDMEbUfE8d4Uhu7OLSZEE1rOoS_zEJW6LnHMsFV4VtejIX6ZaQ4nNuDxZcYQeooKDENOWTLT20MTPslqJoRIokPU1XdsZlud_6TEdBXpNfDZ7oQpO0gr19NNuAp-WMe2t9d5MbPjy571ysrcd0lgqe_wl4W7XW0o',
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

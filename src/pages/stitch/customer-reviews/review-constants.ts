import type { Review } from './review-types';

export const FILTERS = ['All', '5 Star', 'Photo', 'Latest'] as const;

export const REVIEWS: Review[] = [
  {
    name: 'Isabella Vane',
    initials: 'IV',
    date: 'Oct 14, 2023',
    rating: 5,
    text: '"The midnight espresso selection is unparalleled. The industrial architecture of the space creates a cocoon of luxury that makes every visit feel like a secret ritual. The texture of the velvet seating against the cold steel is pure sensory genius."',
    likes: 42,
    isChefsChoice: true,
    photos: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAIkJkLEhh-JIpZhIAzqfMhhYbYnd1pfAjiUu7WCfxGO-hkBGjkWkxrysLkQFz7Wk6Dquqde11XlB8vqlCkScep50xLHZLl1dqtyvhzIaTqdhhGk2nUvb1OLaYKqr33X5vgGc1xRoNkmsHooRsxRt4Gq3YdXzPNkWoePeYxfjBER26Gh1XnVBGVAId6AK37X8G0If0vZXcqGYMGPl_GOKt3TTS39-Zmqu1rIWOu9PtobvagRB-e_UcM51EUA8VemSiJoasQiUKAj5A',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDY0kZTzu_eDCzdeNtwOb5PDzk6AfBvfpyjeWYa5QzAiHJ-V7rJxv6OhovjTg1Ca882ie74XGdCsyf9DJuMbTBSChCk_g466fqeUEM8buyQg6-QN3uEko28b9oLrb9QJBycRc3Mph8WR4k4kdHoWKQ78slLnQqlORIUn0U9qs3H1Ei6Xi4C6iVwaMnkXjBdk_FpN18e_pQEV9uHpz12Eb1QdQPytGC2_P5hW4zauK1GcNBAptGSjej-2LKVGjjtKRlDeaJKOb77MdA',
    ],
  },
  {
    name: 'Julian Thorne',
    initials: 'JT',
    date: 'Oct 12, 2023',
    rating: 4,
    text: 'A masterclass in atmosphere. The lighting design alone is worth the reservation. Perfect for late-night meetings where privacy and aesthetics are paramount.',
    likes: 18,
    photos: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBkfvITRussIW0rvnfjcteP4oPrgMESCj_3jKFknxAbcunHPHF88S5dZD2S3ybXK5KxveDqm99bXCiJT6L2_ko1AipvopRS8Y6fgVcUkE1O7jSEhDw34b_I6kQ49pR_-7I0ryKgwWkBk1OvmaZFnLVbyX4hnEvWzb_88hZJijVKL_ygD8dIt7pvuto86_uyzrEn8ucykKvla9s5kc8ZGNEn-jG0IALJe3QIpuThXsyLHJ18oIRjKvC5avIA44wfXVRkNUzm42Yij2k',
    ],
  },
  {
    name: 'Sienna Ray',
    initials: 'SR',
    date: 'Oct 09, 2023',
    rating: 5,
    text: 'The smoked truffle croissant is a revelation. I\'ve never seen such attention to detail in cafe service. It feels more like a private lounge than a cafe.',
    likes: 24,
  },
  {
    name: 'Marcus Sterling',
    initials: 'MS',
    date: 'Oct 05, 2023',
    rating: 5,
    text: 'Aura provides the precision I require. Quiet, dark, and perfectly balanced. The architecture speaks to a forgotten era of high-end craftsmanship.',
    likes: 12,
  },
  {
    name: 'Leo Chen',
    initials: 'LC',
    date: 'Sep 28, 2023',
    rating: 5,
    text: 'Unreal aesthetics. Every corner is a photograph waiting to happen. The Dark Velvet latte is a must-try.',
    likes: 89,
    photos: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC8u_4wEl-rwdM8Hd9TgLS0ObzY6HdeIWjzv_PSQGKLNOueo8BoU59WNmUTimKCNUBdsSq0VXiQ4wDRhn0AggL4fDq1bT4829jW4woP05iP6g7ycQnIq25y9JU-KYLTU8ujLEOMJyijEvvgvBLhtfwkYqdQ-BfFsBNlMIxO0bms-ilqVJ49Xl8W80pcK3FR0rwm7WspFFUOHGG2ELxNLJEf8GJpSYIJ3I91UF9idV71wiVLuusdwJGvxNSoY_2PO-O8Ff0SNhBv6UQ',
    ],
  },
  {
    name: 'Elena K.',
    initials: 'EK',
    date: 'Sep 25, 2023',
    rating: 4,
    text: 'The acoustic dampening here is incredible. Even when full, it maintains this serene, heavy silence that is so rare in the city.',
    likes: 5,
  },
] as const;

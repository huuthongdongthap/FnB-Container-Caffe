import { MenuItem2Data, CategoryData } from './StitchMenu2New-types';

export const DEFAULT_ITEMS: MenuItem2Data[] = [
  {
    id: '1',
    name: 'Midnight Espresso',
    description: 'Double-shot ristretto, obsidian blend with notes of dark chocolate and smoke.',
    price: '$6.50',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAH_VFxx9-rRwx9wKNjbdcE9OuRiR9kDf1V2bTaWpz-_0fy20-jgs3SmIdl91KadKd7TElUeHnrtds6pHlCuoKWxTJ1qCY6KYsPQZewSIp5je_f7fQg4pSAjkq575Jd6KBZg5X0aapGoKI23yGGWVu1SsGSL_oKw50RhfstBdM5TUfjx964Bv1-3eZXzTE31Es9HTQJxg2t97iwic_fTRs3ymuAuLx_gOoznl0JPLigyw_JDQN-DrbTkDOsxMOpwr4DEE_kyUJwkTk',
    imageAlt:
      'A moody high-contrast photograph of a rich dark espresso shot being poured into a heavy obsidian ceramic cup with tiny golden crema bubbles on top',
    category: 'coffee',
    badge: 'Featured',
    gaugeLabel: 'Intensity',
    gaugeValue: 9,
  },
  {
    id: '2',
    name: 'Chrome Velvet Latte',
    description: 'Charcoal-infused micro-foam, Madagascar vanilla, and velvet-texture espresso.',
    price: '$8.00',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBjmO2eXJjE_CpfiM0km0Psm-VRxYA53RVBLdx9qk4OUDkxbIb3VRdTkbf7NJlOTPWVSjp_rTYy8DzHDY__I-8XpoM-Q-6xVaWsxfkbYVPwKXc_qPrf7qWRg3ioNZhSDwVG-yFf3SsP_9O9qaFlLxf1GWxDaK7Lyr9MwE4v4znAvIEFya7LRoW9J38OL0rrRuJTQG_4cY57eiSpOn4VMIW-kPa-KgJv4c55tETRE4VtHTxmyJnyjdH7fbAfGjFcPWpHX9bUClOou8A',
    imageAlt:
      'A sophisticated latte in a clear glass cup showing distinct layers of charcoal-infused grey milk and rich espresso with a geometric foam pattern on top',
    category: 'coffee',
    gaugeLabel: 'Sweetness',
    gaugeValue: 4,
  },
  {
    id: '3',
    name: 'Industrial Cold Brew',
    description: '24-hour slow drip through stainless steel filtration. Served over a single crystal sphere.',
    price: '$7.50',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDcW7CnosOOxUDF7437ZlimM-6RQJM-nD_RTJIikhjtT_roMitVCtmIYLSG4TGUsr-MiKrV7rje1xtFlBXt3EFKn6PE9iUnUMntjpewI7-MncuEa7UhqT-iYYc5tekYIHbbz_D1gwPoRXj_N8tCEW25FAHRMjErhqLnjunRe4eyq1Px0t-ZFdweX7kCOjA4TYuAEbGTaq4uKwJ-FYqO-KD5PHxR_T8uSWfcZdGrxqR_hHH6n1ZKzjCkCxTvBZ93GAqNfexmt9-MGV0',
    imageAlt:
      'A minimalist glass carafe filled with deep amber-colored cold brew coffee beside a glass with a single large clear ice sphere on brushed aluminum surface',
    category: 'cold-brew',
    gaugeLabel: 'Caffeine',
    gaugeValue: 10,
  },
  {
    id: '4',
    name: 'Bronze Chai',
    description: 'Hand-ground spices, local wild honey, and premium black tea steeped for 8 minutes.',
    price: '$7.00',
    imageSrc:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDbcnOjmzq8ALq92TrWmO1IpO4-oztDnTnOizeMvgeS0U5O4Pr4NkLSMrzlTv-E-dAgD3JshDmPr3msUZeD6AttX_XHeP3Vjv6_Bk1FBEbVRZggvNEyHKrs3iTidEUa4LMYIzqIvQmTCd-ISxr-IUSrGE6D66VNINa9tQztBLhJ2RwT3xN_YAKcR9_rUzYUH9QyHexApzLN7NcGlUfHctM20sDs5q1h93P35z7i9NPD82Rvo85yjHuJ6BVrdG2S_v7feu6SqlNzxQc',
    imageAlt:
      'A warm creamy chai latte in a rustic bronze-colored mug with steam rising, cinnamon sticks and star anise scattered on a dark slate surface',
    category: 'tea',
    gaugeLabel: 'Spice Level',
    gaugeValue: 7,
  },
];

export const CATEGORIES: CategoryData[] = [
  { key: 'all', label: 'All' },
  { key: 'coffee', label: 'Coffee' },
  { key: 'tea', label: 'Tea' },
  { key: 'signature', label: 'Signature' },
  { key: 'cold-brew', label: 'Cold Brew' },
];

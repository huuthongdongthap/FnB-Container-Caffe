import type { FilterBtn, MenuItem } from './digital-menu-2-types';

export const FILTERS: readonly FilterBtn[] = [
  { label: 'All', active: true },
  { label: 'Coffee' },
  { label: 'Tea' },
  { label: 'Signature' },
  { label: 'Cold Brew' },
] as const;

export const MENU_ITEMS: readonly MenuItem[] = [
  {
    title: 'Midnight Espresso',
    subtitle: 'Double-shot ristretto, obsidian blend with notes of dark chocolate and smoke.',
    price: '$6.50',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAH_VFxx9-rRwx9wKNjbdcE9OuRiR9kDf1V2bTaWpz-_0fy20-jgs3SmIdl91KadKd7TElUeHnrtds6pHlCuoKWxTJ1qCY6KYsPQZewSIp5je_f7fQg4pSAjkq575Jd6KBZg5X0aapGoKI23yGGWVu1SsGSL_oKw50RhfstBdM5TUfjx964Bv1-3eZXzTE31Es9HTQJxg2t97iwic_fTRs3ymuAuLx_gOoznl0JPLigyw_JDQN-DrbTkDOsxMOpwr4DEE_kyUJwkTk',
    imageAlt: 'Moody high-contrast photograph of a dark espresso shot poured into an obsidian ceramic cup. Golden crema bubbles on top. Dark industrial coffee bar with chrome accents and dim warm lighting. Deep navy and bronze tones.',
    tag: 'Featured',
    metric: { label: 'Intensity', value: '9/10', pct: 90 },
  },
  {
    title: 'Chrome Velvet Latte',
    subtitle: 'Charcoal-infused micro-foam, Madagascar vanilla, and velvet-texture espresso.',
    price: '$8.00',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBjmO2eXJjE_CpfiM0km0Psm-VRxYA53RVBLdx9qk4OUDkxbIb3VRdTkbf7NJlOTPWVSjp_rTYy8DzHDY__I-8XpoM-Q-6xVaWsxfkbYVPwKXc_qPrf7qWRg3ioNZhSDwVG-yFf3SsP_9O9qaFlLxf1GWxDaK7Lyr9MwE4v4znAvIEFya7LRoW9J38OL0rrRuJTQG_4cY57eiSpOn4VMIW-kPa-KgJv4c55tETRE4VtHTxmyJnyjdH7fbAfGjFcPWpHX9bUClOou8A',
    imageAlt: 'Sophisticated latte in a clear glass cup showing distinct layers of charcoal-infused grey milk and rich espresso. Foam decorated with geometric patterns. Polished stainless steel surface reflecting soft blue and silver light.',
    metric: { label: 'Sweetness', value: '4/10', pct: 40 },
  },
  {
    title: 'Industrial Cold Brew',
    subtitle: '24-hour slow drip through stainless steel filtration. Served over a single crystal sphere.',
    price: '$7.50',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcW7CnosOOxUDF7437ZlimM-6RQJM-nD_RTJIikhjtT_roMitVCtmIYLSG4TGUsr-MiKrV7rje1xtFlBXt3EFKn6PE9iUnUMntjpewI7-MncuEa7UhqT-iYYc5tekYIHbbz_D1gwPoRXj_N8tCEW25FAHRMjErhqLnjunRe4eyq1Px0t-ZFdweX7kCOjA4TYuAEbGTaq4uKwJ-FYqO-KD5PHxR_T8uSWfcZdGrxqR_hHH6n1ZKzjCkCxTvBZ93GAqNfexmt9-MGV0',
    imageAlt: 'Minimalist glass carafe filled with deep amber cold brew next to a glass with a large clear ice sphere. Laboratory-like environment with brushed aluminum textures. Cool navy and silver palette.',
    metric: { label: 'Caffeine', value: '10/10', pct: 100 },
  },
  {
    title: 'Bronze Chai',
    subtitle: 'Hand-ground spices, local wild honey, and premium black tea steeped for 8 minutes.',
    price: '$7.00',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbcnOjmzq8ALq92TrWmO1IpO4-oztDnTnOizeMvgeS0U5O4Pr4NkLSMrzlTv-E-dAgD3JshDmPr3msUZeD6AttX_XHeP3Vjv6_Bk1FBEbVRZggvNEyHKrs3iTidEUa4LMYIzqIvQmTCd-ISxr-IUSrGE6D66VNINa9tQztBLhJ2RwT3xN_YAKcR9_rUzYUH9QyHexApzLN7NcGlUfHctM20sDs5q1h93P35z7i9NPD82Rvo85yjHuJ6BVrdG2S_v7feu6SqlNzxQc',
    imageAlt: 'Warm atmospheric shot of a creamy chai latte in a rustic refined bronze-colored mug. Steam rises in elegant curls. Hand-ground spices scattered on a dark slate surface. Rich brown, gold, deep navy tones.',
    metric: { label: 'Spice Level', value: '7/10', pct: 70 },
  },
] as const;

export const NAV_LINKS = [
  { label: 'Menu', href: '#menu' },
  { label: 'Reservation', href: '#reservation' },
  { label: 'Location', href: '#location' },
  { label: 'About', href: '#about' },
] as const;

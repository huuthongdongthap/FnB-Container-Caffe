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
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBszs99tbK7fqZ7HnmelulFYenGNCV7_dslfT03Yt6L7M6NnGiW_90PbeKkp1e7XB7l9XElwVfcAllaFbMxQmCIKYjgqRhA-kXNO4kZ7kSAC6s_sU0hJb414vr0S2YTuDY2-u6aUFFRrkdt97_PFKsDi1oMsedxg14Zw6o2j3vhfsRTIoKkaT1h3xLKlgA5VwjebVZ3NjyqrlcNBdPbsUK62rC67byLwxsmw2a4Y7MbSds-WdEfQGyI_iWJbax2yWRVZZS_k1-kvHY',
    alt: 'A moody, high-end indoor cafe interior with industrial exposed piping, warm Edison bulb lighting, and dark velvet seating.',
  },
  {
    id: 2,
    name: 'Outdoor',
    desc: 'Garden breeze & fire pits.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAg8_hRBmi1lfY0mHVxF7GBPEThuDkSmjkyLi-lhKYI0um0WM0pi38bGpNuouwKE6AcpTxp1pe8L0y3-NzC1dJo0ZvJkXG_2G238Kcn8PIgw_59Bv4nMij3zXdmV-ow6IdpP4RGMfpbL8CqCg-Yi4KDr3F0obMjKWeNRy0o4IboNUl1mM9evxrnHlTjf1cnEarKg0MtlBrpHyoEaOCQbACbBnZciRkb_Nd8yMRrJhe9AIoIhDHVwQgBpBQ8IYdWNnPcy20k_FZJkVA',
    alt: 'An elegant outdoor dining terrace at night with minimalist architectural lines, scattered fire pits, and warm golden lighting.',
  },
  {
    id: 3,
    name: 'Rooftop',
    desc: 'City views & night breeze.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCzR8JSSqjy5uuVxcUbh3KpRQ_9AvzmU6-bl2Xu7Hat7PINhwHSMuZqJItpmd8ZCB61i8ZwHfZ7FNP4bMXqayTiy41YmhlHxkTDdRNs1Pusx7CRY-SY_mODLoRdWlwgn_IJ1bccEVJyLANDSHrJSXu_ez6GvrsuxtYr-xdSWcicKCcbcADqeJlhfpDvTpTTDaaxzFn74v3lqWta3UdxQ2G10TK5JO2QU4dpRAR5Nw47YTNK36xK4ev0f1aC0L_ZwudpEgbedy9joJk',
    alt: 'A stunning rooftop bar view overlooking a metropolitan skyline at night with glass railings, bronze metallic finishes, and soft ambient glowing lights.',
  },
  {
    id: 4,
    name: 'VIP Lounge',
    desc: 'Private booths & top service.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDsdSwKBQ0_Axy1FxGSHQE9a7Ty-l2SoOrOYSH2yqLzR2vEmEZ3VkPnJ5wbYon4864M6PNgiSna9eg0CY-pI9vW4rU9p68R-JTIbUBhQQzn9WhnpB1R6OGPXbgzxisVtcaWhG06kDsa3ALwCO5QyMm2FyuwmiWAm2X1l8xfJCf-FXIN3u12E0RBORYncLdtTOeu-dZPcmNqNByAMOcKcFmqkC5BqUebKQ_5UIQY9CXH5AIQoGwaAPSU_99PrjlaFTSNAxV0nGkE9mM',
    alt: 'A private VIP dining booth with a dramatic dark navy color palette and a bronze metallic chamfered table edge with focused theatrical lighting.',
  },
] as const;

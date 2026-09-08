import type { CartItem } from './premium-checkout-types';

export const CART_ITEMS: readonly CartItem[] = [
  {
    id: 'midnight-espresso',
    name: 'Midnight Espresso',
    detail: 'Double Shot · 1x',
    price: 6.5,
    image: '/photos/IMG_6593.webp',
    alt: 'Midnight Espresso in dark obsidian ceramic cup, dim luxury industrial lounge, steam rising',
  },
  {
    id: 'chrome-velvet-latte',
    name: 'Chrome Velvet Latte',
    detail: 'Oat Milk · 1x',
    price: 7.25,
    image: '/photos/IMG_6581.webp',
    alt: 'Chrome Velvet Latte in semi-transparent glass mug, blurred nocturnal cafe, warm bronze lighting',
  },
] as const;

export const TAX_RATE = 0.05;
export const DELIVERY_FEE = 0;

export const ICON_CUSTOMER = '👤';
export const ICON_PAYMENT = '💳';
export const ICON_PAYOS = '🏦';
export const ICON_COD = '💵';

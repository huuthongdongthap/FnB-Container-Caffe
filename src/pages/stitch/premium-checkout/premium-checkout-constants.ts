import type { CartItem } from './premium-checkout-types';

export const CART_ITEMS: readonly CartItem[] = [
  {
    id: 'midnight-espresso',
    name: 'Midnight Espresso',
    detail: 'Double Shot · 1x',
    price: 6.5,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCkatwcMiZs9JBTKRqd_tOJbxPzqOg_MDkzpHnl3vQLiodjumMJG14taUwf8p-QPxhPKKydr7dh4Xdb-IxCy7xvQWxnMlDExqjoX17Lfq1nbS0GCzrU9dfgFjeAKYQXLiY-g2x78qqFMcePLqhhG4inAGF6C2ATE0ZKsVDz97nrjiyTJK69TRJpXeLKoyCegTLRBD-5XJ1M_Wk4fa30Vd_hZBIsHdmMjpOoTKsr0IZEDD1vieiHnepnWdQA4ciXpVhdB4juGviNjFg',
    alt: 'Midnight Espresso in dark obsidian ceramic cup, dim luxury industrial lounge, steam rising',
  },
  {
    id: 'chrome-velvet-latte',
    name: 'Chrome Velvet Latte',
    detail: 'Oat Milk · 1x',
    price: 7.25,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA4hIWRxSPnuozowY9004vMsDXVriJIdSVmFKVJmj4selLCgoJ_8ik1nMFrHsByIbnzUF9TPYQlAGITSYLEEcy6djLpOSYgcGpO8qX9VZhYww5DDMGpgUQQFAO__n_PG4buNrwbA4i71ngg5V0z70o7PIkwU798KMgo69YvtmgXPFe020gCMqB5JfPvAwfXKIx04TaXKdkM4nYpRBmffaREyCsHGwpOsWZlgkA2nNA8-blojfRbxOx4wwklQP1V_2N_ARLFkqkMVCI',
    alt: 'Chrome Velvet Latte in semi-transparent glass mug, blurred nocturnal cafe, warm bronze lighting',
  },
] as const;

export const TAX_RATE = 0.05;
export const DELIVERY_FEE = 0;

export const ICON_CUSTOMER = '👤';
export const ICON_PAYMENT = '💳';
export const ICON_PAYOS = '🏦';
export const ICON_COD = '💵';

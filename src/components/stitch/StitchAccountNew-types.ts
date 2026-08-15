/**
 * TypeScript interfaces and default data for StitchAccountNew components.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

/* ─── Interfaces ──────────────────────────────────────────────── */

export interface AccountProfileNew {
  name: string;
  avatar: string;
  tier: string;
  memberSince: string;
}

export interface LoyaltyDataNew {
  points: number;
  nextTier: string;
  pointsToNext: number;
  progressPercent: number;
}

export type OrderItemIcon = 'coffee' | 'bakery' | 'icecream' | 'cupSoda';
export type OrderItemStatus = 'preparing' | 'delivered';

export interface OrderItemNew {
  id: string;
  itemName: string;
  icon: OrderItemIcon;
  time: string;
  status: OrderItemStatus;
}

export interface AccountCardNew {
  type: 'subscription' | 'payment';
  title: string;
  subtitle: string;
  meta: string;
  accent?: boolean;
}

export interface StitchAccountNewProps {
  profile?: AccountProfileNew;
  loyalty?: LoyaltyDataNew;
  orders?: OrderItemNew[];
  cards?: AccountCardNew[];
}

/* ─── Default Data ────────────────────────────────────────────── */

export const defaultProfile: AccountProfileNew = {
  name: 'Julian Vane',
  avatar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD85_v-mTOc0nYNat_E87LRoxgQ8V8vWg6--Eqj8-hF8Yf1xq-KcWCNzzvU68SWZBM8wa3Y9DTzmi3j17h8GKf1By4BdEUFR-8w1IdVjS7iF5IYAovhMynYJGEUN3UcV_Yn3KKCSpaep_A18JJoZFnUozahJNkzkB8Uqgf8rJn1efSNviQXUHW4gSsruyx8TAtv7LHMLFz0RSXPb2W4wBkRcapILuPmNsNIy2jS8NeVKraqL8uy3NG5Y4cODICU7fJFmmBpiXLPing',
  tier: 'Gold',
  memberSince: '2022',
};

export const defaultLoyalty: LoyaltyDataNew = {
  points: 1250,
  nextTier: 'Platinum',
  pointsToNext: 250,
  progressPercent: 80,
};

export const defaultOrders: OrderItemNew[] = [
  {
    id: '1',
    itemName: 'Truffle Cortado',
    icon: 'coffee',
    time: 'Today, 08:45 AM',
    status: 'preparing',
  },
  {
    id: '2',
    itemName: 'Gold Leaf Croissant',
    icon: 'bakery',
    time: 'Yesterday, 10:15 AM',
    status: 'delivered',
  },
];

export const defaultCards: AccountCardNew[] = [
  {
    type: 'subscription',
    title: 'Aura Elite',
    subtitle: 'Subscription',
    meta: 'Active',
    accent: true,
  },
  {
    type: 'payment',
    title: 'Visa •• 4242',
    subtitle: 'Payment',
    meta: 'Default',
    accent: false,
  },
];

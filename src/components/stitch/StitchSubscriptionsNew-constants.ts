/* ─── Types ────────────────────────────────────────────────────────── */

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

export interface StitchSubscriptionsNewProps {
  tiers?: SubscriptionTier[];
  onSelectPlan?: (tierId: string) => void;
}

/* ─── Default tier data ────────────────────────────────────────────── */

export const defaultTiers: SubscriptionTier[] = [
  {
    id: 'basic',
    name: 'BASIC',
    price: 9,
    period: 'MONTH',
    features: ['Daily Brew', 'Standard Seating', 'Mobile Ordering'],
  },
  {
    id: 'premium',
    name: 'PREMIUM',
    price: 19,
    period: 'MONTH',
    features: ['All Basic features', 'Specialty Roasts', 'Priority Lounge Access', 'Monthly Cupping'],
    highlighted: true,
    badge: 'MOST POPULAR',
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    price: 49,
    period: 'MONTH',
    features: ['All Premium features', 'Private Event Hosting', 'Personal Concierge', 'Unlimited Global Access'],
  },
];

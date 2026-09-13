/**
 * crm-profile — shape a CrmProfile for staff/owner surfaces.
 *
 * Thin presentation layer over lookup-profile: renames fields into
 * the shape the dashboard/UI expects and computes a couple of
 * derived flags. Kept separate from the read path so either can
 * change independently.
 */
import type { CrmProfile } from './lookup-profile';

export interface CrmProfileView {
  customerId: string | null;
  displayName: string;
  phone: string | null;
  email: string | null;
  tier: string;
  totalVisits: number;
  lastVisitAt: string | null;
  canMarket: boolean;
  canOrder: boolean;
  recentVisits: Array<{ visitedAt: string; channel: string }>;
  recentOrders: Array<{ id: string; totalCents: number; placedAt: string }>;
  found: boolean;
}

export function toCrmView(profile: CrmProfile): CrmProfileView {
  return {
    customerId: profile.customerId,
    displayName: profile.name ?? profile.phone ?? 'Khách vãng lai',
    phone: profile.phone,
    email: profile.email,
    tier: profile.tier,
    totalVisits: profile.totalVisits,
    lastVisitAt: profile.lastVisitAt,
    canMarket: profile.consentMarketing,
    canOrder: profile.consentOrder,
    recentVisits: profile.recentVisits,
    recentOrders: profile.recentOrders,
    found: profile.found,
  };
}

/**
 * Canonical Customer / CRM Domain Model
 * Single Authoritative Entity Representation for Customers across Aura Space.
 * Flow: CUSTOMER → PROFILE → VISIT → ORDER → ACTIVITY → SEGMENT → LOYALTY
 */

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type CustomerIdentifierType = 'phone' | 'email' | 'zalo' | 'other';

export interface CustomerIdentifier {
  id: string;
  customerId: string;
  identifierType: CustomerIdentifierType;
  identifierValue: string;
  isPrimary: boolean;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface CustomerConsent {
  id: string;
  customerId: string;
  purpose: 'crm' | 'marketing' | 'analytics' | 'erpnext_sync';
  granted: boolean;
  source: 'checkout' | 'signup' | 'setting' | 'staff';
  policyVersion: string;
  grantedAt: string;
  revokedAt?: string | null;
}

export interface CanonicalCustomer {
  id: string; // cust_*
  email: string | null;
  name: string | null;
  phone: string | null;
  loyaltyPoints: number;
  lifetimePoints: number;
  loyaltyTier: LoyaltyTier;
  dateOfBirth?: string | null;
  zalo?: string | null;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfileView {
  customer: CanonicalCustomer;
  identities: CustomerIdentifier[];
  consents: CustomerConsent[];
  metrics: {
    totalOrders: number;
    totalVisits: number;
    lifetimeSpendVnd: number;
    lastVisitedAt: string | null;
    lastOrderedAt: string | null;
  };
  loyalty: {
    pointsBalance: number;
    cashbackBalanceVnd: number;
    tier: LoyaltyTier;
  };
}

export interface CustomerMergeInput {
  primaryCustomerId: string;
  secondaryCustomerId: string;
  reason: string;
  actorId?: string;
}

export interface CustomerMergeResult {
  ok: boolean;
  primaryCustomerId: string;
  mergedCustomerId: string;
  ordersReassigned: number;
  visitsReassigned: number;
  identitiesReassigned: number;
  pointsMerged: number;
  auditLogId?: string;
  error?: string;
}

/**
 * CRM domain — public surface.
 *
 * Read-side lens over the customer tables: lookup by phone/identity,
 * shape a staff/owner profile view.
 */
export { lookupProfile } from './lookup-profile';
export type { CrmProfile, LookupOptions } from './lookup-profile';

export { toCrmView } from './crm-profile';
export type { CrmProfileView } from './crm-profile';

export { aggregateEvents } from './commands/aggregate-events';
export type { AggregateResult, CustomerEvent } from './commands/aggregate-events';

export { getCustomerAccount } from './commands/get-customer-account';
export type { CustomerAccount, AccountOptions } from './commands/get-customer-account';

export { updateConsent, CONSENT_PURPOSES } from './commands/update-consent';
export type { ConsentUpdate, ConsentRow, ConsentResult } from './commands/update-consent';

export { placeOrder, VALID_CHANNELS } from './commands/place-order';
export type {
  PlaceOrderInput,
  PlaceOrderResult,
  PlaceOrderSuccess,
  PlaceOrderError,
  FulfillmentChannel,
  OrderItemInput,
} from './commands/place-order';

export { getFulfillment, listPickupPoints, DEFAULT_PICKUP_POINT } from './commands/get-fulfillment';
export type {
  FulfillmentResult,
  PickupPoint,
  GetFulfillmentResult,
} from './commands/get-fulfillment';

export { loadPolicy, tierByName } from './commands/loyalty-policy';
export type { LoyaltyPolicy, LoyaltyTierPolicy } from './commands/loyalty-policy';

export { computeTier } from './commands/compute-tier';
export type { ComputedTier } from './commands/compute-tier';

export { applyAccrual, MIN_ORDER_TO_EARN } from './commands/accrual';
export type { AccrualInput, AccrualResult, AccrualSuccess, AccrualError } from './commands/accrual';

export { reverseAccrual } from './commands/refund-reversal';
export type { ReversalInput, ReversalResult, ReversalSuccess, ReversalError } from './commands/refund-reversal';

export { computeFrequencyBand, resolveBandPolicy, DEFAULT_BAND_POLICY } from './commands/frequency-band';
export type { FrequencyBand, BandPolicy, OrderSummary } from './commands/frequency-band';

export { extractPreferences, parseOrderItems } from './commands/preferences';
export type { CustomerPreferences, OrderItemInput, RawOrderForPreferences } from './commands/preferences';

export { getCustomer360 } from './commands/customer-360';
export type { Customer360, Customer360Options } from './commands/customer-360';

export {
  buildSegment,
  listSegments,
  loadSegmentDefinitions,
  DEFAULT_SEGMENTS,
} from './commands/segments';
export type {
  SegmentDefinition,
  SegmentResult,
  SegmentRow,
  SegmentKey,
  BuildOptions,
} from './commands/segments';

export {
  resolveReferralPolicy,
  DEFAULT_REFERRAL_POLICY,
  type ReferralPolicy,
  type ReferralBonusType,
} from './commands/referral-policy';

export {
  getOrCreateReferralCode,
  getReferralCode,
  redeemReferral,
  rewardReferralOnFirstOrder,
  reverseReferralCashback,
  getReferralStatus,
} from './commands/referral';
export type {
  ReferralCodeRow,
  ReferralRow,
  ReferralStatus,
  ReferralResult,
} from './commands/referral';

export {
  renderTemplate,
} from './commands/campaign/templates';
export type { RenderedTemplate, TemplateParams } from './commands/campaign/templates';

export {
  deduplicate,
  logSend,
} from './commands/campaign/dedup';

export {
  detectWelcomeCandidates,
  detectBirthdayCandidates,
  detectWinbackCandidates,
  detectPostVisitCandidates,
  detectCashbackExpiry,
  markExpiryNotified,
} from './commands/campaign/detect';

export type {
  CampaignTrigger,
  CampaignChannel,
  CampaignCustomer,
  CampaignMessage,
  CampaignResult,
  CampaignLogRow,
  CampaignConfig,
} from './commands/campaign/types';

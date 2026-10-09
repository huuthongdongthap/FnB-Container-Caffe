/**
 * Customer domain — public surface.
 *
 * Domain owns rules; handlers stay thin (VALIDATE→AUTH→USE CASE→MAP).
 * Every command is additive and non-blocking-safe: capture failures
 * are logged, never thrown into checkout / loyalty paths.
 */
export { identifyCustomer } from './identify-customer';
export type { IdentifyCustomerInput, IdentifiedIdentity } from './identify-customer';

export { recordConsent, hasActiveConsent, POLICY_VERSION } from './record-consent';
export type { ConsentPurpose, ConsentSource, RecordConsentInput, ConsentWriteResult } from './record-consent';

export { recordVisit } from './record-visit';
export type { VisitChannel, RecordVisitInput, VisitWriteResult } from './record-visit';

export { linkOrder } from './link-order';
export type { LinkOrderInput, LinkOrderResult } from './link-order';

export { classifyIdentifier, normalizePhone, isPlausibleVnPhone } from './helpers';
export type { IdentifierType } from './helpers';

export {
  resolveServerOrderOwnership,
  findCustomerByIdentifier,
  canAccessOrder,
  claimGuestOrder,
} from './policies/order-ownership-policy';
export type {
  IdentityLadderStage,
  ActorContext,
  OrderOwnershipResolution,
  ResolveOwnershipInput,
  ClaimGuestOrderInput,
  ClaimGuestOrderResult,
} from './policies/order-ownership-policy';

export {
  sanitizeCustomerEventPayload,
  createCanonicalCustomerEvent,
} from './events/customer-crm-event-contract';
export type {
  CanonicalEventType,
  CanonicalCustomerEvent,
  OrderCreatedPayload,
  OrderPaidPayload,
  OrderCancelledPayload,
  OrderCompletedPayload,
  VisitRecordedPayload,
  CustomerIdentifiedPayload,
  CustomerLinkedPayload,
  AnyEventPayload,
} from './events/customer-crm-event-contract';

export {
  dispatchCustomerEvent,
} from './events/customer-event-dispatcher';
export type {
  DispatchCustomerEventInput,
  DispatchCustomerEventResult,
} from './events/customer-event-dispatcher';

export {
  getCustomerCanonicalProfile,
  findOrCreateCustomerByIdentifier,
  mergeCustomerProfiles,
} from './policies/customer-lifecycle-policy';
export type {
  CanonicalCustomer,
  CustomerProfileView,
  CustomerIdentifier,
  CustomerConsent,
  CustomerMergeInput,
  CustomerMergeResult,
  CustomerIdentifierType,
  LoyaltyTier,
} from './model/customer-canonical-model';


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

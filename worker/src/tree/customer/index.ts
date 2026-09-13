/**
 * Re-export shim — customer domain lives in @aura/domain-customer.
 *
 * Old tree/ path stays live and deployable until M2 migrates callers
 * one by one. Do not add new logic here.
 */

export {
  identifyCustomer,
  recordConsent,
  hasActiveConsent,
  POLICY_VERSION,
  recordVisit,
  linkOrder,
  classifyIdentifier,
  normalizePhone,
  isPlausibleVnPhone,
} from '@aura/domain-customer';

export type {
  IdentifyCustomerInput,
  IdentifiedIdentity,
} from '@aura/domain-customer';

export type {
  ConsentPurpose,
  ConsentSource,
  RecordConsentInput,
  ConsentWriteResult,
} from '@aura/domain-customer';

export type {
  VisitChannel,
  RecordVisitInput,
  VisitWriteResult,
} from '@aura/domain-customer';

export type {
  LinkOrderInput,
  LinkOrderResult,
} from '@aura/domain-customer';

export type { IdentifierType } from '@aura/domain-customer';

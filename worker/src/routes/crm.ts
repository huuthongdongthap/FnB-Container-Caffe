/**
 * CRM Routes — /api/crm
 * Re-exported from modular crm-handlers/
 * - customer-handlers.ts: customer events, profile, 360, referral codes
 * - account-handlers.ts: self-service account me, consent updates, consent purposes
 * - order-handlers.ts: digital menu, online ordering, fulfillment locations & status
 * - segment-handlers.ts: segment definitions & customer membership queries
 */

import { crmRouter } from './crm-handlers';

export { crmRouter } from './crm-handlers';
export default crmRouter;

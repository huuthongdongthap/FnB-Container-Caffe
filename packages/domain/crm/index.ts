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

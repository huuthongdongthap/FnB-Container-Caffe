/**
 * Mautic Bridge Routes — /api/mautic-bridge
 * Thin re-exports to tree/mautic/. Business logic extracted.
 */

export { toMauticContact } from '../tree/mautic/contact-mapper';
export { syncSegments } from '../tree/mautic/segment-sync';
export { trackEnrollment, isAlreadyEnrolled } from '../tree/mautic/enrollment-tracker';
export { detectWinbackCandidates, detectBirthdayCandidates } from '../tree/mautic/campaign-detection';
export { triggerPromoCampaign } from '../tree/mautic/promo-campaign';
export { syncMauticContacts } from '../tree/mautic/contact-sync-cron';
export { handleMauticBridgeRequest } from '../tree/mautic/bridge-handler';

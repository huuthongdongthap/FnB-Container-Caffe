/**
 * Cron Routes — Scheduled task handlers barrel re-export
 * Split into worker/src/routes/cron-handlers/
 * - erpnext-sync.ts: processErpnextRetryQueue, processErpnextProductSync
 * - order-checks.ts: checkOverdueOrders
 * - cashback-warnings.ts: sendCashbackExpiryWarnings
 * - campaigns.ts: runCampaignTriggers
 * - index.ts: Barrel export
 */

export {
  processErpnextRetryQueue,
  processErpnextProductSync,
  checkOverdueOrders,
  sendCashbackExpiryWarnings,
  runCampaignTriggers,
  syncMauticContacts,
  detectWinbackCandidates,
  detectBirthdayCandidates
} from './cron-handlers';

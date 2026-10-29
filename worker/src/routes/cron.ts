/**
 * Cron Routes — Scheduled task handlers barrel re-export
 * Split into worker/src/routes/cron-handlers/
 * - erpnext-sync.ts: processErpnextRetryQueue, processErpnextProductSync
 * - order-checks.ts: checkOverdueOrders
 * - cashback-warnings.ts: sendCashbackExpiryWarnings
 * - campaigns.ts: runCampaignTriggers
 * - sop-reminders.ts: runSopReminders
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
  detectBirthdayCandidates,
  runSopReminders,
  runPaymentReconciliation,
} from './cron-handlers';

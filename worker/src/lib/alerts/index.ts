/**
 * Alerts module central barrel — exports types, formatters, transports, and dispatchers.
 */

export { type AlertThreshold, ALERT_THRESHOLDS } from './types';
export { sendTelegramMessage } from './telegram';
export {
  type AlertRecord,
  type DigestStats,
  formatAlertMessage,
  formatBilingualDigestMessage,
  formatLegacyDigestMessage,
  formatThresholdAlert
} from './formatters';
export { dispatchDigest, dispatchDigestViaCallback } from './digest';
export { dispatchAlerts } from './dispatcher';
export { createAlertDispatcher } from './factory';

/**
 * Alert Dispatcher — compatibility barrel.
 * Re-exports modularized alert subsystems from ./alerts/index.
 */

export {
  type AlertThreshold,
  ALERT_THRESHOLDS,
  sendTelegramMessage,
  formatAlertMessage,
  formatBilingualDigestMessage,
  formatLegacyDigestMessage,
  formatThresholdAlert,
  dispatchDigest,
  dispatchDigestViaCallback,
  dispatchAlerts,
  createAlertDispatcher
} from './alerts/index';

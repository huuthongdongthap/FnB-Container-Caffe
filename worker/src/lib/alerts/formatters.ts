/**
 * Message formatting utilities for alerts and daily digests.
 */

export interface AlertRecord {
  id?: string | number;
  alert_key: string;
  message: string;
  severity: string;
  created_at: string;
}

export interface DigestStats {
  orderCount: number;
  revenueTotal: number;
  errorCount: number;
  totalCount: number;
  successRate?: string;
}

/**
 * Format alert notification message with severity emojis.
 */
export function formatAlertMessage(
  alert: AlertRecord,
  locale: 'vi' | 'en' = 'vi'
): string {
  const emoji =
    alert.severity === 'critical'
      ? '🚨'
      : alert.severity === 'warning'
        ? '⚠️'
        : 'ℹ️';

  return locale === 'vi'
    ? [
      `${emoji} *AURA CAFE Cảnh báo: ${alert.alert_key}*`,
      '',
      `📝 ${alert.message}`,
      `🔴 Mức độ: ${alert.severity === 'critical' ? 'NGHIÊM TRỌNG' : alert.severity === 'warning' ? 'CẢNH BÁO' : 'THÔNG TIN'}`,
      `🕐 ${alert.created_at}`,
      '',
      '_— AURA CAFE Giám sát —_'
    ].join('\n')
    : [
      `${emoji} *AURA CAFE Alert: ${alert.alert_key}*`,
      '',
      `📝 ${alert.message}`,
      `🔴 Severity: ${alert.severity.toUpperCase()}`,
      `🕐 ${alert.created_at}`,
      '',
      '_— AURA CAFE Observability_'
    ].join('\n');
}

/**
 * Format bilingual daily digest for standalone dispatchDigest.
 */
export function formatBilingualDigestMessage(
  stats: DigestStats,
  dateStr: string
): string {
  return [
    '📊 *AURA CAFE Daily Digest / Bản tin hàng ngày*',
    `📅 ${dateStr}`,
    '',
    `🛒 *Đơn hàng / Orders:* ${stats.orderCount}`,
    `💰 *Doanh thu / Revenue:* ${new Intl.NumberFormat('vi-VN').format(
      stats.revenueTotal
    )} VND`,
    `✅ *Tỷ lệ thành công / Success Rate:* ${stats.successRate}%`,
    `❌ *Lỗi / Errors:* ${stats.errorCount}`,
    '',
    '_— AURA CAFE Observability —_'
  ].join('\n');
}

/**
 * Format legacy daily digest for createAlertDispatcher.
 */
export function formatLegacyDigestMessage(
  stats: DigestStats,
  locale: 'vi' | 'en' = 'vi'
): string {
  const dateStr = new Date().toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh'
  });
  const successRate = ((1 - stats.errorCount / stats.totalCount) * 100).toFixed(1);

  return locale === 'vi'
    ? [
      '📊 *AURA CAFE Bản tin hàng ngày*',
      `📅 ${dateStr}`,
      '',
      `🛒 Đơn hàng: ${stats.orderCount}`,
      `💰 Doanh thu: ${new Intl.NumberFormat('vi-VN').format(stats.revenueTotal)} VND`,
      `✅ Tỷ lệ thành công: ${successRate}%`,
      `❌ Lỗi: ${stats.errorCount}`,
      '',
      '_— AURA CAFE Giám sát —_'
    ].join('\n')
    : [
      '📊 *AURA CAFE Daily Digest*',
      `📅 ${dateStr}`,
      '',
      `🛒 Orders: ${stats.orderCount}`,
      `💰 Revenue: ${new Intl.NumberFormat('vi-VN').format(stats.revenueTotal)} VND`,
      `✅ Success Rate: ${successRate}%`,
      `❌ Errors: ${stats.errorCount}`,
      '',
      '_— AURA CAFE Observability_'
    ].join('\n');
}

/**
 * Format threshold alert message.
 */
export function formatThresholdAlert(
  description: string,
  value: number,
  thresholdValue: number,
  locale: 'vi' | 'en' = 'vi'
): string {
  return locale === 'vi'
    ? `${description}\n📊 Giá trị hiện tại: ${value} / Ngưỡng: ${thresholdValue}`
    : `${description}\n📊 Current: ${value} / Threshold: ${thresholdValue}`;
}

/**
 * Alert threshold definitions and interfaces
 */

export interface AlertThreshold {
  /** Key định danh ngưỡng / Threshold identifier key */
  key: string;
  /** Mô tả bằng tiếng Anh / English description */
  description: string;
  /** Mức độ nghiêm trọng / Severity level */
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Danh sách các ngưỡng cảnh báo mà hệ thống hỗ trợ.
 * List of alert thresholds supported by the system.
 */
export const ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    key: 'order_stuck',
    description: 'Orders stuck in "preparing" status for more than 15 minutes',
    severity: 'critical'
  },
  {
    key: 'payment_failure',
    description: 'Payment webhook failure detected',
    severity: 'warning'
  },
  {
    key: 'worker_5xx_rate',
    description: 'Worker 5xx error rate exceeds 5%',
    severity: 'warning'
  },
  {
    key: 'd1_latency_high',
    description: 'D1 query latency exceeds 500ms',
    severity: 'info'
  },
  {
    key: 'failed_login_spike',
    description: 'Failed login attempts exceed 10 per minute',
    severity: 'warning'
  },
  {
    key: 'order_volume_anomaly',
    description: 'Order volume exceeds 3x hourly average',
    severity: 'info'
  }
];

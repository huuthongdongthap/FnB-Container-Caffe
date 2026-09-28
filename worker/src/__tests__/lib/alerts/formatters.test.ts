/**
 * Unit tests for alert formatters.
 */
import { describe, it, expect } from 'vitest';
import {
  formatAlertMessage,
  formatBilingualDigestMessage,
  formatLegacyDigestMessage,
  formatThresholdAlert,
  type AlertRecord,
  type DigestStats
} from '../../../lib/alerts/formatters';

describe('alert formatters', () => {
  describe('formatAlertMessage', () => {
    it('formats critical alert in Vietnamese', () => {
      const alert: AlertRecord = {
        alert_key: 'order_stuck',
        message: 'Order #123 stuck in preparing',
        severity: 'critical',
        created_at: '2024-01-15T10:30:00Z'
      };
      const msg = formatAlertMessage(alert, 'vi');
      expect(msg).toContain('🚨');
      expect(msg).toContain('AURA CAFE Cảnh báo: order_stuck');
      expect(msg).toContain('NGHIÊM TRỌNG');
      expect(msg).toContain('Order #123 stuck in preparing');
      expect(msg).toContain('2024-01-15T10:30:00Z');
    });

    it('formats warning alert in Vietnamese', () => {
      const alert: AlertRecord = {
        alert_key: 'payment_failure',
        message: 'PayOS webhook timeout',
        severity: 'warning',
        created_at: '2024-01-15T10:30:00Z'
      };
      const msg = formatAlertMessage(alert, 'vi');
      expect(msg).toContain('⚠️');
      expect(msg).toContain('CẢNH BÁO');
    });

    it('formats info alert in Vietnamese', () => {
      const alert: AlertRecord = {
        alert_key: 'd1_latency_high',
        message: 'Query took 600ms',
        severity: 'info',
        created_at: '2024-01-15T10:30:00Z'
      };
      const msg = formatAlertMessage(alert, 'vi');
      expect(msg).toContain('ℹ️');
      expect(msg).toContain('THÔNG TIN');
    });

    it('formats alert in English', () => {
      const alert: AlertRecord = {
        alert_key: 'order_stuck',
        message: 'Order stuck',
        severity: 'critical',
        created_at: '2024-01-15T10:30:00Z'
      };
      const msg = formatAlertMessage(alert, 'en');
      expect(msg).toContain('AURA CAFE Alert: order_stuck');
      expect(msg).toContain('CRITICAL');
    });
  });

  describe('formatBilingualDigestMessage', () => {
    it('formats bilingual digest with all stats', () => {
      const stats: DigestStats = {
        orderCount: 42,
        revenueTotal: 5000000,
        errorCount: 3,
        totalCount: 1000,
        successRate: '99.7'
      };
      const msg = formatBilingualDigestMessage(stats, 'Thứ Hai, 15 tháng 1 năm 2024');
      expect(msg).toContain('AURA CAFE Daily Digest / Bản tin hàng ngày');
      expect(msg).toContain('Thứ Hai, 15 tháng 1 năm 2024');
      expect(msg).toContain('42'); // orders
      expect(msg).toContain('5.000.000'); // revenue formatted
      expect(msg).toContain('99.7%'); // success rate
      expect(msg).toContain('3'); // errors
    });
  });

  describe('formatLegacyDigestMessage', () => {
    it('formats Vietnamese legacy digest', () => {
      const stats: DigestStats = {
        orderCount: 10,
        revenueTotal: 1500000,
        errorCount: 1,
        totalCount: 200
      };
      const msg = formatLegacyDigestMessage(stats, 'vi');
      expect(msg).toContain('Bản tin hàng ngày');
      expect(msg).toContain('10');
      expect(msg).toContain('1.500.000');
    });

    it('formats English legacy digest', () => {
      const stats: DigestStats = {
        orderCount: 10,
        revenueTotal: 1500000,
        errorCount: 1,
        totalCount: 200
      };
      const msg = formatLegacyDigestMessage(stats, 'en');
      expect(msg).toContain('Daily Digest');
      expect(msg).toContain('Orders: 10');
    });
  });

  describe('formatThresholdAlert', () => {
    it('formats threshold alert in Vietnamese', () => {
      const msg = formatThresholdAlert('Worker 5xx rate high', 7, 5, 'vi');
      expect(msg).toContain('Giá trị hiện tại: 7');
      expect(msg).toContain('Ngưỡng: 5');
    });

    it('formats threshold alert in English', () => {
      const msg = formatThresholdAlert('Worker 5xx rate high', 7, 5, 'en');
      expect(msg).toContain('Current: 7');
      expect(msg).toContain('Threshold: 5');
    });
  });
});
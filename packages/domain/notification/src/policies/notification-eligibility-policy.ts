/**
 * Notification Eligibility & Payload Sanitization Policy
 * Enforces customer consent, channel eligibility, template integrity, and zero secret leakage.
 */

import type { ChannelType, RecipientInfo, NotificationIntent } from '../model/notification-types';

const SECRET_KEY_PATTERN = /password|secret|token|api_key|auth|bearer|cvv|pan|card_number/i;

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export function evaluateChannelEligibility(
  channel: ChannelType,
  recipient: RecipientInfo,
  options?: { isMarketing?: boolean; hasConsent?: boolean }
): EligibilityResult {
  if (options?.isMarketing && options.hasConsent === false) {
    return { eligible: false, reason: 'customer_opted_out_or_missing_consent' };
  }

  switch (channel) {
    case 'email':
      if (!recipient.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) {
        return { eligible: false, reason: 'invalid_or_missing_email' };
      }
      return { eligible: true };

    case 'sms':
    case 'zalo_zns':
      if (!recipient.phone || recipient.phone.replace(/\D/g, '').length < 9) {
        return { eligible: false, reason: 'invalid_or_missing_phone' };
      }
      return { eligible: true };

    case 'web_push':
      if (!recipient.pushSubscription || typeof recipient.pushSubscription !== 'object') {
        return { eligible: false, reason: 'missing_push_subscription' };
      }
      return { eligible: true };

    case 'telegram':
      if (!recipient.telegramChatId) {
        return { eligible: false, reason: 'missing_telegram_chat_id' };
      }
      return { eligible: true };

    case 'in_app':
      if (!recipient.userId && !recipient.customerId) {
        return { eligible: false, reason: 'missing_user_or_customer_id' };
      }
      return { eligible: true };

    default:
      return { eligible: false, reason: 'unknown_channel' };
  }
}

export function sanitizeNotificationPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(payload)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      if (Array.isArray(val)) {
        sanitized[key] = val.map(item => (typeof item === 'object' && item !== null ? sanitizeNotificationPayload(item as Record<string, unknown>) : item));
      } else {
        sanitized[key] = sanitizeNotificationPayload(val as Record<string, unknown>);
      }
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

export function validateTemplatePayload(
  templateId: string,
  payload: Record<string, unknown>,
  requiredFields: string[] = []
): { valid: boolean; missingFields?: string[] } {
  if (!templateId || templateId.trim() === '') {
    return { valid: false, missingFields: ['templateId'] };
  }
  const missing = requiredFields.filter(f => payload[f] === undefined || payload[f] === null || payload[f] === '');
  if (missing.length > 0) {
    return { valid: false, missingFields: missing };
  }
  return { valid: true };
}

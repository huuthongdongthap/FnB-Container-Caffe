/**
 * Canonical Notification Orchestration Policy
 * Implements Domain Event -> Notification Intent -> Eligibility -> Dispatch -> Result recording.
 * Strict invariants: zero Order/Payment state mutation, stable idempotency, bounded retries.
 */

import type {
  ChannelType, ProviderType, DomainNotificationEvent, NotificationIntent,
  NotificationResult, ProviderCallback, RecipientInfo,
} from '../model/notification-types';
import {
  evaluateChannelEligibility, sanitizeNotificationPayload, validateTemplatePayload,
} from './notification-eligibility-policy';

export interface DispatchProviderFn {
  (intent: NotificationIntent): Promise<{ ok: boolean; providerMessageId?: string; error?: string; isTransient?: boolean }>;
}

export function createNotificationIntent(
  event: DomainNotificationEvent,
  channel: ChannelType,
  provider: ProviderType,
  recipient: RecipientInfo,
  templateId: string,
  options?: { idempotencyKey?: string; maxRetries?: number }
): NotificationIntent {
  const recipientTarget = recipient.phone || recipient.email || recipient.customerId || recipient.telegramChatId || 'unknown';
  const idempotencyKey = options?.idempotencyKey || `ntf_${event.id}_${channel}_${recipientTarget}`;
  const now = new Date().toISOString();

  return {
    id: `ntf_intent_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`,
    eventId: event.id,
    channel,
    provider,
    recipient,
    templateId,
    renderedPayload: sanitizeNotificationPayload(event.payload),
    idempotencyKey,
    status: 'pending',
    retryCount: 0,
    maxRetries: options?.maxRetries ?? 3,
    correlationId: event.correlationId || null,
    tenantId: event.tenantId || null,
    operatingUnitId: event.operatingUnitId || null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function processNotificationIntent(
  db: any,
  intent: NotificationIntent,
  providerFn: DispatchProviderFn,
  options?: { isMarketing?: boolean; hasConsent?: boolean; requiredFields?: string[] }
): Promise<NotificationResult> {
  const eligibility = evaluateChannelEligibility(intent.channel, intent.recipient, {
    isMarketing: options?.isMarketing,
    hasConsent: options?.hasConsent,
  });

  if (!eligibility.eligible) {
    intent.status = 'suppressed';
    intent.errorReason = eligibility.reason || 'ineligible';
    await recordDeliveryLog(db, intent);
    return { ok: false, intentId: intent.id, status: 'suppressed', error: intent.errorReason, retryable: false };
  }

  const templateCheck = validateTemplatePayload(intent.templateId, intent.renderedPayload, options?.requiredFields);
  if (!templateCheck.valid) {
    intent.status = 'dead_letter';
    intent.errorReason = `invalid_template_payload: ${templateCheck.missingFields?.join(', ')}`;
    await recordDeliveryLog(db, intent);
    return { ok: false, intentId: intent.id, status: 'dead_letter', error: intent.errorReason, retryable: false };
  }

  try {
    const outcome = await providerFn(intent);
    if (outcome.ok) {
      intent.status = 'delivered';
      intent.updatedAt = new Date().toISOString();
      await recordDeliveryLog(db, intent, outcome.providerMessageId);
      return { ok: true, intentId: intent.id, status: 'delivered', providerMessageId: outcome.providerMessageId };
    }

    intent.retryCount += 1;
    const isTransient = outcome.isTransient ?? true;
    intent.status = (isTransient && intent.retryCount < intent.maxRetries) ? 'failed' : 'dead_letter';
    intent.errorReason = outcome.error || 'provider_delivery_error';
    intent.updatedAt = new Date().toISOString();
    await recordDeliveryLog(db, intent);

    return {
      ok: false,
      intentId: intent.id,
      status: intent.status,
      error: intent.errorReason,
      retryable: intent.status === 'failed',
    };
  } catch (err: any) {
    intent.retryCount += 1;
    intent.status = intent.retryCount < intent.maxRetries ? 'failed' : 'dead_letter';
    intent.errorReason = `provider_outage_exception: ${String(err?.message || err)}`;
    intent.updatedAt = new Date().toISOString();
    await recordDeliveryLog(db, intent);

    return {
      ok: false,
      intentId: intent.id,
      status: intent.status,
      error: intent.errorReason,
      retryable: intent.status === 'failed',
    };
  }
}

export function verifyWebhookSignature(signature: string | undefined, secretKey?: string): boolean {
  if (!secretKey) return true;
  if (!signature || signature !== `sig_${secretKey}` || signature.length < 8) {
    return false;
  }
  return true;
}

export function verifyAndDeduplicateCallback(
  callback: ProviderCallback,
  processedKeys: Set<string>,
  secretKey?: string
): { valid: boolean; deduplicated: boolean; reason?: string } {
  if (!verifyWebhookSignature(callback.signature, secretKey)) {
    return { valid: false, deduplicated: false, reason: 'invalid_callback_signature' };
  }
  if (processedKeys.has(callback.idempotencyKey)) {
    return { valid: true, deduplicated: true, reason: 'callback_already_processed' };
  }
  processedKeys.add(callback.idempotencyKey);
  return { valid: true, deduplicated: false };
}

async function recordDeliveryLog(db: any, intent: NotificationIntent, providerMessageId?: string): Promise<void> {
  if (!db?.prepare) return;
  const recipientTarget = intent.recipient.phone || intent.recipient.email || intent.recipient.customerId || intent.recipient.telegramChatId || 'unknown';
  try {
    await db.prepare(
      `INSERT INTO notification_audit_log (
        id, channel, recipient, template_id, status, error_message, retry_count,
        event_id, idempotency_key, correlation_id, provider, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      intent.id, intent.channel, recipientTarget, intent.templateId, intent.status,
      intent.errorReason || null, intent.retryCount, intent.eventId, intent.idempotencyKey,
      intent.correlationId || null, intent.provider, intent.createdAt
    ).run();
  } catch {
    try {
      await db.prepare(
        `INSERT INTO notification_audit_log (
          channel, recipient, phone, template_id, template_key, status, error_message, retry_count,
          event_id, idempotency_key, correlation_id, provider, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        intent.channel, recipientTarget, intent.recipient.phone || recipientTarget,
        intent.templateId, intent.templateId, intent.status,
        intent.errorReason || null, intent.retryCount, intent.eventId, intent.idempotencyKey,
        intent.correlationId || null, intent.provider, intent.createdAt
      ).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO notification_audit_log (
            id, channel, recipient, template_id, status, error_message, retry_count, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          intent.id, intent.channel, recipientTarget, intent.templateId, intent.status,
          intent.errorReason || null, intent.retryCount, intent.createdAt
        ).run();
      } catch {
        try {
          await db.prepare(
            `INSERT INTO notification_audit_log (
              id, channel, phone, template_key, payload, response, error, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            intent.id,
            intent.channel,
            intent.recipient.phone || recipientTarget,
            intent.templateId,
            JSON.stringify(intent.renderedPayload ?? {}),
            providerMessageId || null,
            intent.errorReason || null,
            intent.status,
            intent.createdAt
          ).run();
        } catch {
          try {
            await db.prepare(
              `INSERT INTO notification_audit_log (
                order_id, customer_id, channel, phone, message_type, status, provider_response, sent_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              (intent.renderedPayload?.orderId as string) || intent.eventId || null,
              intent.recipient.customerId || null,
              intent.channel,
              intent.recipient.phone || recipientTarget,
              intent.templateId,
              intent.status,
              providerMessageId || intent.errorReason || null,
              intent.status === 'delivered' ? intent.updatedAt : null,
              intent.createdAt
            ).run();
          } catch {
            // non-blocking
          }
        }
      }
    }
  }
}

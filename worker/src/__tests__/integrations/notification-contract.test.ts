/**
 * Canonical Notification Contract Integration Tests
 * Verifies event-driven intents, delivery status, transient/permanent failures,
 * idempotency, customer consent, template validation, and zero state mutation.
 */
import { describe, it, expect } from 'vitest';
import {
  createNotificationIntent, processNotificationIntent,
  verifyAndDeduplicateCallback, evaluateChannelEligibility,
  sanitizeNotificationPayload, type DomainNotificationEvent,
} from '@aura/domain-notification';

function createMockDb() {
  const rows: any[] = [];
  return {
    getRows: () => rows,
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind: (...args: unknown[]) => { binds = args; return stmt; },
        run: async () => {
          if (sql.includes('INSERT INTO notification_audit_log')) {
            rows.push({
              id: binds[0], channel: binds[1], recipient: binds[2], template_id: binds[3],
              status: binds[4], error_message: binds[5], retry_count: binds[6],
              event_id: binds[7], idempotency_key: binds[8], correlation_id: binds[9],
              provider: binds[10], created_at: binds[11],
            });
          }
          return { success: true };
        },
      };
      return stmt as any;
    },
  };
}

describe('Canonical Notification Contract', () => {
  const sampleEvent: DomainNotificationEvent = {
    id: 'evt_order_101', name: 'order.created', aggregateType: 'order', aggregateId: 'ord_101',
    occurredAt: '2026-10-09T10:00:00Z', correlationId: 'corr_lifecycle_101',
    payload: { orderId: 'ord_101', total: 55000, customerName: 'Alice', token: 'SECRET_JWT' },
  };

  it('1. successful delivery: creates intent, dispatches to provider, records delivered state', async () => {
    const db = createMockDb();
    const intent = createNotificationIntent(sampleEvent, 'email', 'resend', { email: 'alice@example.com' }, 'order_confirmation');
    const res = await processNotificationIntent(db, intent, async () => ({ ok: true, providerMessageId: 'msg_resend_999' }));

    expect(res.ok).toBe(true);
    expect(res.status).toBe('delivered');
    expect(res.providerMessageId).toBe('msg_resend_999');
    expect(db.getRows().length).toBe(1);
    expect(db.getRows()[0].status).toBe('delivered');
  });

  it('2. transient vs permanent failure: transient is retryable, permanent marks dead_letter', async () => {
    const db = createMockDb();
    const transientIntent = createNotificationIntent(sampleEvent, 'sms', 'speedsms', { phone: '0901234567' }, 'sms_otp');
    const transientRes = await processNotificationIntent(db, transientIntent, async () => ({ ok: false, error: '504 Gateway Timeout', isTransient: true }));
    expect(transientRes.status).toBe('failed');
    expect(transientRes.retryable).toBe(true);

    const permIntent = createNotificationIntent(sampleEvent, 'email', 'resend', { email: 'bob@example.com' }, 'welcome_email');
    const permRes = await processNotificationIntent(db, permIntent, async () => ({ ok: false, error: '400 Bad Template ID', isTransient: false }));
    expect(permRes.status).toBe('dead_letter');
    expect(permRes.retryable).toBe(false);
  });

  it('3. duplicate event: stable idempotency key deduplicates identical dispatches', () => {
    const intent1 = createNotificationIntent(sampleEvent, 'email', 'resend', { email: 'alice@example.com' }, 'receipt');
    const intent2 = createNotificationIntent(sampleEvent, 'email', 'resend', { email: 'alice@example.com' }, 'receipt');
    expect(intent1.idempotencyKey).toBe(intent2.idempotencyKey);
    expect(intent1.idempotencyKey).toContain('ntf_evt_order_101_email_alice@example.com');
  });

  it('4. retry/idempotency: bounded retries increment attempt count up to maxRetries', async () => {
    const db = createMockDb();
    const intent = createNotificationIntent(sampleEvent, 'telegram', 'telegram_bot', { telegramChatId: 'chat_123' }, 'kds_alert', { maxRetries: 2 });
    await processNotificationIntent(db, intent, async () => ({ ok: false, isTransient: true }));
    expect(intent.retryCount).toBe(1);
    expect(intent.status).toBe('failed');

    await processNotificationIntent(db, intent, async () => ({ ok: false, isTransient: true }));
    expect(intent.retryCount).toBe(2);
    expect(intent.status).toBe('dead_letter');
  });

  it('5. provider timeout/outage: unhandled provider exception is caught safely without mutating business state', async () => {
    const db = createMockDb();
    const intent = createNotificationIntent(sampleEvent, 'zalo_zns', 'zalo', { phone: '0912345678' }, 'order_pickup');
    const res = await processNotificationIntent(db, intent, async () => { throw new Error('Zalo API Connection Refused'); });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('provider_outage_exception');
    expect(res.retryable).toBe(true);
  });

  it('6. invalid callback: rejects signature mismatch, deduplicates valid callbacks', () => {
    const seen = new Set<string>();
    const badSig = verifyAndDeduplicateCallback({ provider: 'resend', providerMessageId: 'm1', idempotencyKey: 'cb_1', status: 'delivered', signature: 'wrong' }, seen, 'my_secret');
    expect(badSig.valid).toBe(false);

    const good = verifyAndDeduplicateCallback({ provider: 'resend', providerMessageId: 'm1', idempotencyKey: 'cb_1', status: 'delivered', signature: 'sig_my_secret' }, seen, 'my_secret');
    expect(good.valid).toBe(true);
    expect(good.deduplicated).toBe(false);

    const dup = verifyAndDeduplicateCallback({ provider: 'resend', providerMessageId: 'm1', idempotencyKey: 'cb_1', status: 'delivered', signature: 'sig_my_secret' }, seen, 'my_secret');
    expect(dup.valid).toBe(true);
    expect(dup.deduplicated).toBe(true);
  });

  it('7. customer opt-out/preferences: suppresses marketing when consent is missing', () => {
    const denied = evaluateChannelEligibility('email', { email: 'guest@example.com' }, { isMarketing: true, hasConsent: false });
    expect(denied.eligible).toBe(false);
    expect(denied.reason).toBe('customer_opted_out_or_missing_consent');

    const granted = evaluateChannelEligibility('email', { email: 'guest@example.com' }, { isMarketing: true, hasConsent: true });
    expect(granted.eligible).toBe(true);
  });

  it('8. template/payload validation: masks secrets and rejects missing required fields', async () => {
    const db = createMockDb();
    const sanitized = sanitizeNotificationPayload({ user: 'Alice', token: 'TOP_SECRET', card_number: '453201501234' });
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.card_number).toBe('[REDACTED]');
    expect(sanitized.user).toBe('Alice');

    const intent = createNotificationIntent(sampleEvent, 'email', 'resend', { email: 'alice@example.com' }, 'missing_field_tmpl');
    const res = await processNotificationIntent(db, intent, async () => ({ ok: true }), { requiredFields: ['nonExistentField'] });
    expect(res.status).toBe('dead_letter');
    expect(res.error).toContain('invalid_template_payload');
  });

  it('9. delivery status and audit correlation: correlates event and correlation ID', async () => {
    const db = createMockDb();
    const intent = createNotificationIntent(sampleEvent, 'web_push', 'vapid', { pushSubscription: { endpoint: 'https://push' } }, 'order_ready');
    await processNotificationIntent(db, intent, async () => ({ ok: true }));
    const row = db.getRows()[0];
    expect(row.event_id).toBe('evt_order_101');
    expect(row.correlation_id).toBe('corr_lifecycle_101');
    expect(row.provider).toBe('vapid');
  });

  it('10. schema/migration compatibility: supports both canonical and legacy column binds', async () => {
    let legacyInsertCalled = false;
    const legacyDb = {
      prepare: (sql: string) => ({
        bind: () => ({
          run: async () => {
            if (sql.includes('event_id')) throw new Error('no such column: event_id');
            legacyInsertCalled = true;
            return { success: true };
          },
        }),
      }),
    };
    const intent = createNotificationIntent(sampleEvent, 'email', 'resend', { email: 'bob@example.com' }, 'test_tmpl');
    await processNotificationIntent(legacyDb, intent, async () => ({ ok: true }));
    expect(legacyInsertCalled).toBe(true);
  });
});

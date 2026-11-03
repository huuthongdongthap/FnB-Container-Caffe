/**
 * Campaign Cron Handler — orchestrates running all campaign triggers
 * Routes each trigger through dedup, send, and log
 */
import { createLogger } from '../../utils/logger';
import { resolvePilotStore } from '../../middleware/tenant';
import {
  deduplicate,
  logSend,
  renderTemplate,
  detectWelcomeCandidates,
  detectBirthdayCandidates,
  detectWinbackCandidates,
  detectPostVisitCandidates,
  detectCashbackExpiry,
  markExpiryNotified,
} from '@aura/domain-crm';
import { sendCampaignSms } from './channels/sms';
import { sendCampaignEmail } from './channels/email';
import { sendCampaignZalo } from './channels/zalo';
import type { CampaignTrigger, CampaignChannel, CampaignCustomer, CampaignResult } from './types';

const log = createLogger({ route: 'campaign-cron' });

interface TriggerResult {
  triggered: number;
  sent: number;
}

interface ChannelConfig {
  channel: CampaignChannel;
  to: (customer: CampaignCustomer) => string | undefined;
}

const CHANNEL_PRIORITY: Record<CampaignTrigger, ChannelConfig[]> = {
  welcome: [
    { channel: 'sms', to: (c) => c.phone },
    { channel: 'email', to: (c) => c.email }
  ],
  birthday: [
    { channel: 'sms', to: (c) => c.phone },
    { channel: 'zalo', to: (c) => c.phone }
  ],
  winback: [
    { channel: 'sms', to: (c) => c.phone }
  ],
  post_visit: [
    { channel: 'sms', to: (c) => c.phone }
  ],
  cashback_expiry: [
    { channel: 'sms', to: (c) => c.phone }
  ]
};

async function processTrigger(
  env: Record<string, unknown>,
  db: import('@cloudflare/workers-types').D1Database,
  trigger: CampaignTrigger,
  customers: CampaignCustomer[],
  tenantId: string
): Promise<TriggerResult> {
  let sent = 0;

  for (const customer of customers) {
    try {
      const effectiveTenant = customer.tenant_id || tenantId;
      const isDuplicate = await deduplicate(db, customer.id, trigger, 7, effectiveTenant);
      if (isDuplicate) {
        continue;
      }

      const channels = CHANNEL_PRIORITY[trigger];
      let customerSent = false;

      for (const { channel, to } of channels) {
        const recipient = to(customer);
        if (!recipient) {
          continue;
        }

        const template = renderTemplate(trigger, {
          name: customer.name,
          amount: customer.total_spent,
          days_left: 7,
        });

        const message = {
          trigger,
          channel,
          to: recipient,
          subject: template.subject,
          body: channel === 'email' ? template.html : template.sms,
          data: { customer_id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, amount: customer.total_spent, days_left: 7, tenant_id: effectiveTenant }
        };

        let result: CampaignResult;

        switch (channel) {
        case 'sms':
          result = await sendCampaignSms(env, message);
          break;
        case 'email':
          result = await sendCampaignEmail(env, message);
          break;
        case 'zalo':
          result = await sendCampaignZalo(env, message, effectiveTenant);
          break;
        default:
          continue;
        }

        await logSend(db, { ...result, tenant_id: effectiveTenant }, effectiveTenant);
        if (result.sent) {
          sent++;
          customerSent = true;
          break; // Only first successful channel
        }
      }

      // For cashback expiry, also mark the customer
      if (trigger === 'cashback_expiry' && customerSent) {
        await markExpiryNotified(db, [customer.id], effectiveTenant);
      }
    } catch (err) {
      log.error('processTrigger customer error', { customerId: customer.id, trigger, error: (err as Error).message });
    }
  }

  return { triggered: customers.length, sent };
}

export async function runCampaignTriggers(
  env: Record<string, unknown>
): Promise<{ triggered: number; sent: number }> {
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) {
    log.warn('AURA_DB not available, skipping campaign triggers');
    return { triggered: 0, sent: 0 };
  }

  const tenantId = resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
  let totalTriggered = 0;
  let totalSent = 0;

  // Welcome — every 15 min
  try {
    const welcome = await detectWelcomeCandidates(db, tenantId);
    if (welcome.length > 0) {
      const result = await processTrigger(env, db, 'welcome', welcome, tenantId);
      totalTriggered += result.triggered;
      totalSent += result.sent;
    }
  } catch (err) {
    log.error('welcome trigger failed', { error: (err as Error).message });
  }

  // Birthday — daily
  try {
    const birthday = await detectBirthdayCandidates(db, tenantId);
    if (birthday.length > 0) {
      const result = await processTrigger(env, db, 'birthday', birthday, tenantId);
      totalTriggered += result.triggered;
      totalSent += result.sent;
    }
  } catch (err) {
    log.error('birthday trigger failed', { error: (err as Error).message });
  }

  // Winback — daily
  try {
    const winback = await detectWinbackCandidates(db, tenantId);
    if (winback.length > 0) {
      const result = await processTrigger(env, db, 'winback', winback, tenantId);
      totalTriggered += result.triggered;
      totalSent += result.sent;
    }
  } catch (err) {
    log.error('winback trigger failed', { error: (err as Error).message });
  }

  // Post-visit — every 30 min
  try {
    const postVisit = await detectPostVisitCandidates(db, tenantId);
    if (postVisit.length > 0) {
      const result = await processTrigger(env, db, 'post_visit', postVisit, tenantId);
      totalTriggered += result.triggered;
      totalSent += result.sent;
    }
  } catch (err) {
    log.error('post_visit trigger failed', { error: (err as Error).message });
  }

  // Cashback expiry — daily
  try {
    const cashback = await detectCashbackExpiry(db, tenantId);
    if (cashback.length > 0) {
      const result = await processTrigger(env, db, 'cashback_expiry', cashback, tenantId);
      totalTriggered += result.triggered;
      totalSent += result.sent;
    }
  } catch (err) {
    log.error('cashback_expiry trigger failed', { error: (err as Error).message });
  }

  log.info('campaign_triggers_complete', { totalTriggered, totalSent });
  return { triggered: totalTriggered, sent: totalSent };
}

/**
 * Campaign Cron Handler — orchestrates running all campaign triggers
 * Routes each trigger through dedup, send, and log
 */
import { createLogger } from '../../utils/logger';
import { deduplicate, logSend } from './campaign-engine';
import { renderTemplate } from './templates';
import { detectWelcomeCandidates } from './triggers/welcome';
import { detectBirthdayCandidates } from './triggers/birthday';
import { detectWinbackCandidates } from './triggers/winback';
import { detectPostVisitCandidates } from './triggers/post-visit';
import { detectCashbackExpiry, markExpiryNotified } from './triggers/cashback-expiry';
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
  customers: CampaignCustomer[]
): Promise<TriggerResult> {
  let sent = 0;

  for (const customer of customers) {
    try {
      const isDuplicate = await deduplicate(db, customer.id, trigger, 7);
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

        const template = renderTemplate(trigger, customer.name, {
          ...customer,
          customer_id: customer.id
        });

        const message = {
          trigger,
          channel,
          to: recipient,
          subject: template.subject,
          body: channel === 'email' ? template.html : template.sms,
          data: { customer_id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, amount: customer.total_spent, days_left: 7 }
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
          result = await sendCampaignZalo(env, message);
          break;
        default:
          continue;
        }

        await logSend(db, result);
        if (result.sent) {
          sent++;
          customerSent = true;
          break; // Only first successful channel
        }
      }

      // For cashback expiry, also mark the customer
      if (trigger === 'cashback_expiry' && customerSent) {
        await markExpiryNotified(db, [customer.id]);
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

  let totalTriggered = 0;
  let totalSent = 0;

  // Welcome — every 15 min
  try {
    const welcome = await detectWelcomeCandidates(db);
    if (welcome.length > 0) {
      const result = await processTrigger(env, db, 'welcome', welcome);
      totalTriggered += result.triggered;
      totalSent += result.sent;
    }
  } catch (err) {
    log.error('welcome trigger failed', { error: (err as Error).message });
  }

  // Birthday — daily
  try {
    const birthday = await detectBirthdayCandidates(db);
    if (birthday.length > 0) {
      const result = await processTrigger(env, db, 'birthday', birthday);
      totalTriggered += result.triggered;
      totalSent += result.sent;
    }
  } catch (err) {
    log.error('birthday trigger failed', { error: (err as Error).message });
  }

  // Winback — daily
  try {
    const winback = await detectWinbackCandidates(db);
    if (winback.length > 0) {
      const result = await processTrigger(env, db, 'winback', winback);
      totalTriggered += result.triggered;
      totalSent += result.sent;
    }
  } catch (err) {
    log.error('winback trigger failed', { error: (err as Error).message });
  }

  // Post-visit — every 30 min
  try {
    const postVisit = await detectPostVisitCandidates(db);
    if (postVisit.length > 0) {
      const result = await processTrigger(env, db, 'post_visit', postVisit);
      totalTriggered += result.triggered;
      totalSent += result.sent;
    }
  } catch (err) {
    log.error('post_visit trigger failed', { error: (err as Error).message });
  }

  // Cashback expiry — daily
  try {
    const cashback = await detectCashbackExpiry(db);
    if (cashback.length > 0) {
      const result = await processTrigger(env, db, 'cashback_expiry', cashback);
      totalTriggered += result.triggered;
      totalSent += result.sent;
    }
  } catch (err) {
    log.error('cashback_expiry trigger failed', { error: (err as Error).message });
  }

  log.info('campaign_triggers_complete', { totalTriggered, totalSent });
  return { triggered: totalTriggered, sent: totalSent };
}

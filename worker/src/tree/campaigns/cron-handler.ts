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
import { sendPushToCustomer, type PushEnv } from '../push/notifier';
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

interface ResolvedTriggerConfig {
  isActive: boolean;
  channels: CampaignChannel[];
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

function recipientForChannel(channel: CampaignChannel, customer: CampaignCustomer): string | undefined {
  switch (channel) {
  case 'sms':
  case 'zalo':
    return customer.phone;
  case 'email':
    return customer.email;
  case 'push':
    return customer.id;
  default:
    return undefined;
  }
}

function parseChannelsJson(raw: unknown, fallback: CampaignChannel[]): CampaignChannel[] {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const valid = parsed.filter(
      (ch): ch is CampaignChannel => ch === 'sms' || ch === 'email' || ch === 'zalo' || ch === 'push'
    );
    return valid.length > 0 ? valid : fallback;
  } catch {
    return fallback;
  }
}

async function loadTriggerConfigs(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string
): Promise<Map<CampaignTrigger, ResolvedTriggerConfig>> {
  const configs = new Map<CampaignTrigger, ResolvedTriggerConfig>();
  const rows: Array<{ trigger: string; is_active: number | boolean; channels?: string | null }> = [];
  try {
    const res = await db.prepare(
      "SELECT trigger, is_active, channels FROM tenant_campaign_configs WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(tenantId).all<{ trigger: string; is_active: number | boolean; channels?: string | null }>();
    if (res.results && res.results.length > 0) {
      rows.push(...res.results);
    }
  } catch {
    // tenant_campaign_configs table may not exist; fall back to campaign_configs
  }
  if (rows.length === 0) {
    try {
      const res = await db.prepare(
        "SELECT trigger, is_active, channels FROM campaign_configs WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(tenantId).all<{ trigger: string; is_active: number | boolean; channels?: string | null }>();
      if (res.results && res.results.length > 0) {
        rows.push(...res.results);
      }
    } catch {
      try {
        if (tenantId === 'default') {
          const res = await db.prepare(
            'SELECT trigger, is_active, channels FROM campaign_configs'
          ).all<{ trigger: string; is_active: number | boolean; channels?: string | null }>();
          if (res.results) rows.push(...res.results);
        }
      } catch {
        // campaign_configs table absent in minimal test schemas
      }
    }
  }
  for (const row of rows) {
    const trigger = row.trigger as CampaignTrigger;
    const defaults = CHANNEL_PRIORITY[trigger]?.map((c) => c.channel) ?? ['sms'];
    configs.set(trigger, {
      isActive: Boolean(row.is_active),
      channels: parseChannelsJson(row.channels, defaults),
    });
  }
  return configs;
}

async function resolveActiveCampaignTenants(
  db: import('@cloudflare/workers-types').D1Database,
  pilotTenant: string
): Promise<string[]> {
  const tenants = new Set<string>([pilotTenant]);
  try {
    const res = await db.prepare(
      "SELECT id FROM saas_tenants WHERE status IS NULL OR LOWER(status) IN ('active', 'trial', 'trialing')"
    ).all<{ id?: string | null }>();
    for (const r of res.results || []) {
      const id = typeof r.id === 'string' ? r.id.trim() : '';
      if (id) tenants.add(id);
    }
  } catch {
    // saas_tenants may not exist in single-tenant or minimal test DBs
  }
  return Array.from(tenants);
}

async function processTrigger(
  env: Record<string, unknown>,
  db: import('@cloudflare/workers-types').D1Database,
  trigger: CampaignTrigger,
  customers: CampaignCustomer[],
  tenantId: string,
  configuredChannels?: CampaignChannel[]
): Promise<TriggerResult> {
  let sent = 0;

  for (const customer of customers) {
    try {
      const effectiveTenant = customer.tenant_id || tenantId;
      const isDuplicate = await deduplicate(db, customer.id, trigger, 7, effectiveTenant);
      if (isDuplicate) {
        continue;
      }

      const channels: ChannelConfig[] = configuredChannels && configuredChannels.length > 0
        ? configuredChannels.map((channel) => ({
            channel,
            to: (cust: CampaignCustomer) => recipientForChannel(channel, cust),
          }))
        : CHANNEL_PRIORITY[trigger];
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
        case 'push': {
          const pushRes = await sendPushToCustomer(
            env as unknown as PushEnv,
            customer.id,
            {
              title: template.subject || 'AURA SPACE',
              body: template.sms,
              data: { trigger, customer_id: customer.id, tenant_id: effectiveTenant },
            },
            effectiveTenant
          );
          result = {
            trigger,
            channel: 'push',
            customer_id: customer.id,
            sent: pushRes.sent > 0,
            error: pushRes.sent > 0 ? undefined : 'No active push subscriptions',
          };
          break;
        }
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

  const pilotTenant = resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
  const tenants = await resolveActiveCampaignTenants(db, pilotTenant);
  let totalTriggered = 0;
  let totalSent = 0;

  const triggerDetectors: Array<{
    trigger: CampaignTrigger;
    detect: (tenantId: string) => Promise<CampaignCustomer[]>;
  }> = [
    { trigger: 'welcome', detect: (tid) => detectWelcomeCandidates(db, tid) },
    { trigger: 'birthday', detect: (tid) => detectBirthdayCandidates(db, tid) },
    { trigger: 'winback', detect: (tid) => detectWinbackCandidates(db, tid) },
    { trigger: 'post_visit', detect: (tid) => detectPostVisitCandidates(db, tid) },
    { trigger: 'cashback_expiry', detect: (tid) => detectCashbackExpiry(db, tid) },
  ];

  for (const tenantId of tenants) {
    const configMap = await loadTriggerConfigs(db, tenantId);
    for (const { trigger, detect } of triggerDetectors) {
      const cfg = configMap.get(trigger);
      if (cfg && !cfg.isActive) {
        continue;
      }
      try {
        const candidates = await detect(tenantId);
        if (candidates.length > 0) {
          const result = await processTrigger(env, db, trigger, candidates, tenantId, cfg?.channels);
          totalTriggered += result.triggered;
          totalSent += result.sent;
        }
      } catch (err) {
        log.error(`${trigger} trigger failed`, { tenantId, error: (err as Error).message });
      }
    }
  }

  log.info('campaign_triggers_complete', { totalTriggered, totalSent, tenantCount: tenants.length });
  return { triggered: totalTriggered, sent: totalSent };
}

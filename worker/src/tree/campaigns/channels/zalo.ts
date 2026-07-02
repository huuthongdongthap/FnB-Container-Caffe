/**
 * Campaign Zalo Channel — wraps ZNS notification module
 */
import { notifyMember } from '../../zalo/notify-member';
import { createLogger } from '../../../utils/logger';
import type { CampaignMessage, CampaignResult } from '../types';

const log = createLogger({ route: 'campaign-zalo' });

export async function sendCampaignZalo(
  env: Record<string, unknown>,
  message: CampaignMessage,
): Promise<CampaignResult> {
  const customerId = (message.data?.customer_id as string) || 'unknown';

  try {
    const zaloData = message.data || {};
    const result = await notifyMember(env as { ZALO_ACCESS_TOKEN?: string; AURA_DB?: import('@cloudflare/workers-types').D1Database }, {
      customer_id: customerId,
      template_key: mapTriggerToZaloTemplate(message.trigger),
      data: {
        name: zaloData.name as string | undefined,
        amount: zaloData.amount as number | undefined,
        days: (zaloData.days_left as number) || (zaloData.days as number),
      },
    });

    if (result.ok) {
      log.info('campaign_zalo_sent', { trigger: message.trigger, customerId });
    } else {
      log.warn('campaign_zalo_failed', { trigger: message.trigger, customerId, reason: result.reason });
    }

    return {
      trigger: message.trigger,
      channel: 'zalo',
      customer_id: customerId,
      sent: result.ok,
      error: result.ok ? undefined : result.reason || 'send_failed',
    };
  } catch (err) {
    log.error('campaign_zalo_error', { customerId, error: (err as Error).message });
    return { trigger: message.trigger, channel: 'zalo', customer_id: customerId, sent: false, error: 'exception' };
  }
}

function mapTriggerToZaloTemplate(trigger: string): string {
  const map: Record<string, string> = {
    welcome: 'welcome_new',
    birthday: 'birthday_promotion',
    winback: 'winback_offer',
    post_visit: 'post_visit_review',
    cashback_expiry: 'cashback_expiring',
  };
  return map[trigger] || 'general_promotion';
}

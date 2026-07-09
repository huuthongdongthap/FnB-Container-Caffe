/**
 * Campaign SMS Channel — wraps SpeedSMS client
 */
import { sendSMS } from '../../../lib/speedsms-client';
import { createLogger } from '../../../utils/logger';
import type { CampaignMessage, CampaignResult } from '../types';

const log = createLogger({ route: 'campaign-sms' });

export async function sendCampaignSms(
  env: Record<string, unknown>,
  message: CampaignMessage
): Promise<CampaignResult> {
  const customerId = (message.data?.customer_id as string) || 'unknown';

  try {
    const result = await sendSMS(env as Record<string, string | undefined>, {
      phone: message.to,
      message: message.body
    });

    if (result.success) {
      log.info('campaign_sms_sent', { trigger: message.trigger, customerId });
    } else if (result.skipped) {
      log.warn('campaign_sms_skipped', { trigger: message.trigger, customerId });
    } else {
      log.error('campaign_sms_failed', { trigger: message.trigger, customerId });
    }

    return {
      trigger: message.trigger,
      channel: 'sms',
      customer_id: customerId,
      sent: result.success,
      error: result.success ? undefined : result.skipped ? 'skipped' : 'send_failed'
    };
  } catch (err) {
    log.error('campaign_sms_error', { customerId, error: (err as Error).message });
    return { trigger: message.trigger, channel: 'sms', customer_id: customerId, sent: false, error: 'exception' };
  }
}

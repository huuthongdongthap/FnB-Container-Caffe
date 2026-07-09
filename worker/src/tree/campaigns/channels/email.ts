/**
 * Campaign Email Channel — wraps SendGrid email client
 */
import { sendEmail } from '../../../lib/email';
import { createLogger } from '../../../utils/logger';
import type { CampaignMessage, CampaignResult } from '../types';

const log = createLogger({ route: 'campaign-email' });

export async function sendCampaignEmail(
  env: Record<string, unknown>,
  message: CampaignMessage
): Promise<CampaignResult> {
  const customerId = (message.data?.customer_id as string) || 'unknown';

  try {
    const result = await sendEmail(env as Record<string, string | undefined>, {
      to: message.to,
      subject: message.subject || 'AURA CAFE',
      html: message.body
    });

    if (result) {
      log.info('campaign_email_sent', { trigger: message.trigger, customerId });
    } else {
      log.warn('campaign_email_failed', { trigger: message.trigger, customerId });
    }

    return {
      trigger: message.trigger,
      channel: 'email',
      customer_id: customerId,
      sent: result,
      error: result ? undefined : 'send_failed'
    };
  } catch (err) {
    log.error('campaign_email_error', { customerId, error: (err as Error).message });
    return { trigger: message.trigger, channel: 'email', customer_id: customerId, sent: false, error: 'exception' };
  }
}

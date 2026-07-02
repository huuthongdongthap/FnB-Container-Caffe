/**
 * SpeedSMS Client — SpeedSMS.vn HTTP API wrapper for Cloudflare Workers
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'speedsms.send' });
const SPEEDSMS_API = 'https://api.speedsms.vn/index.php/sms/send';

export function normalizePhone(phone: string): string {
  if (!phone) {
    return '';
  }
  const cleaned = String(phone).replace(/^\+?84/, '').replace(/^0/, '');
  return '84' + cleaned;
}

export interface SpeedSMSSendOpts {
  phone: string;
  message: string;
}

export interface SpeedSMSEnv {
  SPEEDSMS_API_KEY?: string;
  SPEEDSMS_API_SECRET?: string;
}

export interface SpeedSMSResponse {
  id?: string;
  transId?: string;
}

export interface SpeedSMSResult {
  success: boolean;
  messageId?: string;
  skipped?: boolean;
}

export async function sendSMS(env: SpeedSMSEnv, opts: SpeedSMSSendOpts): Promise<SpeedSMSResult> {
  const { phone, message } = opts;
  const apiKey = env.SPEEDSMS_API_KEY;
  const apiSecret = env.SPEEDSMS_API_SECRET;

  if (!apiKey || !apiSecret) {
    log.warn('SPEEDSMS_API_KEY or SPEEDSMS_API_SECRET not configured — skipping SMS', {
      hasKey: !!apiKey,
      hasSecret: !!apiSecret,
    });
    return { success: false, skipped: true };
  }

  if (!phone || !message) {
    log.warn('Missing required SMS fields', {
      hasPhone: !!phone,
      hasMessage: !!message,
    });
    return { success: false };
  }

  const normalizedPhone = normalizePhone(phone);
  const auth = btoa(`${apiKey}:${apiSecret}`);

  const payload = {
    to: [normalizedPhone],
    content: message,
    type: 2,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(SPEEDSMS_API, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json().catch(() => ({} as Record<string, unknown>));
      const msgData = data as SpeedSMSResponse;
      const msgId = (msgData.id || msgData.transId || '') as string;
      log.info('sms_sent', { phone: normalizedPhone, messageId: msgId });
      return { success: true, messageId: msgId };
    }

    const body = await response.text();
    log.error('speedsms_api_error', {
      status: response.status,
      body: body.slice(0, 200),
      phone: normalizedPhone,
    });
    return { success: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('speedsms_network_error', { message, phone });
    return { success: false };
  }
}

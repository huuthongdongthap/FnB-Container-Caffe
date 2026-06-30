/**
 * SpeedSMS Client — SpeedSMS.vn HTTP API wrapper for Cloudflare Workers
 *
 * Cost: 490 VND/SMS flat rate across all carriers. ~$6/mo for 300 SMS.
 * Uses brandname sender type (type=2) for Vietnamese customer recognition.
 *
 * Usage:
 *   import { sendSMS, normalizePhone } from '../lib/speedsms-client.js';
 *   const { success, messageId } = await sendSMS(env, { phone, message });
 *
 * Env vars required:
 *   SPEEDSMS_API_KEY      — SpeedSMS API key
 *   SPEEDSMS_API_SECRET   — SpeedSMS API secret
 *
 * API docs: https://speedsms.vn/api
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'speedsms.send' });
const SPEEDSMS_API = 'https://api.speedsms.vn/index.php/sms/send';

/**
 * Normalize phone number to 84XXXXXXXXX format.
 * Removes leading +84, 0, or bare 84 prefix.
 *
 * @param {string} phone — Raw phone number (e.g. "0901234567", "+84901234567")
 * @returns {string} Normalized number — e.g. "84901234567"
 */
export function normalizePhone(phone) {
  if (!phone) {
    return '';
  }
  const cleaned = String(phone).replace(/^\+?84/, '').replace(/^0/, '');
  return '84' + cleaned;
}

/**
 * @param {object} env — Worker env bindings (SPEEDSMS_API_KEY, SPEEDSMS_API_SECRET)
 * @param {object} opts
 * @param {string} opts.phone — Recipient phone number (will be normalized)
 * @param {string} opts.message — SMS message content (Vietnamese UTF-8)
 * @returns {Promise<{success: boolean, messageId?: string, skipped?: boolean}>}
 */
export async function sendSMS(env, { phone, message }) {
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
    type: 2, // 2 = brandname, 3 = fixed number fallback
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
      const data = await response.json().catch(() => ({}));
      const msgId = data.id || data.transId;
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
  } catch (err) {
    log.error('speedsms_network_error', { message: err.message, phone });
    return { success: false };
  }
}

/**
 * Telegram transport helper — shared message sender.
 */

import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'alert-dispatcher' });

/**
 * Gửi tin nhắn văn bản qua Telegram Bot API.
 * Send a text message via the Telegram Bot API.
 *
 * @param token  - Telegram bot token (env.TELEGRAM_BOT_TOKEN)
 * @param chatId - Telegram chat ID (env.TELEGRAM_CHAT_ID)
 * @param text   - Nội dung tin nhắn (Markdown format) / Message content
 * @returns true nếu gửi thành công / true if sent successfully
 */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        }),
        signal: AbortSignal.timeout(5000)
      }
    );
    return res.ok;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('sendTelegramMessage_failed', { error: errMsg });
    return false;
  }
}

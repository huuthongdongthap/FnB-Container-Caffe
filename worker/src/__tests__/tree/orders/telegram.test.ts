/**
 * Unit tests for src/tree/orders/telegram.ts
 * Tests: notifyTelegram — message formatting, fetch call, error handling, no-op cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ── mock logger ── */
vi.mock('../../../middleware/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

/* ── shared mock fetch ── */
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch = vi.fn(async() => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof globalThis.fetch;
  (globalThis as unknown as Record<string, unknown>).fetch = mockFetch;
  mockFetch.mockClear();
});

afterEach(() => {
  (globalThis as Record<string, unknown>).fetch = globalThis.fetch;
});

/* ── imports under test ── */
import { notifyTelegram } from '../../../tree/orders/telegram';

describe('telegram', () => {
  describe('notifyTelegram', () => {
    const makeOrder = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
      id: 'ORD_TELE_TEST',
      customer_name: 'Nguyen Van A',
      customer_phone: '0909123456',
      customer_address: '123 Test Street',
      items: [
        { name: 'Pho Bo', qty: 2, price: 50000 },
        { name: 'Tra Da', quantity: 1, price: 15000 }
      ],
      total: 115000,
      payment_method: 'COD',
      notes: 'Less ice please',
      ...overrides
    });

    function makeEnv(token?: string | null, chatId?: string | null): Record<string, unknown> {
      const env: Record<string, unknown> = {};
      if (token !== undefined) {
        env.TELEGRAM_BOT_TOKEN = token;
      }
      if (chatId !== undefined) {
        env.TELEGRAM_CHAT_ID = chatId;
      }
      return env;
    }

    it('sends formatted message to Telegram API', async() => {
      const env = makeEnv('bot-token-123', 'chat-456');
      const order = makeOrder();

      await notifyTelegram(env, order);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
      expect(url).toBe('https://api.telegram.org/botbot-token-123/sendMessage');

      const [, options] = (mockFetch.mock.calls[0] as unknown[]) as [string, RequestInit];
      expect(options.method).toBe('POST');
      const hdrs = options.headers as Record<string, string> | undefined;
      expect(hdrs?.['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body as string);
      expect(body.chat_id).toBe('chat-456');
      expect(body.parse_mode).toBe('HTML');
      expect(body.text).toContain('DON MBI');
      expect(body.text).toContain('AURA CAFE');
      expect(body.text).toContain('Nguyen Van A');
      expect(body.text).toContain('0909123456');
      expect(body.text).toContain('123 Test Street');
      expect(body.text).toContain('Pho Bo');
      expect(body.text).toContain('Tra Da');
      expect(body.text).toContain('115.000₫');
    });

    it('omits customer_address line when not provided', async() => {
      const env = makeEnv('bot-token-123', 'chat-456');
      const order = makeOrder({ customer_address: null });

      await notifyTelegram(env, order);

      const [, options] = (mockFetch.mock.calls[0] as unknown[]) as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.text).not.toContain('📍');
    });

    it('omits notes line when empty', async() => {
      const env = makeEnv('bot-token-123', 'chat-456');
      const order = makeOrder({ notes: '' });

      await notifyTelegram(env, order);

      const [, options] = (mockFetch.mock.calls[0] as unknown[]) as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.text).not.toContain('📝');
    });

    it('formats currency with vi-VN locale', async() => {
      const env = makeEnv('bot-token-123', 'chat-456');
      const order = makeOrder({ total: 250000 });

      await notifyTelegram(env, order);

      const [, options] = (mockFetch.mock.calls[0] as unknown[]) as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.text).toContain('250.000₫');
    });

    it('returns early when TELEGRAM_BOT_TOKEN is missing', async() => {
      const env = makeEnv(null, 'chat-456');
      const order = makeOrder();

      await notifyTelegram(env, order);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns early when TELEGRAM_CHAT_ID is missing', async() => {
      const env = makeEnv('bot-token-123', null);
      const order = makeOrder();

      await notifyTelegram(env, order);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles telegram API error (non-200 response)', async() => {
      mockFetch.mockImplementationOnce(
        async() => new Response(JSON.stringify({ description: 'chat not found' }), { status: 400 })
      );

      const env = makeEnv('bot-token-123', 'chat-456');
      const order = makeOrder();

      await expect(notifyTelegram(env, order)).resolves.toBeUndefined();
    });

    it('escapes XML special characters in order data', async() => {
      const env = makeEnv('bot-token-123', 'chat-456');
      const order = makeOrder({
        customer_name: 'Nguyen <script>alert(1)</script>',
        notes: 'Extra & more < >'
      });

      await notifyTelegram(env, order);

      const [, options] = (mockFetch.mock.calls[0] as unknown[]) as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.text).toContain('&lt;script&gt;');
      expect(body.text).toContain('&amp;');
      expect(body.text).toContain('&lt;');
      expect(body.text).toContain('&gt;');
      expect(body.text).not.toContain('<script>');
    });

    it('handles items with qty field (preferred) and quantity fallback', async() => {
      const env = makeEnv('bot-token-123', 'chat-456');
      const order = makeOrder({
        items: [
          { name: 'Pizza', qty: 3, price: 90000 },
          { name: 'Salad', quantity: 2, price: 45000 }
        ]
      });

      await notifyTelegram(env, order);

      const [, options] = (mockFetch.mock.calls[0] as unknown[]) as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.text).toContain('Pizza x3');
      expect(body.text).toContain('Salad x2');
    });

    it('uses uppercase payment method in message', async() => {
      const env = makeEnv('bot-token-123', 'chat-456');
      const order = makeOrder({ payment_method: 'zalopay' });

      await notifyTelegram(env, order);

      const [, options] = (mockFetch.mock.calls[0] as unknown[]) as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.text).toContain('ZALOPAY');
    });
  });
});

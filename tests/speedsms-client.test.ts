/**
 * SpeedSMS Client Tests
 *
 * Tests for SpeedSMS.vn API SMS sending utility for Cloudflare Workers.
 * Covers: auth, phone normalization, Vietnamese UTF-8, error handling, missing config.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { sendSMS, normalizePhone } from '../worker/src/lib/speedsms-client.ts';

const mockEnv = {
  SPEEDSMS_API_KEY: 'api-key-123',
  SPEEDSMS_API_SECRET: 'api-secret-456',
};

describe('SpeedSMS Client — normalizePhone', () => {
  test('should keep 84XXXXXXXXX format unchanged', () => {
    expect(normalizePhone('84901234567')).toBe('84901234567');
  });

  test('should remove leading 0 and prepend 84', () => {
    expect(normalizePhone('0901234567')).toBe('84901234567');
  });

  test('should remove leading +84', () => {
    expect(normalizePhone('+84901234567')).toBe('84901234567');
  });

  test('should remove leading +84 even if extra digits', () => {
    expect(normalizePhone('+840901234567')).toBe('84901234567');
  });

  test('should handle bare 84 prefix', () => {
    expect(normalizePhone('840901234567')).toBe('84901234567');
  });
});

describe('SpeedSMS Client — sendSMS', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  test('should return skipped when API keys are missing', async () => {
    const result = await sendSMS({}, { phone: '84901234567', message: 'Test' });
    expect(result).toEqual({ success: false, skipped: true });
  });

  test('should return skipped when only SPEEDSMS_API_KEY is set', async () => {
    const result = await sendSMS(
      { SPEEDSMS_API_KEY: 'key' },
      { phone: '84901234567', message: 'Test' },
    );
    expect(result).toEqual({ success: false, skipped: true });
  });

  test('should return error when required fields are missing', async () => {
    const result = await sendSMS(mockEnv, { phone: '', message: '' });
    expect(result).toEqual({ success: false });
  });

  test('should send SMS with correct Basic Auth and Vietnamese UTF-8 content', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'sms-msg-id', transId: 'TRANS123' }),
    });

    const vietContent = 'Aura Cafe: Chào Nguyễn Văn A, ưu đãi 20%! 🎉';
    const result = await sendSMS(mockEnv, {
      phone: '84901234567',
      message: vietContent,
    });

    expect(result).toEqual({ success: true, messageId: 'sms-msg-id' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const [url, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.speedsms.vn/index.php/sms/send');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toMatch(/^Basic /);
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body);
    expect(body.to).toEqual(['84901234567']);
    expect(body.content).toContain('Nguyễn Văn A');
    expect(body.content).toContain('ưu đãi');
    expect(body.type).toBe(2);
  });

  test('should normalize phone with leading 0 before sending', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'sms-id' }),
    });

    await sendSMS(mockEnv, {
      phone: '0901234567',
      message: 'Test',
    });

    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.to).toEqual(['84901234567']);
  });

  test('should handle SpeedSMS API error gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => '{"error":"Unauthorized"}',
    });

    const result = await sendSMS(mockEnv, {
      phone: '84901234567',
      message: 'Test',
    });

    expect(result).toEqual({ success: false });
  });

  test('should handle network error gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network timeout'));

    const result = await sendSMS(mockEnv, {
      phone: '84901234567',
      message: 'Test',
    });

    expect(result).toEqual({ success: false });
  });
});

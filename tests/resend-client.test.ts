/**
 * Resend Email Client Tests
 *
 * Tests for Resend API email sending utility for Cloudflare Workers.
 * Covers: auth, Vietnamese UTF-8, error handling, missing config.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { sendEmail } from '../worker/src/lib/resend-client.ts';
import {
  winbackTemplate,
  birthdayTemplate,
  promoTemplate,
} from '../worker/src/lib/campaign-templates.ts';

const mockEnv = {
  RESEND_API_KEY: 're_123456',
  EMAIL_FROM: 'Aura Cafe <aura@auraspace.cafe>',
};

describe('Resend Email Client — sendEmail', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  test('should return skipped when RESEND_API_KEY is missing', async () => {
    const result = await sendEmail({}, {
      to: 'customer@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });
    expect(result).toEqual({ success: false, skipped: true });
  });

  test('should return error when required fields are missing', async () => {
    const result = await sendEmail(mockEnv, { to: '', subject: '', html: '' });
    expect(result).toEqual({ success: false });
  });

  test('should send email with correct payload and Vietnamese UTF-8 content', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'mock-msg-id' }),
    });

    const vietHtml = '<h1>Chào Nguyễn Văn A</h1><p>Giảm 20% cho đơn hàng</p>';
    const result = await sendEmail(mockEnv, {
      to: 'khach@example.com',
      subject: 'Chúc Mừng Sinh Nhật!',
      html: vietHtml,
    });

    expect(result).toEqual({ success: true, messageId: 'mock-msg-id' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const [url, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer re_123456');
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body);
    expect(body.from).toBe('Aura Cafe <aura@auraspace.cafe>');
    expect(body.to).toEqual(['khach@example.com']);
    expect(body.subject).toBe('Chúc Mừng Sinh Nhật!');
    expect(body.html).toContain('Nguyễn Văn A');
    expect(body.html).toContain('Giảm 20%');
  });

  test('should handle Resend API error gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => '{"errors":[{"message":"Invalid email address"}]}',
    });

    const result = await sendEmail(mockEnv, {
      to: 'not-an-email',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result).toEqual({ success: false });
  });

  test('should handle network error gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network timeout'));

    const result = await sendEmail(mockEnv, {
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result).toEqual({ success: false });
  });
});

describe('Campaign Templates', () => {
  test('winbackTemplate should produce Vietnamese subject, html, and sms', () => {
    const tmpl = winbackTemplate('Nguyễn Thị B');

    expect(tmpl.subject).toContain('Nguyễn Thị B');
    expect(tmpl.subject).toContain('nhớ bạn');
    expect(tmpl.html).toContain('Nguyễn Thị B');
    expect(tmpl.html).toContain('AURA CAFE');
    expect(tmpl.sms).toContain('Nguyễn Thị B');
    expect(tmpl.sms).toContain('voucher 20%');
  });

  test('birthdayTemplate should include name, tier, and discount percentage', () => {
    const tmpl = birthdayTemplate('Lê Văn C', 'PREMIUM', 20);

    expect(tmpl.subject).toContain('Sinh Nhật');
    expect(tmpl.subject).toContain('Lê Văn C');
    expect(tmpl.html).toContain('Lê Văn C');
    expect(tmpl.html).toContain('20%');
    expect(tmpl.sms).toContain('Lê Văn C');
    expect(tmpl.sms).toContain('20%');
  });

  test('birthdayTemplate should use defaults when optional args omitted', () => {
    const tmpl = birthdayTemplate('Test');
    expect(tmpl.sms).toContain('15%');
  });

  test('promoTemplate should include promo title and description', () => {
    const tmpl = promoTemplate(
      'Trần Văn D',
      'Giảm 50% Đồ Uống',
      'Áp dụng cho tất cả các loại cà phê đặc biệt',
    );

    expect(tmpl.subject).toContain('Giảm 50% Đồ Uống');
    expect(tmpl.html).toContain('Trần Văn D');
    expect(tmpl.html).toContain('Giảm 50% Đồ Uống');
    expect(tmpl.html).toContain('cà phê đặc biệt');
    expect(tmpl.sms).toContain('Giảm 50% Đồ Uống');
  });
});

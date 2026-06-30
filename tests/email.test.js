/**
 * Email Utility Tests — SendGrid HTTP API wrapper + templates
 */

const { sendEmail } = require('../worker/src/lib/email.js');

// Mock env for testing
const mockEnv = {
  SENDGRID_API_KEY: 'SG.test-key',
  EMAIL_FROM: 'test@aura.cafe',
  EMAIL_FROM_NAME: 'AURA CAFE Test',
};

describe('Email Utility — sendEmail', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return false when SENDGRID_API_KEY is missing', async () => {
    const result = await sendEmail({}, {
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });
    expect(result).toBe(false);
  });

  test('should return false when required fields are missing', async () => {
    const result = await sendEmail(mockEnv, { to: '', subject: '', html: '' });
    expect(result).toBe(false);
  });

  test('should return false when "to" is missing', async () => {
    const result = await sendEmail(mockEnv, { to: '', subject: 'Hi', html: '<p>Hi</p>' });
    expect(result).toBe(false);
  });

  test('should call SendGrid API with correct payload', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
    });

    const result = await sendEmail(mockEnv, {
      to: 'khach@example.com',
      subject: 'Xác nhận đơn hàng',
      html: '<h1>AURA CAFE</h1>',
    });

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer SG.test-key');

    const body = JSON.parse(opts.body);
    expect(body.personalizations[0].to[0].email).toBe('khach@example.com');
    expect(body.subject).toBe('Xác nhận đơn hàng');
    expect(body.from.email).toBe('test@aura.cafe');
    expect(body.from.name).toBe('AURA CAFE Test');
  });

  test('should handle SendGrid API error gracefully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => '{"errors":[{"message":"Permission denied"}]}',
    });

    const result = await sendEmail(mockEnv, {
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result).toBe(false);
  });

  test('should handle network error gracefully', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await sendEmail(mockEnv, {
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result).toBe(false);
  });

  test('should use default from values when env vars missing', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 202 });

    await sendEmail(
      { SENDGRID_API_KEY: 'SG.key' }, // no EMAIL_FROM
      { to: 'test@example.com', subject: 'Test', html: '<p>Test</p>' },
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.from.email).toBe('aura@fnb-caffe-container.pages.dev');
    expect(body.from.name).toBe('AURA CAFE');
  });
});

describe('Email Templates', () => {
  describe('renderOrderConfirm', () => {
    const { renderOrderConfirm } = require('../worker/src/templates/order-confirm.js');

    test('should render order confirmation with items', () => {
      const html = renderOrderConfirm({
        id: 'ORD_TEST1',
        items: [
          { name: 'Espresso', qty: 2, price: 35000 },
          { name: 'Croissant', qty: 1, price: 25000 },
        ],
        total: 95000,
        payment_method: 'PayOS',
      });

      expect(html).toContain('ORD_TEST1');
      expect(html).toContain('Espresso');
      expect(html).toContain('95.000₫');
      expect(html).toContain('AURA CAFE');
      expect(html).toContain('lang="vi"');
    });

    test('should handle empty items', () => {
      const html = renderOrderConfirm({ id: 'ORD_EMPTY', items: [], total: 0, payment_method: 'COD' });
      expect(html).toContain('ORD_EMPTY');
      expect(html).toContain('0₫');
    });

    test('should format VND correctly', () => {
      const html = renderOrderConfirm({
        id: 'ORD_FMT',
        items: [{ name: 'Coffee', qty: 1, price: 125000 }],
        total: 125000,
        payment_method: 'MoMo',
      });
      expect(html).toContain('125.000₫');
    });
  });

  describe('renderReceipt', () => {
    const { renderReceipt } = require('../worker/src/templates/receipt.js');

    test('should render payment receipt', () => {
      const html = renderReceipt({
        id: 'ORD_RCPT1',
        total: 150000,
        payment_method: 'VNPay',
        payment_time: '2026-06-30T10:30:00Z',
      });

      expect(html).toContain('ORD_RCPT1');
      expect(html).toContain('150.000₫');
      expect(html).toContain('Thanh Toán Thành Công');
    });

    test('should handle missing payment_time', () => {
      const html = renderReceipt({ id: 'TEST', total: 50000, payment_method: 'COD' });
      expect(html).toContain('Vừa xong');
    });
  });

  describe('renderWelcome', () => {
    const { renderWelcome } = require('../worker/src/templates/welcome.js');

    test('should render welcome email with loyalty tier', () => {
      const html = renderWelcome({ name: 'Nguyễn Văn A', loyalty_tier: 'premium' });

      expect(html).toContain('Nguyễn Văn A');
      expect(html).toContain('Premium');
      expect(html).toContain('Chào mừng đến với AURA!');
    });

    test('should default loyalty tier to Thành viên', () => {
      const html = renderWelcome({ name: 'Khách' });
      expect(html).toContain('Thành viên');
    });
  });
});

import { describe, expect, it } from 'vitest';
import { merchantWebhookUrl, safePayosCheckoutUrl, safeVietQrPreviewUrl } from '../saas-settings-urls';

const worker = 'https://aura-space-worker.sadec-marketing-hub.workers.dev';
const staging = 'https://aura-space-worker-staging.sadec-marketing-hub.workers.dev';
const path = '/api/webhook/payos/quan%20a';

describe('SaaS settings trusted destinations', () => {
  it('uses direct API configuration for older payloads without a webhook URL', () => {
    expect(merchantWebhookUrl({ webhookUrlPath: path }, worker)).toBe(`${worker}${path}`);
    expect(merchantWebhookUrl({ webhookUrlPath: path }, '')).toBe(`${worker}${path}`);
    expect(merchantWebhookUrl({ webhookUrlPath: path }, '', true)).toBe(`http://localhost:8787${path}`);
    expect(merchantWebhookUrl({ webhookUrlPath: path }, '/api')).toBe(`${worker}${path}`);
  });

  it('accepts canonical direct staging URLs and build-configured API origins', () => {
    expect(merchantWebhookUrl({ webhookUrl: `${staging}${path}`, webhookUrlPath: path }, worker)).toBe(`${staging}${path}`);
    expect(merchantWebhookUrl({ webhookUrlPath: path }, 'https://api.example.test')).toBe(`https://api.example.test${path}`);
  });

  it.each(['//evil.test/path', 'https://evil.test/path', '/api/webhook/payos/../billing',
    '/api/webhook/payos/%2e%2e', '/api/webhook/payos/quan?next=evil', '/api/webhook/payos/quan#evil',
    '/api/webhook/payos/quan\\evil', '/api/webhook/payos/%GG'])('rejects malformed compatibility path %s', (value) => {
    expect(merchantWebhookUrl({ webhookUrlPath: value }, worker)).toBeNull();
  });

  it.each(['https://evil.test', 'https://auraspace.cafe', 'http://localhost:8787'])('does not trust returned origin %s in production', (origin) => {
    expect(merchantWebhookUrl({ webhookUrl: `${origin}${path}`, webhookUrlPath: path }, worker)).toBe(`${worker}${path}`);
  });

  it.each(['javascript:alert(1)', 'data:text/html,pay', 'blob:https://pay.payos.vn/web/1', '//pay.payos.vn/web/1',
    'http://pay.payos.vn/web/1', 'https://pay.payos.vn.evil.test/web/1',
    'https://pay.payos.vn@evil.test/web/1', 'https://user:pass@pay.payos.vn/web/1',
    'https://pay.payos.vn:444/web/1', ' https://pay.payos.vn/web/1',
    'https://pay.payos.vn\n.evil.test/web/1'])('rejects unsafe checkout %s', (value) => {
    expect(safePayosCheckoutUrl(value)).toBeNull();
  });

  it('accepts only the HTTPS PayOS checkout origin', () => {
    expect(safePayosCheckoutUrl('https://pay.payos.vn/web/abc')).toBe('https://pay.payos.vn/web/abc');
  });

  it('accepts the expected VietQR image origin and rejects credentials or foreign images', () => {
    expect(safeVietQrPreviewUrl('https://img.vietqr.io/image/MB-123-compact2.png')).toBeTruthy();
    for (const url of ['https://evil.test/image/qr.png', 'data:image/png;base64,abc',
      'http://img.vietqr.io/image/qr.png', 'https://user@img.vietqr.io/image/qr.png', 'https://img.vietqr.io/not-image']) {
      expect(safeVietQrPreviewUrl(url)).toBeNull();
    }
  });
});

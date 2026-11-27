import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import {
  generateJWT,
  verifyJWT,
  verifyPassword,
  hashPassword,
  cookieWriteBlockReason,
} from '../lib/jwt';
import { requireAuth } from '../middleware/auth';
import { signQRUrl, verifyQRSignature } from '../tree/qr/signer';
import { staffLoginSchema, registerDeviceSchema } from '../lib/validators/auth';
import { ResetPasswordSchema } from '../schemas/auth';
import { nowPaymentsIPN } from '../../../packages/domain/payment/commands/nowpayments-ipn';
import { createTIRoutes } from '../routes/integrations/tastyigniter';
import { createHARouter } from '../routes/homeassistant/index';
import { zaloWebhookRouter } from '../routes/zalo-webhook';
import { handleErpnextPosRequest } from '../routes/erpnext-pos';
import { registerIntegrationRoutes } from '../routes/integrations-router';
import authRoutes from '../routes/openapi-auth-handlers/routes';

const SECRET = 'test-jwt-secret-at-least-32-chars-long-12345';

async function hmacHex(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('#267 Auth, Account Takeover, CSRF & JWT Security Regressions', () => {
  it('verifyJWT rejects tokens missing exp, aud, or iss when expected', async () => {
    // Craft a signed JWT without exp
    const enc = new TextEncoder();
    const b64u = (str: string) =>
      btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadNoExp = b64u(JSON.stringify({ id: 'u1', email: 'a@b.com', role: 'customer' }));
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${payloadNoExp}`));
    const sigB64 = b64u(String.fromCharCode(...new Uint8Array(sigBuf)));
    const tokenNoExp = `${header}.${payloadNoExp}.${sigB64}`;

    expect(await verifyJWT(tokenNoExp, SECRET)).toBeNull();

    // Valid token with exp, but missing aud/iss when expected
    const validToken = await generateJWT(
      { id: 'u1', email: 'a@b.com', name: 'Test', role: 'customer' },
      SECRET,
      3600
    );
    expect(await verifyJWT(validToken, SECRET, { expectedAudience: 'aura-api' })).toBeNull();
    expect(await verifyJWT(validToken, SECRET, { expectedIssuer: 'aura-auth' })).toBeNull();
  });

  it('verifyPassword rejects unsalted legacy SHA-256 hashes and accepts PBKDF2', async () => {
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', enc.encode('SecretPass123!'));
    const unsaltedHex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    expect(await verifyPassword('SecretPass123!', unsaltedHex)).toBe(false);

    const pbkdf2Hash = await hashPassword('SecretPass123!');
    expect(pbkdf2Hash.startsWith('pbkdf2$')).toBe(true);
    expect(await verifyPassword('SecretPass123!', pbkdf2Hash)).toBe(true);
  });

  it('x-playwright-test header does NOT grant staff session without ALLOW_PLAYWRIGHT_TEST_HEADER=true', async () => {
    const app = new Hono();
    app.get('/protected', requireAuth(['staff']), (c) => c.json({ ok: true }));

    const resDev = await app.request(
      'http://localhost/protected',
      { headers: { 'x-playwright-test': 'true' } },
      { ENVIRONMENT: 'development', JWT_SECRET: SECRET }
    );
    expect(resDev.status).toBe(401);

    const resOptIn = await app.request(
      'http://localhost/protected',
      { headers: { 'x-playwright-test': 'true' } },
      { ENVIRONMENT: 'development', ALLOW_PLAYWRIGHT_TEST_HEADER: 'true', JWT_SECRET: SECRET }
    );
    expect(resOptIn.status).toBe(200);
  });

  it('/api/auth/devices/login does NOT bypass requireAuth via endsWith("/login")', async () => {
    const res = await authRoutes.request(
      'http://localhost/api/auth/devices/login',
      {
        method: 'DELETE',
        headers: { Cookie: 'access_token=fake.jwt.token' },
      },
      { JWT_SECRET: SECRET, ENVIRONMENT: 'production' } as never
    );
    // Must be rejected by requireAuth (401/403), never 404 from device handler
    expect([401, 403]).toContain(res.status);
  });

  it('ResetPasswordSchema rejects short passwords (< 8 chars)', () => {
    const res = ResetPasswordSchema.safeParse({
      email: 'user@example.com',
      code: '123456',
      newPassword: 'a',
    });
    expect(res.success).toBe(false);
  });

  it('staffLoginSchema and registerDeviceSchema reject device_token > 128 bytes', () => {
    const longToken = 'x'.repeat(600);
    expect(staffLoginSchema.safeParse({ device_token: longToken, pin: '1234' }).success).toBe(false);
    expect(
      registerDeviceSchema.safeParse({
        device_token: longToken,
        staff_id: 's1',
        pin: '1234',
      }).success
    ).toBe(false);
  });

  it('QR signer uses HMAC-SHA256 and verifies validly signed URLs', async () => {
    const url = await signQRUrl('table-01', 'qr-secret-key', 'https://aura.cafe');
    const parsed = new URL(url);
    const ts = Number(parsed.searchParams.get('ts'));
    const sig = parsed.searchParams.get('sig') || '';
    expect(await verifyQRSignature('table-01', ts, sig, 'qr-secret-key')).toBe(true);
    expect(await verifyQRSignature('table-01', ts, sig, 'wrong-secret')).toBe(false);
  });
});

describe('#268 Webhooks, Integrations, ERPNext & CSRF Cookie Regressions', () => {
  it('cookieWriteBlockReason blocks CSRF for aura_staff_token, aura_access_token, access_token, and token cookies', () => {
    for (const cookieName of ['aura_staff_token', 'aura_access_token', 'access_token', 'token']) {
      const req = new Request('https://api.aura.cafe/api/erpnext-pos/products/sync', {
        method: 'POST',
        headers: { Cookie: `${cookieName}=some-jwt-value` },
      });
      expect(cookieWriteBlockReason('POST', req)).not.toBeNull();
    }
  });

  it('/api/public/products/:productId/availability rejects %3F/%23 URL rewrite bypass', async () => {
    const app = new Hono();
    registerIntegrationRoutes(app as never);
    const res = await app.request(
      'http://localhost/api/public/products/changed%3Fsince%3D1970-01-01T00%3A00%3A00Z%23/availability',
      { method: 'GET' },
      { JWT_SECRET: SECRET }
    );
    expect(res.status).toBe(400);
  });

  it('NOWPayments IPN fails closed when NOWPAYMENTS_IPN_SECRET is missing even in dev/test', async () => {
    const req = new Request('https://api.aura.cafe/api/webhooks/nowpayments', {
      method: 'POST',
      body: JSON.stringify({ payment_status: 'finished' }),
    });
    const res = await nowPaymentsIPN(req, { ENVIRONMENT: 'development' });
    expect(res.status).toBe(500);
  });

  it('TastyIgniter webhook fails closed without secret and rejects static shared-secret header', async () => {
    const app = createTIRoutes();
    const resNoSecret = await app.request(
      'http://localhost/webhook',
      { method: 'POST', body: '{}' },
      { ENVIRONMENT: 'development' }
    );
    expect(resNoSecret.status).toBe(503);

    const secret = 'ti-webhook-secret-123';
    const rawBody = JSON.stringify({ event: 'order.updated' });
    // Static secret header (not HMAC) must be rejected
    const resStatic = await app.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: { 'x-tastyigniter-signature': secret },
        body: rawBody,
      },
      { ENVIRONMENT: 'production', TASTYIGNITER_WEBHOOK_SECRET: secret }
    );
    expect(resStatic.status).toBe(401);
  });

  it('Home Assistant webhook fails closed without HA_WEBHOOK_SECRET (no HA_TOKEN fallback) and requires HMAC', async () => {
    const app = createHARouter();
    // Even if HA_TOKEN is set and HA_MOCK=true, missing HA_WEBHOOK_SECRET must fail closed
    const resNoSecret = await app.request(
      'http://localhost/webhook',
      { method: 'POST', body: '{}' },
      { ENVIRONMENT: 'development', HA_MOCK: 'true', HA_TOKEN: 'outbound-token-only' }
    );
    expect(resNoSecret.status).toBe(503);

    const secret = 'ha-inbound-hmac-secret';
    const rawBody = JSON.stringify({ entity_id: 'light.bar', state: 'on' });
    const resStatic = await app.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: { 'x-ha-token': secret },
        body: rawBody,
      },
      { ENVIRONMENT: 'production', HA_WEBHOOK_SECRET: secret }
    );
    expect(resStatic.status).toBe(401);

    const validSig = await hmacHex(rawBody, secret);
    const resValid = await app.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: { 'x-ha-signature': `sha256=${validSig}` },
        body: rawBody,
      },
      { ENVIRONMENT: 'production', HA_WEBHOOK_SECRET: secret }
    );
    expect(resValid.status).not.toBe(401);
    expect(resValid.status).not.toBe(503);
  });

  it('Zalo webhook fails closed without secret and /simulate is blocked in production & requires auth in dev', async () => {
    const resNoSecret = await zaloWebhookRouter.request(
      'http://localhost/',
      { method: 'POST', body: '{}' },
      { ENVIRONMENT: 'development' } as never
    );
    expect(resNoSecret.status).toBe(503);

    const resSimProd = await zaloWebhookRouter.request(
      'http://localhost/simulate',
      { method: 'POST', body: '{}' },
      { ENVIRONMENT: 'production', JWT_SECRET: SECRET } as never
    );
    expect(resSimProd.status).toBe(404);

    const resSimDevUnauth = await zaloWebhookRouter.request(
      'http://localhost/simulate',
      { method: 'POST', body: '{}' },
      { ENVIRONMENT: 'development', JWT_SECRET: SECRET } as never
    );
    expect(resSimDevUnauth.status).toBe(401);
  });

  it('ERPNext POS webhook rejects static shared-secret header and legacy mock bypass', async () => {
    const secret = 'erpnext-webhook-secret-xyz';
    const rawBody = JSON.stringify({ event: 'item.updated' });

    // No secret + ERPNEXT_MOCK=true must still fail closed (503)
    const reqNoSecret = new Request('https://api.aura.cafe/api/erpnext-pos/webhook', {
      method: 'POST',
      body: rawBody,
    });
    const resNoSecret = await handleErpnextPosRequest(reqNoSecret, { ERPNEXT_MOCK: 'true' });
    expect(resNoSecret.status).toBe(503);

    // Static secret header must be rejected (401)
    const reqStatic = new Request('https://api.aura.cafe/api/erpnext-pos/webhook', {
      method: 'POST',
      headers: { 'x-erpnext-webhook-secret': secret },
      body: rawBody,
    });
    const resStatic = await handleErpnextPosRequest(reqStatic, { ERPNEXT_WEBHOOK_SECRET: secret });
    expect(resStatic.status).toBe(401);
  });
});

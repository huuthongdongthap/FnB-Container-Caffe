import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import {
  generateJWT,
  verifyJWT,
  verifyPassword,
  hashPassword,
  cookieWriteBlockReason,
  getAuthToken,
} from '../lib/jwt';
import {
  encryptTenantSecret,
  decryptTenantSecretOrPlaintext,
} from '../lib/tenant-secrets';
import { createErpnextClientWithKv } from '../erpnext/client/factory';
import { processErpnextRetryQueue } from '../routes/cron-handlers/erpnext-sync';
import { handlePayosWebhook } from '../routes/webhooks-handlers/payos';
import {
  handleCalBookingWebhook,
  registerWebhookHandler,
} from '../routes/cal-booking-webhook-handlers/webhook-handler';
import { verifyEmail } from '../routes/auth-verify';
import { loginUser } from '../tree/auth/login';
import { registerUser } from '../tree/auth/register';
import { resetPassword } from '../tree/auth/reset-password';
import { handlePhoneOtpRequest } from '../tree/loyalty/phone-otp-handler';
import { handlePhoneAuth } from '../tree/loyalty/phone-auth-handler';
import { registerProfileHandlers } from '../routes/customers-handlers/profile-handlers';
import { chatRouter } from '../routes/chat';
import { issueStaffSession } from '../lib/staff-session';
import { staffTokenRefresh } from '../../../packages/domain/staff/commands/staff-auth';
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

  it('verifyJWT enforces HS256 alg and optional JWT typ header', async () => {
    const enc = new TextEncoder();
    const b64u = (str: string) =>
      btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const nowSec = Math.floor(Date.now() / 1000);
    const payloadB64 = b64u(JSON.stringify({ id: 'u1', role: 'customer', exp: nowSec + 3600 }));
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signWithHeader = async (hdr: Record<string, unknown>) => {
      const hdrB64 = b64u(JSON.stringify(hdr));
      const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${hdrB64}.${payloadB64}`));
      const sigB64 = b64u(String.fromCharCode(...new Uint8Array(sigBuf)));
      return `${hdrB64}.${payloadB64}.${sigB64}`;
    };

    expect(await verifyJWT(await signWithHeader({ alg: 'none', typ: 'JWT' }), SECRET)).toBeNull();
    expect(await verifyJWT(await signWithHeader({ alg: 'HS512', typ: 'JWT' }), SECRET)).toBeNull();
    expect(await verifyJWT(await signWithHeader({ alg: 'HS256', typ: 'REFRESH' }), SECRET)).toBeNull();
    expect(await verifyJWT(await signWithHeader({ alg: 'HS256' }), SECRET)).not.toBeNull();
  });

  it('getAuthToken strictly prioritizes aura_staff_token over lower-precedence cookies regardless of header order', () => {
    const req = new Request('https://api.aura.cafe/api/orders', {
      headers: {
        Cookie: 'token=low_priority_tok; access_token=mid_tok; aura_staff_token=staff_high_tok',
      },
    });
    expect(getAuthToken(req)).toBe('staff_high_tok');
  });

  it('verifyPassword enforces strict PBKDF2 iteration, salt, and digest format bounds', async () => {
    const validSalt = '0123456789abcdef0123456789abcdef';
    const validHash = 'a'.repeat(64);
    expect(await verifyPassword('Pass123!', `pbkdf2$999$${validSalt}$${validHash}`)).toBe(false);
    expect(await verifyPassword('Pass123!', `pbkdf2$1000001$${validSalt}$${validHash}`)).toBe(false);
    expect(await verifyPassword('Pass123!', `pbkdf2$100000abc$${validSalt}$${validHash}`)).toBe(false);
    expect(await verifyPassword('Pass123!', `pbkdf2$100000$short$${validHash}`)).toBe(false);
    expect(await verifyPassword('Pass123!', `pbkdf2$100000$${validSalt}$not_hex`)).toBe(false);
  });

  it('blocks erased customers across email login, email verification, phone OTP request, phone auth, and profile update', async () => {
    const pwHash = await hashPassword('CustomerPass123!');
    const kvStore = new Map<string, string>([
      [
        'user:erased@example.com',
        JSON.stringify({
          id: 'cust_erased_1',
          email: 'erased@example.com',
          name: 'Former User',
          phone: '0909111222',
          password: pwHash,
          role: 'customer',
          tenant_id: 'default',
          email_verified: true,
        }),
      ],
    ]);
    const kv = {
      get: async (k: string) => kvStore.get(k) ?? null,
      put: async (k: string, v: string) => {
        kvStore.set(k, v);
      },
      delete: async (k: string) => {
        kvStore.delete(k);
      },
    };
    const db = {
      prepare(sql: string) {
        return {
          bind(..._args: unknown[]) {
            return {
              async first() {
                if (sql.includes('FROM email_verifications')) {
                  return {
                    id: 'ev_erased',
                    email: 'erased@example.com',
                    code: '123456',
                    expires_at: new Date(Date.now() + 300_000).toISOString(),
                  };
                }
                if (sql.includes('FROM customer_events')) {
                  return { event_type: 'CustomerDataErased' };
                }
                if (sql.includes('FROM customers')) {
                  return {
                    id: 'cust_erased_1',
                    email: null,
                    name: '[ERASED]',
                    phone: 'erased_cust_erased_1',
                    anonymized_at: '2026-11-01T00:00:00.000Z',
                    tenant_id: 'default',
                  };
                }
                return null;
              },
              async run() {
                return { rowCount: 1, meta: { changes: 1 } };
              },
            };
          },
        };
      },
    };
    const env = {
      AURA_DB: db,
      AUTH_KV: kv,
      JWT_SECRET: SECRET,
      PILOT_TENANT_ID: 'default',
    };

    const loginRes = await loginUser(
      new Request('https://api.aura.cafe/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'erased@example.com', password: 'CustomerPass123!' }),
      }),
      env
    );
    expect(loginRes.status).toBe(401);

    const verifyRes = await verifyEmail(
      new Request('https://api.aura.cafe/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'erased@example.com', code: '123456' }),
      }),
      env
    );
    expect(verifyRes.status).toBe(401);

    const loyaltyApp = new Hono();
    loyaltyApp.post('/otp', (c) => handlePhoneOtpRequest(c as never));
    loyaltyApp.post('/phone-auth', (c) => handlePhoneAuth(c as never));

    const otpRes = await loyaltyApp.request(
      'http://localhost/otp',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0909111222' }),
      },
      env as never
    );
    expect([401, 403]).toContain(otpRes.status);

    const phoneAuthRes = await loyaltyApp.request(
      'http://localhost/phone-auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0909111222', name: 'Former User' }),
      },
      env as never
    );
    expect([400, 401, 403]).toContain(phoneAuthRes.status);

    const profileApp = new Hono();
    profileApp.use('*', async (c, next) => {
      c.set('user' as never, { id: 'cust_erased_1', role: 'customer', tenantId: 'default' } as never);
      c.set('tenantId' as never, 'default' as never);
      await next();
    });
    const custToken = await generateJWT(
      { id: 'cust_erased_1', email: 'erased@example.com', name: 'Former', role: 'customer', tenantId: 'default' },
      SECRET,
      3600
    );
    registerProfileHandlers(profileApp as never);
    const putProfileRes = await profileApp.request(
      'http://localhost/me',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custToken}`,
        },
        body: JSON.stringify({ name: 'Reinstated Name' }),
      },
      env as never
    );
    expect([401, 403, 404]).toContain(putProfileRes.status);
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

  it('decrypts encrypted ERPNext KV credentials and fails closed when decryption fails', async () => {
    const masterKey = 'tenant-secrets-master-key-32bytes!';
    const encKey = await encryptTenantSecret('erp_live_key', masterKey, 1, 'store_a');
    const encSecret = await encryptTenantSecret('erp_live_secret', masterKey, 1, 'store_a');
    expect(await decryptTenantSecretOrPlaintext(encKey, masterKey, 'store_a')).toBe('erp_live_key');
    expect(await decryptTenantSecretOrPlaintext('plain_legacy_key', undefined, 'store_a')).toBe('plain_legacy_key');

    const kvMap = new Map<string, string>([
      ['erpnext:store_a:api_url', 'https://erp.store-a.example'],
      ['erpnext:store_a:api_key', encKey],
      ['erpnext:store_a:api_secret', encSecret],
    ]);
    const kv = {
      get: async (k: string) => kvMap.get(k) ?? null,
    };

    const clientOk = await createErpnextClientWithKv(
      {
        AUTH_KV: kv as never,
        TENANT_SECRETS_KEY: masterKey,
        ERPNEXT_SYNC_ENABLED: 'true',
      },
      'store_a'
    );
    expect(clientOk).not.toBeNull();

    const clientWrongKey = await createErpnextClientWithKv(
      {
        AUTH_KV: kv as never,
        TENANT_SECRETS_KEY: 'wrong-master-key-cannot-decrypt!!',
        ERPNEXT_SYNC_ENABLED: 'true',
      },
      'store_a'
    );
    expect(clientWrongKey).toBeNull();

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const db = {
        prepare(sql: string) {
          return {
            bind() {
              return this;
            },
            async all() {
              if (sql.includes('FROM erpnext_sync_queue')) {
                return {
                  results: [
                    {
                      id: 'q1',
                      entity_type: 'order',
                      entity_id: 'ord_1',
                      action: 'create',
                      tenant_id: 'store_a',
                      payload: JSON.stringify({ id: 'ord_1', total: 50000, tenant_id: 'store_a' }),
                      attempts: 2,
                    },
                  ],
                };
              }
              return { results: [] };
            },
            async run() {
              return { meta: { changes: 1 } };
            },
          };
        },
      };
      const syncRes = await processErpnextRetryQueue(
        {
          AURA_DB: db,
          AUTH_KV: kv,
          TENANT_SECRETS_KEY: 'wrong-master-key-cannot-decrypt!!',
          ERPNEXT_URL: 'https://fallback.erp.example',
          ERPNEXT_API_KEY: 'fallback_key',
          ERPNEXT_API_SECRET: 'fallback_secret',
          ERPNEXT_SYNC_ENABLED: 'true',
          PILOT_TENANT_ID: 'store_a',
        },
        '*'
      );
      expect(syncRes).toEqual({ processed: 1, succeeded: 0, failed: 1 });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('PayOS webhook returns 400 on malformed or array JSON without writing to DLQ', async () => {
    const dlqWrites: string[] = [];
    const env = {
      AURA_DB: {
        prepare() {
          return {
            bind() {
              return this;
            },
            async first() {
              return null;
            },
          };
        },
      },
      AUTH_KV: {
        put: async (key: string) => {
          dlqWrites.push(key);
        },
      },
      PAYOS_CHECKSUM_KEY: 'payos_checksum_secret',
    };
    const app = new Hono();
    app.post('/payos', (c) => handlePayosWebhook(c as never));

    const badJsonRes = await app.request(
      'http://localhost/payos',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{malformed-json',
      },
      env as never
    );
    expect(badJsonRes.status).toBe(400);

    const arrayJsonRes = await app.request(
      'http://localhost/payos',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '[{"code":"00"}]',
      },
      env as never
    );
    expect(arrayJsonRes.status).toBe(400);
    expect(dlqWrites).toHaveLength(0);
  });

  it('Cal.com webhook rejects plaintext secret fallback on malformed JSON and enforces timestamp freshness and KV replay guard', async () => {
    const secret = 'cal_webhook_secret_test';
    const stubRequestWithoutText = {
      headers: new Headers({ 'x-cal-signature-256': secret }),
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as Request;

    const fallbackRes = await handleCalBookingWebhook(stubRequestWithoutText, {
      CAL_WEBHOOK_SECRET: secret,
    });
    expect(fallbackRes.status).toBe(401);

    const validBody = JSON.stringify({
      triggerEvent: 'BOOKING_CANCELLED',
      createdAt: '2026-11-27T10:00:00.000Z',
      payload: {
        uid: 'cal_uid_100',
        title: 'Table Reservation',
        startTime: '2026-11-27T12:00:00.000Z',
        endTime: '2026-11-27T13:00:00.000Z',
        organizer: { name: 'Aura Cafe', email: 'booking@aura.cafe' },
        location: 'Sa Dec',
      },
    });
    const sig = await hmacHex(validBody, secret);
    const staleTs = String(Math.floor(Date.now() / 1000) - 600);

    const staleRes = await handleCalBookingWebhook(
      new Request('https://api.aura.cafe/api/webhooks/cal', {
        method: 'POST',
        headers: {
          'x-cal-signature-256': sig,
          'x-cal-timestamp': staleTs,
        },
        body: validBody,
      }),
      { CAL_WEBHOOK_SECRET: secret }
    );
    expect(staleRes.status).toBe(401);

    const kvMap = new Map<string, string>();
    const calApp = new Hono();
    registerWebhookHandler(calApp as never);
    const freshTs = String(Math.floor(Date.now() / 1000));
    const calEnv = {
      CAL_WEBHOOK_SECRET: secret,
      AUTH_KV: {
        get: async (k: string) => kvMap.get(k) ?? null,
        put: async (k: string, v: string) => {
          kvMap.set(k, v);
        },
      },
      AURA_DB: {
        prepare() {
          return {
            bind() {
              return this;
            },
            async first() {
              return { id: 'res_1', status: 'confirmed', tenant_id: 'default' };
            },
            async run() {
              return { meta: { changes: 1 } };
            },
          };
        },
      },
    };

    const firstRes = await calApp.request(
      'http://localhost/',
      {
        method: 'POST',
        headers: {
          'x-cal-signature-256': sig,
          'x-cal-timestamp': freshTs,
        },
        body: validBody,
      },
      calEnv as never
    );
    expect(firstRes.status).toBe(200);

    const replayRes = await calApp.request(
      'http://localhost/',
      {
        method: 'POST',
        headers: {
          'x-cal-signature-256': sig,
          'x-cal-timestamp': freshTs,
        },
        body: validBody,
      },
      calEnv as never
    );
    expect(replayRes.status).toBe(409);

    // Mutating unsigned timestamp header with identical signed body still returns 409
    const replayMutatedTsRes = await calApp.request(
      'http://localhost/',
      {
        method: 'POST',
        headers: {
          'x-cal-signature-256': sig,
          'x-cal-timestamp': String(Number(freshTs) + 1),
        },
        body: validBody,
      },
      calEnv as never
    );
    expect(replayMutatedTsRes.status).toBe(409);
  });

  it('ERPNext POS, Home Assistant, and TastyIgniter webhooks enforce timestamp freshness, array rejection, and KV replay protection', async () => {
    const secret = 'shared_hmac_test_secret';
    const staleTs = String(Math.floor(Date.now() / 1000) - 900);
    const freshTs = String(Math.floor(Date.now() / 1000));

    // 1. ERPNext POS webhook
    const erpBody = JSON.stringify({ event: 'item.updated', item_code: 'CF-01' });
    const erpSig = await hmacHex(erpBody, secret);
    const erpKv = new Map<string, string>();
    const erpEnv = {
      ERPNEXT_WEBHOOK_SECRET: secret,
      AUTH_KV: {
        get: async (k: string) => erpKv.get(k) ?? null,
        put: async (k: string, v: string) => {
          erpKv.set(k, v);
        },
      },
    };

    const erpStale = await handleErpnextPosRequest(
      new Request('https://api.aura.cafe/api/erpnext-pos/webhook', {
        method: 'POST',
        headers: {
          'x-frappe-webhook-signature': erpSig,
          'x-frappe-webhook-timestamp': staleTs,
        },
        body: erpBody,
      }),
      erpEnv
    );
    expect(erpStale.status).toBe(401);

    const erpFirst = await handleErpnextPosRequest(
      new Request('https://api.aura.cafe/api/erpnext-pos/webhook', {
        method: 'POST',
        headers: {
          'x-frappe-webhook-signature': erpSig,
          'x-frappe-webhook-timestamp': freshTs,
        },
        body: erpBody,
      }),
      erpEnv
    );
    expect(erpFirst.status).toBe(200);

    const erpReplay = await handleErpnextPosRequest(
      new Request('https://api.aura.cafe/api/erpnext-pos/webhook', {
        method: 'POST',
        headers: {
          'x-frappe-webhook-signature': erpSig,
          'x-frappe-webhook-timestamp': freshTs,
        },
        body: erpBody,
      }),
      erpEnv
    );
    expect(erpReplay.status).toBe(409);

    const erpReplayMutatedTs = await handleErpnextPosRequest(
      new Request('https://api.aura.cafe/api/erpnext-pos/webhook', {
        method: 'POST',
        headers: {
          'x-frappe-webhook-signature': erpSig,
          'x-frappe-webhook-timestamp': String(Number(freshTs) + 1),
        },
        body: erpBody,
      }),
      erpEnv
    );
    expect(erpReplayMutatedTs.status).toBe(409);

    // 2. Home Assistant webhook
    const haApp = createHARouter();
    const haArrayBody = JSON.stringify([{ entity_id: 'light.bar', state: 'on' }]);
    const haArraySig = await hmacHex(haArrayBody, secret);
    const haArrayRes = await haApp.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: { 'x-ha-signature': haArraySig },
        body: haArrayBody,
      },
      { ENVIRONMENT: 'production', HA_WEBHOOK_SECRET: secret }
    );
    expect(haArrayRes.status).toBe(400);

    const haBody = JSON.stringify({ entity_id: 'light.bar', state: 'on' });
    const haSig = await hmacHex(haBody, secret);
    const haStale = await haApp.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: {
          'x-ha-signature': haSig,
          'x-ha-timestamp': staleTs,
        },
        body: haBody,
      },
      { ENVIRONMENT: 'production', HA_WEBHOOK_SECRET: secret }
    );
    expect(haStale.status).toBe(401);

    const haKv = new Map<string, string>();
    const haEnv = {
      ENVIRONMENT: 'production',
      HA_WEBHOOK_SECRET: secret,
      AUTH_KV: {
        get: async (k: string) => haKv.get(k) ?? null,
        put: async (k: string, v: string) => {
          haKv.set(k, v);
        },
      },
    };
    const haFirst = await haApp.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: {
          'x-ha-signature': haSig,
          'x-ha-timestamp': freshTs,
        },
        body: haBody,
      },
      haEnv as never
    );
    expect(haFirst.status).not.toBe(401);
    expect(haFirst.status).not.toBe(409);

    const haReplay = await haApp.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: {
          'x-ha-signature': haSig,
          'x-ha-timestamp': freshTs,
        },
        body: haBody,
      },
      haEnv as never
    );
    expect(haReplay.status).toBe(409);

    const haReplayMutatedTs = await haApp.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: {
          'x-ha-signature': haSig,
          'x-ha-timestamp': String(Number(freshTs) + 1),
        },
        body: haBody,
      },
      haEnv as never
    );
    expect(haReplayMutatedTs.status).toBe(409);

    // 3. TastyIgniter webhook
    const tiApp = createTIRoutes();
    const tiBody = JSON.stringify({ event: 'order.updated', data: { order_id: '1' } });
    const tiSig = await hmacHex(tiBody, secret);
    const tiKv = new Map<string, string>();
    const tiEnv = {
      ENVIRONMENT: 'production',
      TASTYIGNITER_WEBHOOK_SECRET: secret,
      AUTH_KV: {
        get: async (k: string) => tiKv.get(k) ?? null,
        put: async (k: string, v: string) => {
          tiKv.set(k, v);
        },
      },
    };

    const tiStale = await tiApp.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: {
          'x-tastyigniter-signature': tiSig,
          'x-tastyigniter-timestamp': staleTs,
        },
        body: tiBody,
      },
      tiEnv as never
    );
    expect(tiStale.status).toBe(401);

    const tiFirst = await tiApp.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: {
          'x-tastyigniter-signature': tiSig,
          'x-tastyigniter-timestamp': freshTs,
        },
        body: tiBody,
      },
      tiEnv as never
    );
    expect(tiFirst.status).not.toBe(401);
    expect(tiFirst.status).not.toBe(409);

    const tiReplay = await tiApp.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: {
          'x-tastyigniter-signature': tiSig,
          'x-tastyigniter-timestamp': freshTs,
        },
        body: tiBody,
      },
      tiEnv as never
    );
    expect(tiReplay.status).toBe(409);

    const tiReplayMutatedTs = await tiApp.request(
      'http://localhost/webhook',
      {
        method: 'POST',
        headers: {
          'x-tastyigniter-signature': tiSig,
          'x-tastyigniter-timestamp': String(Number(freshTs) + 1),
        },
        body: tiBody,
      },
      tiEnv as never
    );
    expect(tiReplayMutatedTs.status).toBe(409);
  });

  it('POST /me/phone-otp issues single-use OTP for PATCH /me with VN phone normalization, lockout, and duplicate checks', async () => {
    const kvStore = new Map<string, string>();
    const kv = {
      get: async (k: string) => kvStore.get(k) ?? null,
      put: async (k: string, v: string) => {
        kvStore.set(k, v);
      },
      delete: async (k: string) => {
        kvStore.delete(k);
      },
    };
    let storedPhone = '0901112222';
    const otherCustomerPhone = '+84 909 888 777';
    const db = {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async first() {
                if (sql.includes('FROM customer_events')) return null;
                if (sql.includes('SELECT id, name, phone, anonymized_at')) {
                  return { id: 'cust_otp_1', name: 'An', phone: storedPhone, anonymized_at: null };
                }
                if (sql.includes('SELECT phone FROM customers WHERE id = ?')) {
                  return { phone: storedPhone };
                }
                if (sql.includes('SELECT id, phone, tenant_id FROM customers WHERE REPLACE')) {
                  const candidateDigits = args.slice(0, 4).map((v) => String(v));
                  if (candidateDigits.includes('0909888777') || candidateDigits.includes('+8490988777')) {
                    return { id: 'cust_other_2', phone: otherCustomerPhone, tenant_id: 'default' };
                  }
                  return null;
                }
                return { id: 'cust_otp_1', name: 'An', phone: storedPhone, tenant_id: 'default' };
              },
              async run() {
                if (sql.startsWith('UPDATE customers SET')) {
                  const phoneArg = args.find((a) => typeof a === 'string' && a.startsWith('09'));
                  if (typeof phoneArg === 'string') storedPhone = phoneArg;
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    };

    const app = new Hono();
    registerProfileHandlers(app as never);
    const token = await generateJWT(
      { id: 'cust_otp_1', role: 'customer', tenantId: 'default', email: 'an@example.com' },
      SECRET,
      3600
    );
    const env = { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: SECRET };
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Duplicate phone in different VN format (+84 vs 090...) returns 409 on OTP request
    const dupRes = await app.request(
      'http://localhost/me/phone-otp',
      { method: 'POST', headers: authHeaders, body: JSON.stringify({ phone: '0909888777' }) },
      env as never
    );
    expect(dupRes.status).toBe(409);

    // Same phone in +84 format requires no OTP
    const sameRes = await app.request(
      'http://localhost/me/phone-otp',
      { method: 'POST', headers: authHeaders, body: JSON.stringify({ phone: '+84901112222' }) },
      env as never
    );
    expect(sameRes.status).toBe(200);
    const sameJson = (await sameRes.json()) as { requiresOtp?: boolean };
    expect(sameJson.requiresOtp).toBe(false);

    // Request OTP for a new phone in +84 format (normalized key, never leaked in body)
    const reqOtpRes = await app.request(
      'http://localhost/me/phone-otp',
      { method: 'POST', headers: authHeaders, body: JSON.stringify({ phone: '+84903444555' }) },
      env as never
    );
    expect(reqOtpRes.status).toBe(200);
    const reqOtpBody = await reqOtpRes.text();
    const storedOtp = kvStore.get('phone_change_otp:cust_otp_1:0903444555');
    expect(storedOtp).toMatch(/^\d{6}$/);
    expect(reqOtpBody).not.toContain(storedOtp!);

    // 5 wrong OTP attempts trigger 429 lockout
    for (let i = 0; i < 5; i += 1) {
      const wrongRes = await app.request(
        'http://localhost/me',
        {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ phone: '+84903444555', otp: '000000' }),
        },
        env as never
      );
      expect(wrongRes.status).toBe(403);
    }
    const lockedRes = await app.request(
      'http://localhost/me',
      {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ phone: '0903444555', otp: storedOtp }),
      },
      env as never
    );
    expect(lockedRes.status).toBe(429);

    // Issuing a fresh OTP clears lockout and allows completing PATCH /me with normalized phone
    const freshOtpRes = await app.request(
      'http://localhost/me/phone-otp',
      { method: 'POST', headers: authHeaders, body: JSON.stringify({ phone: '+84903444555' }) },
      env as never
    );
    expect(freshOtpRes.status).toBe(200);
    const freshOtp = kvStore.get('phone_change_otp:cust_otp_1:0903444555');
    expect(freshOtp).toMatch(/^\d{6}$/);

    const patchOk = await app.request(
      'http://localhost/me',
      {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ phone: '+84903444555', otp: freshOtp }),
      },
      env as never
    );
    expect(patchOk.status).toBe(200);
    expect(storedPhone).toBe('0903444555');
    expect(kvStore.has('phone_change_otp:cust_otp_1:0903444555')).toBe(false);
  });

  it('staffTokenRefresh rejects invalid JSON and out-of-bounds device_token before touching pin_lockout KV keys', async () => {
    const kvStore = new Map<string, string>();
    const kvKeysRead: string[] = [];
    const kv = {
      get: async (key: string) => {
        kvKeysRead.push(key);
        return kvStore.get(key) ?? null;
      },
      put: async (key: string, val: string) => {
        kvStore.set(key, val);
      },
      delete: async (key: string) => {
        kvStore.delete(key);
      },
    };
    const staffAccount = {
      id: 'staff_refresh_1',
      name: 'Barista',
      email: 'barista@aura.cafe',
      role: 'staff',
      tenant_id: 'default',
      is_active: 1,
      auth_version: 1,
      password_changed_at: null,
    };
    const db = {
      prepare(sql: string) {
        return {
          bind() {
            return this;
          },
          async first() {
            if (sql.includes('FROM staff_devices')) {
              return { id: 'dev_refresh_1', staff_id: staffAccount.id };
            }
            return staffAccount;
          },
        };
      },
    };
    const env = { AUTH_KV: kv, AURA_DB: db, JWT_SECRET: SECRET };
    const { token: mobileToken } = await issueStaffSession(env as never, staffAccount as never, {
      email: staffAccount.email,
      sessionType: 'staff-mobile',
      deviceId: 'dev_refresh_1',
    });
    const app = new Hono();
    app.post('/refresh', (c) => staffTokenRefresh(c as never));
    const authHeaders = {
      Authorization: `Bearer ${mobileToken}`,
      'Content-Type': 'application/json',
    };

    const badJson = await app.request(
      'http://localhost/refresh',
      { method: 'POST', headers: authHeaders, body: '{bad' },
      env as never
    );
    expect(badJson.status).toBe(400);

    const shortToken = await app.request(
      'http://localhost/refresh',
      { method: 'POST', headers: authHeaders, body: JSON.stringify({ device_token: 'short' }) },
      env as never
    );
    expect(shortToken.status).toBe(400);

    const longToken = await app.request(
      'http://localhost/refresh',
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ device_token: 'x'.repeat(129) }),
      },
      env as never
    );
    expect(longToken.status).toBe(400);
    expect(kvKeysRead.some((k) => k.startsWith('pin_lockout:'))).toBe(false);
  });

  it('PayOS tenant webhook authenticates signature before schema validation to eliminate tenant/checksum existence oracles', async () => {
    const db = {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async first() {
                if (sql.includes('FROM saas_tenants') && args[0] === 'existing-tenant') {
                  return { id: 'tenant_existing' };
                }
                return null;
              },
            };
          },
        };
      },
    };
    const app = new Hono();
    app.post('/payos/:tenantSlug', (c) => handlePayosWebhook(c as never, false, c.req.param('tenantSlug')));
    const env = { AURA_DB: db, AUTH_KV: {}, PAYOS_CHECKSUM_KEY: 'checksum_secret_for_oracle_test' };

    // Both unknown tenant and configured tenant return identical 401 for unauthenticated payloads
    const probeBody = JSON.stringify({
      signature: 'forged-sig',
      data: { orderCode: 123, amount: 50000, description: 'probe' },
    });
    const unknownTenantRes = await app.request(
      'http://localhost/payos/nonexistent-tenant',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: probeBody },
      env as never
    );
    const existingTenantRes = await app.request(
      'http://localhost/payos/existing-tenant',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: probeBody },
      env as never
    );
    expect(unknownTenantRes.status).toBe(401);
    expect(existingTenantRes.status).toBe(401);
    expect(await unknownTenantRes.json()).toEqual(await existingTenantRes.json());

    // Empty data object also returns 401 without revealing tenant state
    const emptyDataRes = await app.request(
      'http://localhost/payos/nonexistent-tenant',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: 'dummy-sig', data: {} }),
      },
      env as never
    );
    expect(emptyDataRes.status).toBe(401);
  });

  it('forgot-password ignores spoofed X-Forwarded-For headers in production when CF-Connecting-IP is present', async () => {
    const kvStore = new Map<string, string>();
    const env = {
      ENVIRONMENT: 'production',
      JWT_SECRET: SECRET,
      AUTH_KV: {
        get: async (k: string) => kvStore.get(k) ?? null,
        put: async (k: string, v: string) => {
          kvStore.set(k, v);
        },
      },
      AURA_DB: {
        prepare() {
          return {
            bind() {
              return this;
            },
            async first() {
              return null;
            },
            async run() {
              return { meta: { changes: 0 } };
            },
          };
        },
      },
    };

    for (let i = 0; i < 5; i += 1) {
      const res = await authRoutes.request(
        'http://localhost/api/auth/forgot-password',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.10',
            'X-Forwarded-For': `198.51.100.${i + 1}`,
          },
          body: JSON.stringify({ email: `probe-${i}@example.com` }),
        },
        env as never
      );
      expect(res.status).toBe(200);
    }

    // 6th request from same CF-Connecting-IP with a brand-new spoofed X-Forwarded-For is still rate-limited (429)
    const blocked = await authRoutes.request(
      'http://localhost/api/auth/forgot-password',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.10',
          'X-Forwarded-For': '198.51.100.99',
        },
        body: JSON.stringify({ email: 'probe-6@example.com' }),
      },
      env as never
    );
    expect(blocked.status).toBe(429);
  });

  it('registerUser and resetPassword embed configured JWT_AUDIENCE and JWT_ISSUER claims', async () => {
    const kvStore = new Map<string, string>();
    const kv = {
      get: async (k: string) => kvStore.get(k) ?? null,
      put: async (k: string, v: string) => {
        kvStore.set(k, v);
      },
      delete: async (k: string) => {
        kvStore.delete(k);
      },
    };
    const db = {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            return null;
          },
          async run() {
            return { meta: { changes: 1 } };
          },
        };
      },
    };
    const env = {
      AUTH_KV: kv,
      AURA_DB: db,
      JWT_SECRET: SECRET,
      JWT_EXPIRY_SECONDS: '3600',
      JWT_AUDIENCE: 'aura-api',
      JWT_ISSUER: 'aura-auth',
      RESET_KEY: 'reset-secret-key-32-chars-minimum',
    };

    const regRes = await registerUser(
      new Request('https://api.aura.cafe/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'claims@example.com',
          password: 'StrongPassword123!',
          name: 'Claims User',
          phone: '0901234567',
        }),
      }),
      env
    );
    expect(regRes.status).toBe(201);
    const regJson = (await regRes.json()) as { token?: string };
    expect(regJson.token).toBeTruthy();
    const verifiedReg = await verifyJWT(regJson.token!, SECRET, {
      expectedAudience: 'aura-api',
      expectedIssuer: 'aura-auth',
    });
    expect(verifiedReg?.aud).toBe('aura-api');
    expect(verifiedReg?.iss).toBe('aura-auth');

    const resetRes = await resetPassword(
      new Request('https://api.aura.cafe/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Reset-Key': env.RESET_KEY,
        },
        body: JSON.stringify({
          email: 'claims@example.com',
          newPassword: 'UpdatedPassword456!',
        }),
      }),
      env
    );
    expect(resetRes.status).toBe(200);
    const resetJson = (await resetRes.json()) as { token?: string };
    expect(resetJson.token).toBeTruthy();
    const verifiedReset = await verifyJWT(resetJson.token!, SECRET, {
      expectedAudience: 'aura-api',
      expectedIssuer: 'aura-auth',
    });
    expect(verifiedReset?.aud).toBe('aura-api');
    expect(verifiedReset?.iss).toBe('aura-auth');
  });

  it('POST /api/chat/messages fails closed with 503 on D1 runtime errors during registered-phone lookup', async () => {
    const dbOutage = {
      prepare(sql: string) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes('FROM customers')) {
                  throw new Error('D1_ERROR: database is locked');
                }
                return null;
              },
              async run() {
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    };
    const res = await chatRouter.request(
      'http://localhost/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Guest',
          phone: '0901234567',
          message: 'Hello support',
        }),
      },
      { AURA_DB: dbOutage, JWT_SECRET: SECRET } as never
    );
    expect(res.status).toBe(503);
  });
});

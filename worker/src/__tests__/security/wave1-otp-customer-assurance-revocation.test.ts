// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import vm from 'node:vm';
import { app } from '../../index';
import { privacyFixture } from '../helpers/privacy-sqlite-fixture';
import { generateJWT } from '../../lib/jwt';
import {
  claimOtpOnce,
  consumeOtpChallenge,
  persistOtpChallenge,
  releaseOtpClaim,
  resetOtpClaim,
} from '../../tree/loyalty/helpers';

describe('Wave 1–3 Security & Authority Invariants (R01, R02, R03)', () => {
  it('R01: enforces OTP single-use across module instances, after >60ms delay, and via D1 otp_challenges CAS', async () => {
    const f = privacyFixture();
    try {
      const key = 'phone_otp:cafe-a:0901112233';
      const code = '654321';

      expect(claimOtpOnce({ instance: 'one' }, key, code)).toBe(true);
      await new Promise((r) => setTimeout(r, 65));
      expect(claimOtpOnce({ instance: 'two' }, key, code)).toBe(false);

      const isolatedFn = vm.runInNewContext(
        `(${claimOtpOnce.toString()})`,
        {
          Symbol,
          Set,
          WeakMap,
          Object,
          setTimeout,
          OTP_INFLIGHT_SYMBOL: Symbol.for('aura.otp.inflight'),
          OTP_CLAIMS_SYMBOL: Symbol.for('aura.otp.claims'),
          consumedOtpClaims: new WeakMap(),
          resolveOtpStoreAnchor: (kv: object) => kv,
          getAnchorClaimSet: () => new Set(),
          getGlobalInflightClaims: () => {
            const host = setTimeout as unknown as Record<symbol, Set<string>>;
            return host[Symbol.for('aura.otp.inflight')];
          },
        }
      ) as typeof claimOtpOnce;

      expect(isolatedFn({ instance: 'three' }, key, code)).toBe(false);

      releaseOtpClaim({ instance: 'one' }, key, code);
      expect(claimOtpOnce({ instance: 'four' }, key, code)).toBe(true);

      resetOtpClaim({ instance: 'four' }, key);
      expect(claimOtpOnce({ instance: 'five' }, key, '999888')).toBe(true);

      await persistOtpChallenge(f.env.AURA_DB, key, 'cafe-a', '0901112233', code, 300);
      const firstConsume = await consumeOtpChallenge(f.env.AURA_DB, key, code);
      const secondConsume = await consumeOtpChallenge(f.env.AURA_DB, key, code);
      expect(firstConsume).toBe('consumed');
      expect(secondConsume).toBe('already_consumed');
    } finally {
      f.sqlite.close();
    }
  });

  it('R01: fails closed with 503 AUTH_STATE_UNAVAILABLE when KV delete throws during OTP consumption and rolls back claim', async () => {
    const f = privacyFixture();
    f.env.ENVIRONMENT = 'production';
    f.env.PILOT_TENANT_ID = 'cafe-a';
    try {
      const phone = '0902223344';
      f.sqlite
        .prepare(
          "INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, tenant_id, verified_at, created_at) VALUES ('CUS_R01', 'r01@loyalty.aura', 'Member R01', ?, 100, 'bronze', 'cafe-a', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
        )
        .run(phone);
      const otpKey = `phone_otp:cafe-a:${phone}`;
      resetOtpClaim(f.env.AUTH_KV, otpKey);
      await f.env.AUTH_KV.put(otpKey, '112233');

      const delSpy = vi.spyOn(f.env.AUTH_KV, 'delete').mockRejectedValueOnce(new Error('KV delete failure'));
      const failRes = await app.fetch(
        new Request('https://audit.invalid/api/loyalty/phone-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp: '112233' }),
        }),
        f.env
      );
      expect(failRes.status).toBe(503);
      const failBody = (await failRes.json()) as { code?: string };
      expect(failBody.code).toBe('AUTH_STATE_UNAVAILABLE');
      delSpy.mockRestore();

      const retryRes = await app.fetch(
        new Request('https://audit.invalid/api/loyalty/phone-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp: '112233' }),
        }),
        f.env
      );
      expect(retryRes.status).toBe(200);
    } finally {
      f.sqlite.close();
    }
  });

  it('R02: enforces unverified_phone vs verified customer assurance tiers on signup, summary, wallet spend, redeem, and referral', async () => {
    const f = privacyFixture();
    f.env.ENVIRONMENT = 'production';
    f.env.PILOT_TENANT_ID = 'cafe-a';
    f.env.TELEGRAM_BOT_TOKEN = '';
    f.env.TELEGRAM_CHAT_ID = '';
    try {
      const phone = '0903334455';
      const signupRes = await app.fetch(
        new Request('https://audit.invalid/api/loyalty/phone-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, name: 'Unverified Visitor' }),
        }),
        f.env
      );
      expect(signupRes.status).toBe(200);
      const signupJson = (await signupRes.json()) as {
        token: string;
        phone_verified: boolean;
        assurance_level: string;
        bonus_granted: number;
      };
      expect(signupJson.phone_verified).toBe(false);
      expect(signupJson.assurance_level).toBe('unverified_phone');
      expect(signupJson.bonus_granted).toBe(0);

      const summaryRes = await app.fetch(
        new Request('https://audit.invalid/api/loyalty/summary', {
          headers: { Authorization: `Bearer ${signupJson.token}` },
        }),
        f.env
      );
      expect(summaryRes.status).toBe(200);
      const summaryJson = (await summaryRes.json()) as {
        data: { phone_verified: boolean; assurance_level: string };
      };
      expect(summaryJson.data.phone_verified).toBe(false);
      expect(summaryJson.data.assurance_level).toBe('unverified_phone');

      for (const blockedPath of ['/api/loyalty/spend-cashback', '/api/loyalty/redeem', '/api/loyalty/referral/apply']) {
        const mutRes = await app.fetch(
          new Request(`https://audit.invalid${blockedPath}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${signupJson.token}`,
            },
            body: JSON.stringify({ amount_vnd: 1000, reward_id: 'rw_1', code: 'REF123' }),
          }),
          f.env
        );
        expect(mutRes.status).toBe(403);
        const mutJson = (await mutRes.json()) as { code?: string };
        expect(mutJson.code).toBe('PHONE_VERIFICATION_REQUIRED');
      }

      const otpReqRes = await app.fetch(
        new Request('https://audit.invalid/api/loyalty/phone-otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, forceOtp: true }),
        }),
        f.env
      );
      expect(otpReqRes.status).toBe(200);
      const otpCode = await f.env.AUTH_KV.get(`phone_otp:cafe-a:${phone}`);
      expect(otpCode).toMatch(/^\d{6}$/);

      const verifyRes = await app.fetch(
        new Request('https://audit.invalid/api/loyalty/phone-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp: otpCode }),
        }),
        f.env
      );
      expect(verifyRes.status).toBe(200);
      const verifyJson = (await verifyRes.json()) as {
        token: string;
        phone_verified: boolean;
        assurance_level: string;
      };
      expect(verifyJson.phone_verified).toBe(true);
      expect(verifyJson.assurance_level).toBe('verified');
    } finally {
      f.sqlite.close();
    }
  });

  it('R03: enforces Customer auth_version revocation across both authenticateRequest and authCustomer and fails closed on KV errors', async () => {
    const f = privacyFixture();
    f.env.PILOT_TENANT_ID = 'cafe-a';
    try {
      const custId = 'CUS_REV_1';
      const email = 'cust.rev1@loyalty.aura';
      f.sqlite
        .prepare(
          "INSERT INTO users (id, email, name, role, password_hash, is_active, auth_version, tenant_id, created_at, updated_at) VALUES (?, ?, 'Cust Rev', 'customer', 'hash', 1, 1, 'cafe-a', datetime('now'), datetime('now'))"
        )
        .run(custId, email);
      f.sqlite
        .prepare(
          "INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, tenant_id, verified_at, created_at) VALUES (?, ?, 'Cust Rev', '0904445566', 50, 'bronze', 'cafe-a', datetime('now'), datetime('now'))"
        )
        .run(custId, email);

      const v1Token = await generateJWT(
        { id: custId, email, name: 'Cust Rev', role: 'customer', tenantId: 'cafe-a', authVersion: 1 },
        f.env.JWT_SECRET,
        3600
      );
      const versionlessToken = await generateJWT(
        { id: custId, email, name: 'Cust Rev', role: 'customer', tenantId: 'cafe-a' },
        f.env.JWT_SECRET,
        3600
      );

      const preSummary = await app.fetch(
        new Request('https://audit.invalid/api/loyalty/summary', {
          headers: { Authorization: `Bearer ${v1Token}` },
        }),
        f.env
      );
      expect(preSummary.status).toBe(200);

      const putSpy = vi.spyOn(f.env.AUTH_KV, 'put').mockRejectedValueOnce(new Error('KV unavailable'));
      const failRevokeAll = await app.fetch(
        new Request('https://audit.invalid/api/auth/devices', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${v1Token}`, 'X-Tenant-ID': 'cafe-a' },
        }),
        f.env
      );
      expect(failRevokeAll.status).toBe(503);
      const failBody = (await failRevokeAll.json()) as { code?: string };
      expect(failBody.code).toBe('AUTH_STATE_UNAVAILABLE');
      putSpy.mockRestore();

      const v2TokenForRevoke = await generateJWT(
        { id: custId, email, name: 'Cust Rev', role: 'customer', tenantId: 'cafe-a', authVersion: 2 },
        f.env.JWT_SECRET,
        3600
      );
      const okRevokeAll = await app.fetch(
        new Request('https://audit.invalid/api/auth/devices', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${v2TokenForRevoke}`, 'X-Tenant-ID': 'cafe-a' },
        }),
        f.env
      );
      expect(okRevokeAll.status).toBe(200);

      const postSummaryV1 = await app.fetch(
        new Request('https://audit.invalid/api/loyalty/summary', {
          headers: { Authorization: `Bearer ${v1Token}` },
        }),
        f.env
      );
      expect(postSummaryV1.status).toBe(401);

      const postSummaryVersionless = await app.fetch(
        new Request('https://audit.invalid/api/loyalty/summary', {
          headers: { Authorization: `Bearer ${versionlessToken}` },
        }),
        f.env
      );
      expect(postSummaryVersionless.status).toBe(401);

      const postMeV1 = await app.fetch(
        new Request('https://audit.invalid/api/auth/me', {
          headers: { Authorization: `Bearer ${v1Token}` },
        }),
        f.env
      );
      expect(postMeV1.status).toBe(401);
    } finally {
      f.sqlite.close();
    }
  });
});

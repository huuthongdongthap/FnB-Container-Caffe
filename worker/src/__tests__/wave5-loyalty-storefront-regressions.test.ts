// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { app } from '../index';
import { privacyFixture } from './helpers/privacy-sqlite-fixture';
import { generateJWT } from '../lib/jwt';
import { buildTemplateData } from '../tree/zalo/zns-templates';
import { adminLoyaltyRouter } from '../routes/admin-loyalty';
import { registerAdminHandlers } from '../routes/openapi-loyalty-handlers/admin-handlers';
import * as mauticClientFactory from '../tree/mautic/client-factory';
import { syncContacts } from '../tree/mautic/contact-sync';
import { birthdayRouter, checkBirthdayWindow } from '../routes/birthday';
import { isRuleActiveAt } from '../routes/dynamic-pricing';
import { reviewsRouter } from '../routes/reviews';
import { runCampaignTriggers } from '../tree/campaigns/cron-handler';
import { getShellConfig, hasM3NavBar } from '../../../src/components/stitch/shell-config';
import { parseLoyaltySummary, parseCashbackHistory } from '../../../src/hooks/stores/loyalty-store-helpers';
import type { Env } from '../types/env';
import type { DynamicPricingRule } from '../types/api';

const fixtures: Array<ReturnType<typeof privacyFixture>> = [];
function makeFixture() {
  const f = privacyFixture();
  fixtures.push(f);
  return f;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const f of fixtures.splice(0)) {
    f.sqlite.close();
  }
});

describe('Wave 5 Regressions (#214, #215, #217, #218, #233, #238)', () => {
  it('#214: points ZNS welcome qr_url to /loyalty and allows public tenant-scoped GET /api/loyalty/rewards while keeping admin ?limit=100 protected', async () => {
    const zns = buildTemplateData('welcome_signup', { name: 'Lan', balance: 20000 });
    expect(zns.qr_url).toBe('https://fnb-caffe-container.pages.dev/loyalty');
    expect(buildTemplateData('welcome_new', {}).qr_url).toBe('https://fnb-caffe-container.pages.dev/loyalty');

    const f = makeFixture();
    f.sqlite
      .prepare('INSERT INTO rewards (id, title, description, point_cost, discount_type, discount_value, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('rw-a-1', 'Free Cold Brew', 'Cold brew size M', 120, 'free_item', 35000, 1, 'cafe-a');
    f.sqlite
      .prepare('INSERT INTO rewards (id, title, description, point_cost, discount_type, discount_value, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('rw-a-off', 'Hidden Reward', 'Inactive', 80, 'discount', 10000, 0, 'cafe-a');
    f.sqlite
      .prepare('INSERT INTO rewards (id, title, description, point_cost, discount_type, discount_value, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('rw-b-1', 'Other Store Reward', 'Foreign', 90, 'free_item', 30000, 1, 'cafe-b');

    const pubRes = await app.fetch(new Request('https://test.aura/api/loyalty/rewards'), f.env);
    expect(pubRes.status).toBe(200);
    const pubJson = (await pubRes.json()) as {
      success: boolean;
      data: Array<{ id: string; title: string; can_redeem: boolean }>;
    };
    expect(pubJson.success).toBe(true);
    expect(pubJson.data).toEqual([
      expect.objectContaining({ id: 'rw-a-1', title: 'Free Cold Brew', can_redeem: false }),
    ]);

    const hqSpoofRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/rewards?tenant_id=hq'),
      f.env,
    );
    expect(hqSpoofRes.status).toBe(403);

    const adminUnauthRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/rewards?limit=100'),
      f.env,
    );
    expect(adminUnauthRes.status).toBe(401);
  });

  it('#215: returns requiresOtp:false for new phone, delivers OTP via Zalo ZNS / SMS webhook when configured, and falls back to store_counter without leaking OTP', async () => {
    const f = makeFixture();
    f.env.TELEGRAM_BOT_TOKEN = '';
    f.env.TELEGRAM_CHAT_ID = '';

    // 1. Brand-new phone without forceOtp -> requiresOtp: false
    const newPhoneRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/phone-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.11' },
        body: JSON.stringify({ phone: '0911222333' }),
      }),
      f.env,
    );
    expect(newPhoneRes.status).toBe(200);
    const newPhoneJson = (await newPhoneRes.json()) as { requiresOtp: boolean; otp?: string };
    expect(newPhoneJson.requiresOtp).toBe(false);
    expect(newPhoneJson.otp).toBeUndefined();

    // Seed existing customer
    f.sqlite
      .prepare(
        "INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, tenant_id, verified_at, created_at) VALUES ('CUS_W5_OTP', 'otp@aura.vn', 'Khách Xa', '0912333444', 50, 'bronze', 'cafe-a', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
      )
      .run();

    // 2. Zalo ZNS delivery when ZALO_OA_ACCESS_TOKEN is configured
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 0, message: 'Success' }), { status: 200 }),
    );
    f.env.ZALO_OA_ACCESS_TOKEN = 'zalo-oa-token-test';
    f.env.ZALO_OTP_TEMPLATE_ID = '998877';

    const zaloOtpRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/phone-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.12' },
        body: JSON.stringify({ phone: '0912333444' }),
      }),
      f.env,
    );
    expect(zaloOtpRes.status).toBe(200);
    const zaloOtpJson = (await zaloOtpRes.json()) as {
      requiresOtp: boolean;
      deliveryChannel: string;
      otp?: string;
    };
    expect(zaloOtpJson.requiresOtp).toBe(true);
    expect(zaloOtpJson.deliveryChannel).toBe('zalo_zns');
    expect(zaloOtpJson.otp).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 3. SMS webhook fallback when Zalo not configured
    delete f.env.ZALO_OA_ACCESS_TOKEN;
    delete f.env.ZALO_OTP_TEMPLATE_ID;
    f.env.SMS_WEBHOOK_URL = 'https://sms.gateway.invalid/send';
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const smsOtpRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/phone-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.13' },
        body: JSON.stringify({ phone: '0912333444' }),
      }),
      f.env,
    );
    expect(smsOtpRes.status).toBe(200);
    const smsOtpJson = (await smsOtpRes.json()) as { deliveryChannel: string; otp?: string };
    expect(smsOtpJson.deliveryChannel).toBe('sms');
    expect(smsOtpJson.otp).toBeUndefined();

    // 4. Fallback to store_counter when neither Zalo nor SMS is configured
    delete f.env.SMS_WEBHOOK_URL;
    const counterRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/phone-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.14' },
        body: JSON.stringify({ phone: '0912333444' }),
      }),
      f.env,
    );
    expect(counterRes.status).toBe(200);
    const counterJson = (await counterRes.json()) as { deliveryChannel: string; otp?: string };
    expect(counterJson.deliveryChannel).toBe('store_counter');
    expect(counterJson.otp).toBeUndefined();
  });

  it('#217: includes order_id & expires_at in GET /api/loyalty/cashback, clamps expiring_within_7d to wallet balance in summary & lookup, and enforces safe cookie CSRF rules', async () => {
    const f = makeFixture();
    const soonIso = new Date(Date.now() + 2 * 86400000).toISOString();
    f.sqlite
      .prepare(
        "INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, tenant_id, verified_at, created_at) VALUES ('CUS_CB_1', 'cb@aura.vn', 'Minh Ví', '0907778889', 300, 300, 'silver', 'cafe-a', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
      )
      .run();
    f.sqlite
      .prepare(
        "INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id, created_at, updated_at) VALUES ('wal_cb_1', 'CUS_CB_1', 12000, 50000, 38000, 'cafe-a', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
      )
      .run();
    // Raw expiring earn is 50,000₫, but current wallet balance is only 12,000₫ -> must clamp to 12,000₫!
    f.sqlite
      .prepare(
        "INSERT INTO cashback_transactions (id, wallet_id, customer_id, order_id, type, amount, balance_after, expires_at, description, tenant_id, created_at) VALUES ('cbt_1', 'wal_cb_1', 'CUS_CB_1', 'ORD_CB_99', 'earn', 50000, 50000, ?, 'Hoàn tiền đơn cà phê', 'cafe-a', '2026-01-02T00:00:00Z')",
      )
      .run(soonIso);

    const custToken = await generateJWT(
      { id: 'CUS_CB_1', email: 'cb@aura.vn', name: 'Minh Ví', role: 'customer', tenantId: 'cafe-a', authVersion: 1, phoneVerified: true },
      f.env.JWT_SECRET,
    );

    // Safe GET via Cookie: access_token works on /api/loyalty/cashback & /api/loyalty/summary
    const cbRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/cashback', {
        method: 'GET',
        headers: { Cookie: `access_token=${custToken}` },
      }),
      f.env,
    );
    expect(cbRes.status).toBe(200);
    const cbJson = (await cbRes.json()) as {
      success: boolean;
      data: Array<{ id: string; order_id: string | null; expires_at: string | null; amount: number }>;
    };
    expect(cbJson.data[0]).toMatchObject({
      id: 'cbt_1',
      order_id: 'ORD_CB_99',
      expires_at: soonIso,
      amount: 50000,
    });
    const parsedHistory = parseCashbackHistory(cbJson.data as unknown as Record<string, unknown>[]);
    expect(parsedHistory[0]).toMatchObject({ orderId: 'ORD_CB_99', expiresAt: soonIso });

    // State-changing POST with Cookie alone (no Bearer token) is blocked with 403 CSRF_TOKEN_REQUIRED
    const csrfPostRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `access_token=${custToken}` },
        body: JSON.stringify({ reward_id: 'rw_any' }),
      }),
      f.env,
    );
    expect(csrfPostRes.status).toBe(403);

    const sumRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/summary', {
        headers: { Authorization: `Bearer ${custToken}` },
      }),
      f.env,
    );
    expect(sumRes.status).toBe(200);
    const sumJson = (await sumRes.json()) as {
      data: Record<string, unknown> & {
        wallet: { balance: number; total_earned: number; total_spent: number; expiring_within_7d: number };
      };
    };
    expect(sumJson.data.wallet.expiring_within_7d).toBe(12000);
    const parsedSum = parseLoyaltySummary(sumJson.data);
    expect(parsedSum).toMatchObject({
      cashbackBalance: 12000,
      cashbackTotalEarned: 50000,
      cashbackTotalSpent: 38000,
      cashbackExpiring7d: 12000,
    });

    const staffTok = await f.token('cashier');
    const lookupRes = await app.fetch(
      new Request('https://test.aura/api/loyalty/lookup?phone=0907778889', {
        headers: { Authorization: `Bearer ${staffTok}` },
      }),
      f.env,
    );
    expect(lookupRes.status).toBe(200);
    const lookupJson = (await lookupRes.json()) as {
      member: { expiring_amount: number; expiring_within_7d: number; expiring_count: number };
    };
    expect(lookupJson.member.expiring_amount).toBe(12000);
    expect(lookupJson.member.expiring_within_7d).toBe(12000);
    expect(lookupJson.member.expiring_count).toBe(1);
  });

  it('#218 & #233: consolidates shell-config chrome ownership, accepts >15-char email-only /api/contact inquiries, and supports standalone authenticated reviews', async () => {
    // Shell chrome consolidation
    expect(getShellConfig('/checkin')?.showTop).toBe(false);
    expect(getShellConfig('/order-failure')?.showTop).toBe(false);
    expect(getShellConfig('/events')?.showTop).toBe(false);
    expect(getShellConfig('/tuyen-dung')?.showTop).toBe(false);
    expect(getShellConfig('/ung-tuyen')?.showTop).toBe(false);
    expect(getShellConfig('/reviews')?.showTop).toBe(false);
    expect(getShellConfig('/subscriptions')?.showTop).toBe(true);
    expect(getShellConfig('/loyalty-calculator')?.showTop).toBe(true);
    expect(getShellConfig('/register')?.showTop).toBe(true);
    expect(hasM3NavBar('/account')).toBe(true);
    expect(hasM3NavBar('/loyalty')).toBe(true);

    // /api/contact email-only (>15 chars) via both email field and combined phone field
    const f = makeFixture();
    const emailRes1 = await f.request('/api/contact', undefined, 'POST', {
      name: 'Nguyễn Thị Khách Hàng',
      email: 'khachhang.vip.sadec@auracafe.vn',
      content: 'Cho mình hỏi đặt tiệc 20 người cuối tuần này.',
    });
    expect(emailRes1.status).toBe(201);
    const { id: msgId1 } = (await emailRes1.json()) as { id: string };
    const saved1 = f.sqlite
      .prepare('SELECT phone, email FROM contact_messages WHERE id = ?')
      .get(msgId1) as { phone: string; email: string };
    expect(saved1).toEqual({ phone: '', email: 'khachhang.vip.sadec@auracafe.vn' });

    const emailRes2 = await f.request('/api/contact', undefined, 'POST', {
      name: 'Trần Văn B',
      phone: 'tran.van.b.long.address@example.com',
      content: 'Liên hệ hợp tác sự kiện âm nhạc.',
    });
    expect(emailRes2.status).toBe(201);
    const { id: msgId2 } = (await emailRes2.json()) as { id: string };
    const saved2 = f.sqlite
      .prepare('SELECT phone, email FROM contact_messages WHERE id = ?')
      .get(msgId2) as { phone: string; email: string };
    expect(saved2).toEqual({ phone: '', email: 'tran.van.b.long.address@example.com' });

    // /api/reviews standalone authenticated customer review without order_id
    const revApp = new Hono<{ Bindings: Env }>();
    revApp.route('/api/reviews', reviewsRouter);

    const unauthRev = await revApp.fetch(
      new Request('https://test.aura/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: 'Guest', rating: 5, comment: 'Nice!' }),
      }),
      f.env,
    );
    expect(unauthRev.status).toBe(401);

    f.sqlite
      .prepare(
        "INSERT INTO users (id, name, email, role, tenant_id, is_active, auth_version) VALUES ('cust_rev_1', 'Hội Viên A', 'hv@aura.vn', 'customer', 'cafe-a', 1, 1)",
      )
      .run();
    const custRevToken = await generateJWT(
      { id: 'cust_rev_1', email: 'hv@aura.vn', name: 'Hội Viên A', role: 'customer', tenantId: 'cafe-a', authVersion: 1 },
      f.env.JWT_SECRET,
    );
    const authRev = await revApp.fetch(
      new Request('https://test.aura/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custRevToken}` },
        body: JSON.stringify({ customer_name: 'Hội Viên A', rating: 5, comment: 'Không gian tuyệt vời!' }),
      }),
      f.env,
    );
    expect(authRev.status).toBe(201);
  });

  it('#238: derives live cashback_wallets & orders aggregates in admin-loyalty, OpenAPI loyalty admin, and Mautic sync even when customers has dead 0 columns', async () => {
    const f = makeFixture();
    // Customer has cashback_balance = 0 & visit_count = 0 on customers table, but live wallet = 45,000 and 2 completed orders = 190,000
    f.sqlite
      .prepare(
        "INSERT INTO customers (id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, cashback_balance, total_spent, visit_count, tenant_id, updated_at, created_at) VALUES ('CUS_LIVE_1', 'live@aura.vn', 'Lê Minh', '0905556667', 190, 190, 'gold', 0, 0, 0, 'cafe-a', ?, '2026-01-01T00:00:00Z')",
      )
      .run(new Date().toISOString());
    f.sqlite
      .prepare(
        "INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, total_spent, tenant_id, created_at, updated_at) VALUES ('wal_live_1', 'CUS_LIVE_1', 45000, 60000, 15000, 'cafe-a', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
      )
      .run();
    f.sqlite
      .prepare(
        "INSERT INTO orders (id, items, customer_id, customer_name, customer_phone, payment_method, total, status, payment_status, tenant_id, created_at) VALUES ('ord_l1', '[]', 'CUS_LIVE_1', 'Lê Minh', '0905556667', 'cash', 110000, 'completed', 'paid', 'cafe-a', '2026-11-20T08:00:00Z')",
      )
      .run();
    f.sqlite
      .prepare(
        "INSERT INTO orders (id, items, customer_id, customer_name, customer_phone, payment_method, total, status, payment_status, tenant_id, created_at) VALUES ('ord_l2', '[]', 'CUS_LIVE_1', 'Lê Minh', '0905556667', 'cash', 80000, 'completed', 'paid', 'cafe-a', '2026-11-21T08:00:00Z')",
      )
      .run();
    f.sqlite
      .prepare(
        "INSERT INTO orders (id, items, customer_id, customer_name, customer_phone, payment_method, total, status, payment_status, tenant_id, created_at) VALUES ('ord_cancel', '[]', 'CUS_LIVE_1', 'Lê Minh', '0905556667', 'cash', 999000, 'cancelled', 'cancelled', 'cafe-a', '2026-11-22T08:00:00Z')",
      )
      .run();

    const mgrToken = await f.token('manager');
    const admApp = new Hono<{ Bindings: Env }>();
    admApp.route('/api/admin-loyalty', adminLoyaltyRouter);

    const widgetsRes = await admApp.fetch(
      new Request('https://test.aura/api/admin-loyalty/widgets', {
        headers: { Authorization: `Bearer ${mgrToken}` },
      }),
      f.env,
    );
    expect(widgetsRes.status).toBe(200);
    const widgetsJson = (await widgetsRes.json()) as { data: Array<{ title: string; value: number | string }> };
    expect(widgetsJson.data.find((w) => w.title === 'Cashback Pool')?.value).toBe(45000);
    expect(widgetsJson.data.find((w) => w.title === 'Total Spend')?.value).toBe(190000);
    expect(widgetsJson.data.find((w) => w.title === 'Avg Visits')?.value).toBe(2);

    const exportRes = await admApp.fetch(
      new Request('https://test.aura/api/admin-loyalty/export', {
        headers: { Authorization: `Bearer ${mgrToken}` },
      }),
      f.env,
    );
    expect(exportRes.status).toBe(200);
    const csv = await exportRes.text();
    expect(csv).toContain(',45000,190000,2,');

    // OpenAPI /api/loyalty/admin/accounts
    const oaApp = new OpenAPIHono<{ Bindings: Env }>();
    oaApp.use('*', async (c, next) => {
      c.set('user' as never, { id: 'manager', role: 'manager', tenantId: 'cafe-a' } as never);
      c.set('tenantId' as never, 'cafe-a' as never);
      await next();
    });
    registerAdminHandlers(oaApp);
    const oaAccRes = await oaApp.fetch(
      new Request('https://test.aura/api/loyalty/admin/accounts?page=1&limit=20'),
      f.env,
    );
    expect(oaAccRes.status).toBe(200);
    const oaAccJson = (await oaAccRes.json()) as {
      data: Array<{ customer_id: string; cashbackBalance: number; totalSpent: number; orderCount: number }>;
    };
    const liveAcc = oaAccJson.data.find((a) => a.customer_id === 'CUS_LIVE_1');
    expect(liveAcc).toMatchObject({
      cashbackBalance: 45000,
      totalSpent: 190000,
      orderCount: 2,
    });

    // Mautic contact sync
    let syncedPayload: unknown[] = [];
    vi.spyOn(mauticClientFactory, 'getMauticClient').mockReturnValue({
      syncContacts: vi.fn(async (contacts: unknown[]) => {
        syncedPayload = contacts;
        return { created: 1, updated: 0, errors: [] };
      }),
      addToCampaign: vi.fn(),
    } as unknown as ReturnType<typeof mauticClientFactory.getMauticClient>);
    const mauticRes = await syncContacts({ AURA_DB: f.db }, 'cafe-a');
    expect(mauticRes.success).toBe(true);
    expect(syncedPayload[0]).toMatchObject({
      tier: 'gold',
      total_spent: '190000',
      visit_count: '2',
    });
  });

  it('#238: evaluates birthday window in Asia/Ho_Chi_Minh (+07:00), blocks Dec 31 + Jan 1 NYE double redemption, honors config:birthday:<tenantId> in cron, and evaluates overnight dynamic pricing rules', async () => {
    // 1. ICT timezone check: 2026-05-09T17:30:00Z is 2026-05-10 00:30 ICT!
    const ictWindow = checkBirthdayWindow('1995-05-10', new Date('2026-05-09T17:30:00Z'), 0, 0);
    expect(ictWindow.isBirthdayDay).toBe(true);
    expect(ictWindow.isEligible).toBe(true);

    // 2. NYE cycle check: Dec 30 birthday redeemed on Dec 31, 2026 ICT -> rejected on Jan 1, 2027 ICT!
    const f = makeFixture();
    f.sqlite
      .prepare(
        "INSERT INTO customers (id, email, name, phone, date_of_birth, loyalty_tier, tenant_id, created_at) VALUES ('CUS_NYE', 'nye@aura.vn', 'Khách Giao Thừa', '0909990001', '1994-12-30', 'silver', 'cafe-a', '2026-01-01T00:00:00Z')",
      )
      .run();

    const bdayApp = new Hono<{ Bindings: Env }>();
    bdayApp.route('/api/loyalty/birthday', birthdayRouter);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T08:00:00Z')); // Dec 31, 2026 15:00 ICT
    const staffToken = await f.token('cashier');
    const firstRedeem = await bdayApp.fetch(
      new Request('https://test.aura/api/loyalty/birthday/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ customer_id: 'CUS_NYE' }),
      }),
      f.env,
    );
    expect(firstRedeem.status).toBe(201);

    // Advance clock across New Year's Eve to Jan 1, 2027 10:00 ICT!
    vi.setSystemTime(new Date('2027-01-01T03:00:00Z'));
    const nextDayStaffToken = await f.token('cashier');
    const checkAfterNye = await bdayApp.fetch(
      new Request('https://test.aura/api/loyalty/birthday/check?customer_id=CUS_NYE', {
        headers: { Authorization: `Bearer ${nextDayStaffToken}` },
      }),
      f.env,
    );
    const checkAfterNyeJson = (await checkAfterNye.json()) as { data: { eligible: boolean; reason?: string } };
    expect(checkAfterNyeJson.data.eligible).toBe(false);

    const secondRedeem = await bdayApp.fetch(
      new Request('https://test.aura/api/loyalty/birthday/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nextDayStaffToken}` },
        body: JSON.stringify({ customer_id: 'CUS_NYE' }),
      }),
      f.env,
    );
    expect(secondRedeem.status).toBe(400);

    // 3. Cron config:birthday:<tenantId> autoSendEnabled toggle
    vi.setSystemTime(new Date('2026-12-30T03:00:00Z'));
    f.sqlite
      .prepare(
        "INSERT INTO consents (id, customer_id, purpose, channel, granted, source, tenant_id, granted_at, created_at) VALUES ('con_nye_1', 'CUS_NYE', 'marketing', 'sms', 1, 'signup', 'cafe-a', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
      )
      .run();
    await f.env.AUTH_KV.put('config:birthday:cafe-a', JSON.stringify({ autoSendEnabled: false }));
    const disabledCron = await runCampaignTriggers(f.env as unknown as Record<string, unknown>);
    expect(disabledCron.triggered).toBe(0);

    await f.env.AUTH_KV.put('config:birthday:cafe-a', JSON.stringify({ autoSendEnabled: true }));
    const enabledCron = await runCampaignTriggers(f.env as unknown as Record<string, unknown>);
    expect(enabledCron.triggered).toBeGreaterThanOrEqual(1);
    vi.useRealTimers();

    // 4. Dynamic pricing overnight rule: Friday (5) 22:00 -> 02:00
    const overnightRule: DynamicPricingRule = {
      id: 'rule_fri_night',
      name: 'Night Owl Friday',
      rule_type: 'happy_hour',
      discount_percent: 20,
      min_margin_percent: 30,
      days_of_week: '5', // Friday only
      start_time: '22:00',
      end_time: '02:00',
      is_active: 1,
      created_at: '2026-01-01T00:00:00Z',
    };
    // Friday 2026-11-27 23:00 ICT = 2026-11-27T16:00:00Z -> ACTIVE
    expect(isRuleActiveAt(overnightRule, new Date('2026-11-27T16:00:00Z'))).toBe(true);
    // Saturday 2026-11-28 01:30 ICT = 2026-11-27T18:30:00Z -> ACTIVE (belongs to Friday night!)
    expect(isRuleActiveAt(overnightRule, new Date('2026-11-27T18:30:00Z'))).toBe(true);
    // Friday 2026-11-27 01:30 ICT = 2026-11-26T18:30:00Z -> INACTIVE (belongs to Thursday night!)
    expect(isRuleActiveAt(overnightRule, new Date('2026-11-26T18:30:00Z'))).toBe(false);
    // Saturday 2026-11-28 23:00 ICT = 2026-11-28T16:00:00Z -> INACTIVE
    expect(isRuleActiveAt(overnightRule, new Date('2026-11-28T16:00:00Z'))).toBe(false);
  });
});

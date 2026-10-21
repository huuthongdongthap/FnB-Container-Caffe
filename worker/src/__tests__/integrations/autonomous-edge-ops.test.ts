/**
 * Integration Test: Autonomous Edge Operations & Regional Scaling (Phase 5)
 *
 * Verifies:
 * 1. Dynamic Pricing & Happy Hour Automation: time-window evaluation, velocity discounting, margin floor protection.
 * 2. AI Customer Support Assistant: multi-intent query handling (WiFi, orders, tables, loyalty, recommendations).
 * 3. Zalo OA Webhook Bridge: verification challenge, inbound message processing, and development simulation.
 * 4. Container Edge IoT Telemetry & Watchdog: heartbeat ingestion, thermal/power anomaly detection, Telegram escalation, container health matrix.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, TEST_JWT_SECRET } from '../test-utils';
import { generateJWT } from '../../lib/jwt';
import app from '../../index';

async function authRequest(
  method: string,
  path: string,
  role?: string,
  tenantId: string = 'default',
  body?: unknown
): Promise<Request> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (role) {
    const token = await generateJWT({
      id: `user-${role}`,
      sub: `user-${role}`,
      role,
      email: `${role}@test.aura`,
      name: `User ${role}`,
      tenantId
    } as any, TEST_JWT_SECRET);
    headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit & { headers: Record<string, string> } = {
    method,
    headers
  };
  if (body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  return new Request(`https://test.aura${path}`, init);
}

describe('Autonomous Edge Operations Integration (Phase 5)', () => {
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
  });

  // The watchdog escalates CRITICAL alerts to Telegram, which is a real HTTP
  // call. Stubbing fetch keeps the suite offline and deterministic — otherwise
  // the request races a 5s network timeout and fails intermittently.
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('1. Dynamic Pricing & Margin Floor Protection', () => {
    it('returns active rules during configured time window', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'rule_happy_hour',
                tenant_id: 'default',
                name: 'Happy Hour Sa Đéc',
                rule_type: 'happy_hour',
                discount_percent: 15,
                target_category: 'coffee',
                min_margin_percent: 30,
                days_of_week: '1,2,3,4,5',
                start_time: '14:00',
                end_time: '17:00',
                is_active: 1
              }
            ]
          })
        })
      });

      // Wednesday 15:30 (Day 3, between 14:00 and 17:00 in Asia/Ho_Chi_Minh)
      const testDate = '2026-10-07T15:30:00+07:00';
      const req = await authRequest('GET', `/api/pricing/dynamic/active?timestamp=${encodeURIComponent(testDate)}`);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.count).toBe(1);
      expect(json.data[0].id).toBe('rule_happy_hour');
    });

    it('calculates discounted total applying active happy hour discount', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'rule_happy_hour',
                tenant_id: 'default',
                name: 'Happy Hour Sa Đéc',
                rule_type: 'happy_hour',
                discount_percent: 15,
                target_category: 'coffee',
                min_margin_percent: 30,
                days_of_week: '1,2,3,4,5',
                start_time: '14:00',
                end_time: '17:00',
                is_active: 1
              }
            ]
          })
        })
      });

      const payload = {
        items: [
          {
            product_id: 'prod_cf_muoi',
            price: 30000,
            category: 'coffee',
            quantity: 2
          }
        ],
        timestamp: '2026-10-07T15:00:00+07:00'
      };

      const req = await authRequest('POST', '/api/pricing/dynamic/calculate', undefined, 'default', payload);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.original_total).toBe(60000);
      // 15% off 30,000 = 4,500 discount -> 25,500 each * 2 = 51,000
      expect(json.data.discounted_total).toBe(51000);
      expect(json.data.total_savings).toBe(9000);
      expect(json.data.items[0].discount_percent).toBe(15);
    });

    it('caps discount when margin floor protection is breached', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'rule_flash',
                tenant_id: 'default',
                name: 'Flash Sale 50%',
                rule_type: 'category_flash',
                discount_percent: 50,
                target_category: 'coffee',
                min_margin_percent: 30,
                days_of_week: '1,2,3,4,5',
                start_time: '00:00',
                end_time: '23:59',
                is_active: 1
              }
            ]
          })
        })
      });

      // Price: 30,000, Unit Cost: 25,000.
      // Minimum allowable price: 25,000 * 1.30 = 32,500 > 30,000 -> 0% allowable discount
      const payload = {
        items: [
          {
            product_id: 'prod_expensive_beans',
            price: 30000,
            category: 'coffee',
            quantity: 1,
            unit_cost: 25000
          }
        ],
        timestamp: '2026-10-07T10:00:00Z'
      };

      const req = await authRequest('POST', '/api/pricing/dynamic/calculate', undefined, 'default', payload);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      // Capped discount percent should be 0 because requested price would breach 30% margin
      expect(json.data.items[0].discount_percent).toBe(0);
      expect(json.data.discounted_total).toBe(30000);
    });
  });

  describe('2. AI Customer Support Assistant', () => {
    it('answers guest WiFi inquiry instantly', async () => {
      const payload = { query: 'Cho mình xin pass wifi quán với' };
      const req = await authRequest('POST', '/api/chat/assistant', undefined, 'default', payload);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.intent).toBe('wifi_info');
      expect(json.data.reply).toContain('AURA_CAFE_FREE_WIFI');
    });

    it('retrieves live order status by order ID', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: 'ord_12345',
            status: 'preparing',
            total: 55000
          }),
          run: vi.fn().mockResolvedValue({})
        })
      });

      const payload = { query: 'Kiểm tra giúp đơn ord_12345' };
      const req = await authRequest('POST', '/api/chat/assistant', undefined, 'default', payload);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.intent).toBe('order_status');
      expect(json.data.reply).toContain('đang pha chế');
    });

    it('queries active table bill by table number', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: 'ord_tbl_02',
            total: 85000,
            status: 'served'
          }),
          run: vi.fn().mockResolvedValue({})
        })
      });

      const payload = { query: 'Bàn 2 tính tiền bao nhiêu vậy?' };
      const req = await authRequest('POST', '/api/chat/assistant', undefined, 'default', payload);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.intent).toBe('table_bill');
      expect(json.data.reply).toContain('85.000đ');
    });

    it('looks up customer loyalty points by phone number', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            name: 'Nguyễn Văn A',
            loyalty_points: 120,
            loyalty_tier: 'gold'
          }),
          run: vi.fn().mockResolvedValue({})
        })
      });

      const payload = { query: 'Kiểm tra điểm tích lũy', phone: '0901234567' };
      const req = await authRequest('POST', '/api/chat/assistant', undefined, 'default', payload);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.intent).toBe('loyalty_points');
      expect(json.data.reply).toContain('120 điểm');
    });

    it('provides Sa Đéc specialty drink recommendations', async () => {
      const payload = { query: 'Quán có món gì đặc sản ngon?' };
      const req = await authRequest('POST', '/api/chat/assistant', undefined, 'default', payload);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.intent).toBe('menu_recommendation');
      expect(json.data.reply).toContain('Cà phê muối Sa Đéc');
    });
  });

  describe('3. Zalo OA Webhook Bridge', () => {
    it('echoes challenge query parameter on GET verification', async () => {
      const req = await authRequest('GET', '/api/webhooks/zalo?challenge=zalo_token_123');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('zalo_token_123');
    });

    it('processes inbound Zalo user text event and returns assistant response', async () => {
      const zaloPayload = {
        event_name: 'user_send_text',
        sender: { id: 'zalo_user_999' },
        message: { text: 'Cho mình xin pass wifi' }
      };

      const req = await authRequest('POST', '/api/webhooks/zalo', undefined, 'default', zaloPayload);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.user_id).toBe('zalo_user_999');
      expect(json.data.reply).toContain('AURA_CAFE_FREE_WIFI');
    });

    it('handles dev simulation endpoint successfully', async () => {
      const simPayload = { text: 'Menu có món gì đặc sản?' };
      const req = await authRequest('POST', '/api/webhooks/zalo/simulate', undefined, 'default', simPayload);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.simulation).toBe(true);
      expect(json.data.reply).toContain('Cà phê muối Sa Đéc');
    });

    it('enforces staff/manager/owner auth on /api/webhooks/zalo/simulate in production', async () => {
      const prodEnv = { ...mockEnv, ENVIRONMENT: 'production' };
      const simPayload = { text: 'Menu có món gì đặc sản?' };

      const unauthReq = await authRequest('POST', '/api/webhooks/zalo/simulate', undefined, 'default', simPayload);
      const unauthRes = await app.fetch(unauthReq, prodEnv);
      expect(unauthRes.status).toBe(401);

      const customerReq = await authRequest('POST', '/api/webhooks/zalo/simulate', 'customer', 'default', simPayload);
      const customerRes = await app.fetch(customerReq, prodEnv);
      expect(customerRes.status).toBe(403);

      const managerReq = await authRequest('POST', '/api/webhooks/zalo/simulate', 'manager', 'default', simPayload);
      const managerRes = await app.fetch(managerReq, prodEnv);
      expect(managerRes.status).toBe(200);
    });

    it('routes /api/webhooks/cal-booking properly, guards /bookings RBAC, and sanitizes 500 errors', async () => {
      const unauthBookings = await authRequest('GET', '/api/webhooks/cal-booking/bookings');
      const unauthBookingsRes = await app.fetch(unauthBookings, mockEnv);
      expect(unauthBookingsRes.status).toBe(401);

      const customerBookings = await authRequest('GET', '/api/webhooks/cal-booking/bookings', 'customer');
      const customerBookingsRes = await app.fetch(customerBookings, mockEnv);
      expect(customerBookingsRes.status).toBe(403);

      mockEnv.CAL_WEBHOOK_SECRET = 'cal_sec_test';
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: () => ({
          run: () => Promise.reject(new Error('SQLITE_ERROR: table bookings has no column secret_col'))
        })
      });

      const webhookReq = new Request('https://test.aura/api/webhooks/cal-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cal-webhook-secret': 'cal_sec_test'
        },
        body: JSON.stringify({
          triggerEvent: 'BOOKING_CREATED',
          createdAt: '2026-10-14T09:00:00Z',
          payload: {
            uid: 'cal_uid_123',
            title: 'Table Booking',
            startTime: '2026-10-14T10:00:00Z',
            endTime: '2026-10-14T11:00:00Z',
            attendees: [{ name: 'Test Guest', email: 'guest@test.aura', timeZone: 'Asia/Ho_Chi_Minh' }],
            organizer: { name: 'AURA Cafe', email: 'host@test.aura' },
            location: 'Sa Dec'
          }
        })
      });
      const webhookRes = await app.fetch(webhookReq, mockEnv);
      expect(webhookRes.status).toBe(500);
      const text = await webhookRes.text();
      expect(text).not.toContain('SQLITE_ERROR');
      expect(text).not.toContain('secret_col');
    });
  });

  describe('4. Container Edge IoT Telemetry & Autonomous Watchdog', () => {
    it('ingests normal telemetry heartbeat without alerts', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({})
        })
      });

      const heartbeat = {
        container_id: 'container-sadec-01',
        power_source: 'grid',
        ambient_temp_celsius: 27.5,
        kds_online: true,
        network_ping_ms: 18
      };

      const req = await authRequest('POST', '/api/edge/telemetry/heartbeat', undefined, 'default', heartbeat);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.alert_status).toBe('NORMAL');
      expect(json.data.alert_message).toBeNull();
    });

    it('detects high thermal anomaly (> 38°C) and escalates to CRITICAL', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({})
        })
      });
      mockEnv.TELEGRAM_BOT_TOKEN = 'mock-tg-token';
      mockEnv.TELEGRAM_CHAT_ID = 'mock-tg-chat';

      const heartbeat = {
        container_id: 'container-sadec-01',
        power_source: 'grid',
        ambient_temp_celsius: 39.2,
        kds_online: true
      };

      const req = await authRequest('POST', '/api/edge/telemetry/heartbeat', undefined, 'default', heartbeat);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.alert_status).toBe('CRITICAL');
      expect(json.data.alert_message).toContain('Nhiệt độ vượt ngưỡng');
    });

    it('detects power grid loss with low battery (<= 20%) as CRITICAL', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({})
        })
      });

      const heartbeat = {
        container_id: 'container-sadec-02',
        power_source: 'battery',
        battery_percentage: 15,
        ambient_temp_celsius: 29.0,
        kds_online: true
      };

      const req = await authRequest('POST', '/api/edge/telemetry/heartbeat', undefined, 'default', heartbeat);
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.alert_status).toBe('CRITICAL');
      expect(json.data.alert_message).toContain('Mất điện lưới');
    });

    it('returns regional container fleet status for managers', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 'tel_1',
                container_id: 'container-sadec-01',
                power_source: 'grid',
                battery_percentage: 100,
                ambient_temp_celsius: 26.5,
                kds_online: 1,
                alert_status: 'NORMAL',
                alert_message: null,
                created_at: new Date().toISOString()
              }
            ]
          })
        })
      });

      const req = await authRequest('GET', '/api/edge/containers/status', 'manager', 'default');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.count).toBe(1);
      expect(json.data[0].container_id).toBe('container-sadec-01');
      expect(json.data[0].operational_status).toBe('NORMAL');
    });

    it('requires shared secret or staff JWT on /api/edge/telemetry/heartbeat in production', async () => {
      const prodEnv = {
        ...mockEnv,
        ENVIRONMENT: 'production',
        EDGE_TELEMETRY_SECRET: 'edge_sec_prod_99'
      };
      prodEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({})
        })
      });

      const heartbeat = {
        container_id: 'container-sadec-01',
        power_source: 'grid',
        ambient_temp_celsius: 28.0,
        kds_online: true
      };

      const unauthReq = await authRequest('POST', '/api/edge/telemetry/heartbeat', undefined, 'default', heartbeat);
      const unauthRes = await app.fetch(unauthReq, prodEnv);
      expect(unauthRes.status).toBe(401);

      const secretReq = new Request('https://test.aura/api/edge/telemetry/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-edge-telemetry-secret': 'edge_sec_prod_99'
        },
        body: JSON.stringify(heartbeat)
      });
      const secretRes = await app.fetch(secretReq, prodEnv);
      expect(secretRes.status).toBe(200);
    });
  });
});

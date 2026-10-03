/**
 * Comprehensive 12 Pillars Ecosystem E2E Integration Test Suite
 *
 * Validates the operational integrity and contracts across all 12 pillars:
 *  1. ERPNext (POS/ERP/CRM)
 *  2. Cal.com (Table & Event Scheduling)
 *  3. OpenWISP (WiFi Captive Portal & CRM Tagging)
 *  4. pretix (Workshop & Event Ticketing)
 *  5. TastyIgniter (Online Ordering POS Bridge & Inbound Webhooks)
 *  6. Xibo/Anthias (Digital Signage Display Feeds)
 *  7. Mautic (Marketing Automation & Lead Sync)
 *  8. Home Assistant (IoT Presence Triggers & Device Control)
 *  9. Frigate (CCTV AI Person Detection & Occupancy Analytics)
 * 10. Payment Gateways (PayOS & Checkout Links)
 * 11. Mixpost (Social Media Auto-Publishing)
 * 12. SMTP / Transactional Email (Receipts & Notifications)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 1. ERPNext
import { ErpnextClient } from '../../clients/erpnext-client';
import { ErpnextAccountingClient } from '../../clients/erpnext-accounting-client';
import { ErpnextCrmClient } from '../../clients/erpnext-crm-client';

// 2. Cal.com
import { createCalBookingClient } from '../../lib/cal-booking-client';

// 3. OpenWISP
import {
  loginWifiGuest,
  checkWifiSessionStatus,
  authorizeWifiOverride,
  normalizeMac,
  normalizePhone
} from '../../tree/wifi/session';

// 4. pretix
import { createPretixClient } from '../../lib/pretix-client';
import { validateWebhookSignature } from '../../tree/pretix/hmac-validator';

// 5. TastyIgniter
import { createTastyIgniterClient } from '../../clients/tastyigniter-client';
import { syncTIToLocalMenu, bridgeOrderToTI } from '../../tree/integrations/tastyigniter/sync';
import { processTIWebhook, mapTIStatusToLocal } from '../../tree/integrations/tastyigniter/webhook';

// 6. Xibo/Anthias
import { Hono } from 'hono';
import { signageRouter } from '../../routes/signage';

// 7. Mautic
import { MauticClient } from '../../lib/mautic-client';
import { toMauticContact } from '../../tree/mautic/contact-mapper';

// 8. Home Assistant
import { toggleDevice, getDeviceState } from '../../tree/homeassistant/devices';
import { dispatchDiningPresence, handleHAWebhook } from '../../tree/homeassistant/presence';

// 9. Frigate
import { createFrigateClient } from '../../clients/frigate-client';
import { syncFrigateEvents } from '../../tree/integrations/frigate/sync';
import { getOccupancyAnalytics } from '../../tree/integrations/frigate/occupancy';

// 10. Payment Gateways (PayOS & Checkout)
import { verifySignature } from '../../routes/webhooks-handlers/helpers';
import { payOSCreateLinkSchema, payosWebhookSchema } from '../../lib/validators/payos';
import { PaymentIntentSchema } from '../../schemas/payments';

// 11. Mixpost
import { createMixpostClient } from '../../lib/mixpost-client';

// 12. SMTP / Email
import { sendEmail } from '../../lib/email';

// --- Mock In-Memory Database Helper ---
function createInMemoryD1() {
  const store = new Map<string, Array<Record<string, unknown>>>();
  store.set('customers', []);
  store.set('wifi_sessions', []);
  store.set('ti_order_bridge', []);
  store.set('ti_menu_cache', []);
  store.set('frigate_events', []);
  store.set('ha_device_states', [
    { entity_id: 'switch.dining_lamps', state: 'off', attributes: null }
  ]);
  store.set('ha_automation_log', []);
  store.set('orders', []);
  store.set('erpnext_mappings', []);
  store.set('products', [
    {
      product_name: 'Ca phe Muoi',
      price: 45000,
      image_url: null,
      description: 'Signature coffee',
      category_id: 1,
      category_name: 'Coffee',
      category_sort_order: 1
    }
  ]);

  return {
    _store: store,
    prepare(sql: string) {
      let binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds = args;
          return stmt;
        },
        async run() {
          const lower = sql.toLowerCase().replace(/\s+/g, ' ');
          if (lower.includes('insert into wifi_sessions') || lower.includes('insert or replace into wifi_sessions')) {
            const list = store.get('wifi_sessions')!;
            if (binds.length === 9) {
              list.push({
                id: binds[0],
                client_mac: binds[1],
                ip_address: binds[2],
                phone: binds[3],
                customer_id: binds[4],
                status: 'authorized',
                session_timeout: binds[5] ?? 3600,
                authorized_at: binds[6] ?? new Date().toISOString(),
                expires_at: binds[7] ?? new Date(Date.now() + 3600000).toISOString(),
                created_at: binds[8] ?? new Date().toISOString()
              });
            } else if (binds.length === 6) {
              list.push({
                id: binds[0],
                client_mac: binds[1],
                ip_address: null,
                phone: null,
                customer_id: null,
                status: 'authorized',
                session_timeout: binds[2] ?? 7200,
                authorized_at: binds[3] ?? new Date().toISOString(),
                expires_at: binds[4] ?? new Date(Date.now() + 7200000).toISOString(),
                created_at: binds[5] ?? new Date().toISOString()
              });
            } else {
              list.push({
                id: binds[0],
                client_mac: binds[1],
                ip_address: binds[2],
                phone: binds[3],
                customer_id: binds[4],
                status: 'authorized',
                session_timeout: 3600,
                authorized_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                created_at: new Date().toISOString()
              });
            }
            return { success: true, meta: { changes: 1 } };
          }
          if (lower.includes('insert into customers')) {
            const list = store.get('customers')!;
            list.push({
              id: binds[0],
              email: binds[1],
              name: binds[2],
              phone: binds[3],
              loyalty_points: binds[4] ?? 0,
              lifetime_points: binds[5] ?? 0,
              loyalty_tier: binds[6] ?? 'BRONZE',
              source: binds[7] ?? 'wifi_portal',
              created_at: binds[8] ?? new Date().toISOString(),
              updated_at: binds[9] ?? new Date().toISOString()
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (lower.includes('update customers set updated_at = ? where id = ?')) {
            const list = store.get('customers')!;
            const item = list.find(c => c.id === binds[1]);
            if (item) item.updated_at = binds[0];
            return { success: true, meta: { changes: 1 } };
          }
          if (lower.includes('update wifi_sessions') && lower.includes('status = "revoked"')) {
            const list = store.get('wifi_sessions')!;
            const item = list.find(s => s.client_mac === binds[1]);
            if (item) item.status = 'revoked';
            return { success: true, meta: { changes: 1 } };
          }
          if (lower.includes('insert into ti_order_bridge')) {
            const list = store.get('ti_order_bridge')!;
            list.push({
              id: binds[0],
              local_order_id: binds[1],
              ti_order_id: binds[2],
              status: binds[3],
              synced_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (lower.includes('update ti_order_bridge set status = ?')) {
            const list = store.get('ti_order_bridge')!;
            const item = list.find(b => b.id === binds[2]);
            if (item) {
              item.status = binds[0];
              if (binds[1]) item.ti_order_id = binds[1];
            }
            return { success: true, meta: { changes: 1 } };
          }
          if (lower.includes('insert or replace into ha_device_states')) {
            const list = store.get('ha_device_states')!;
            const existing = list.findIndex(d => d.entity_id === binds[0]);
            const entry = {
              entity_id: binds[0],
              state: binds[1],
              attributes: binds[2],
              last_changed: binds[3],
              last_updated: new Date().toISOString()
            };
            if (existing >= 0) list[existing] = entry;
            else list.push(entry);
            return { success: true, meta: { changes: 1 } };
          }
          if (lower.includes('insert into ha_automation_log')) {
            const list = store.get('ha_automation_log')!;
            list.push({
              id: list.length + 1,
              automation_id: binds[0],
              trigger_entity: binds[1],
              payload: binds[2],
              result: binds[3],
              executed_at: binds[4] ?? new Date().toISOString()
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (lower.includes('update ha_device_states set state = ?')) {
            const list = store.get('ha_device_states')!;
            const item = list.find(d => d.entity_id === binds[1]);
            if (item) item.state = binds[0];
            return { success: true, meta: { changes: 1 } };
          }
          if (lower.includes('insert or ignore into frigate_events')) {
            const list = store.get('frigate_events')!;
            list.push({
              id: binds[0],
              camera: binds[1],
              label: binds[2],
              start_time: binds[3],
              end_time: binds[4],
              score: binds[5],
              payload: binds[6],
              received_at: new Date().toISOString()
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (lower.includes('insert into erpnext_mappings')) {
            const list = store.get('erpnext_mappings')!;
            list.push({
              id: list.length + 1,
              order_id: binds[0],
              erpnext_id: binds[1],
              sync_status: 'completed',
              created_at: new Date().toISOString()
            });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 1 } };
        },
        async first<T = unknown>() {
          const lower = sql.toLowerCase().replace(/\s+/g, ' ');
          if (lower.includes('from wifi_sessions') && lower.includes('client_mac = ?')) {
            const list = store.get('wifi_sessions')!;
            const found = list
              .slice()
              .reverse()
              .find(s => s.client_mac === binds[0] && s.status === 'authorized');
            return (found ?? null) as T | null;
          }
          if (lower.includes('from customers') && lower.includes('phone = ?')) {
            const list = store.get('customers')!;
            const found = list.find(c => c.phone === binds[0]);
            return (found ?? null) as T | null;
          }
          if (lower.includes('from ti_order_bridge') && lower.includes('ti_order_id = ?')) {
            const list = store.get('ti_order_bridge')!;
            const found = list.find(b => b.ti_order_id === binds[0]);
            return (found ?? null) as T | null;
          }
          if (lower.includes('from ti_order_bridge') && lower.includes('local_order_id = ?')) {
            const list = store.get('ti_order_bridge')!;
            const found = list.find(b => b.local_order_id === binds[0]);
            return (found ?? null) as T | null;
          }
          if (lower.includes('from ha_device_states') && lower.includes('entity_id = ?')) {
            const list = store.get('ha_device_states')!;
            const found = list.find(d => d.entity_id === binds[0]);
            return (found ?? null) as T | null;
          }
          if (lower.includes('from erpnext_mappings') && lower.includes('order_id = ?')) {
            const list = store.get('erpnext_mappings')!;
            const found = list.find(m => m.order_id === binds[0]);
            return (found ?? null) as T | null;
          }
          return null;
        },
        async all<T = unknown>() {
          const lower = sql.toLowerCase().replace(/\s+/g, ' ');
          if (lower.includes('from products')) {
            const list = store.get('products')!;
            return { results: list as T[], success: true };
          }
          if (lower.includes('from frigate_events') && lower.includes('group by camera')) {
            const list = store.get('frigate_events')!;
            const grouped = new Map<string, number>();
            for (const ev of list) {
              if (ev.label === 'person') {
                grouped.set(ev.camera as string, (grouped.get(ev.camera as string) ?? 0) + 1);
              }
            }
            const results = Array.from(grouped.entries()).map(([camera, count]) => ({
              camera,
              count,
              last_seen: new Date().toISOString()
            }));
            return { results: results as T[], success: true };
          }
          if (lower.includes('from frigate_events') && lower.includes('group by hour')) {
            return {
              results: [
                { hour: 9, count: 12 },
                { hour: 14, count: 28 },
                { hour: 19, count: 15 }
              ] as T[],
              success: true
            };
          }
          if (lower.includes('from ha_automation_log')) {
            const list = store.get('ha_automation_log')!;
            return { results: list as T[], success: true };
          }
          return { results: [] as T[], success: true };
        }
      };
      return stmt;
    }
  } as unknown as import('@cloudflare/workers-types').D1Database;
}

describe('12 Pillars Ecosystem Integration E2E', () => {
  let db: import('@cloudflare/workers-types').D1Database;
  let env: Record<string, unknown>;

  beforeEach(() => {
    db = createInMemoryD1();
    env = {
      AURA_DB: db,
      ENVIRONMENT: 'test',
      ERP_NEXT_URL: 'https://erp.auracafe.vn',
      ERP_NEXT_API_KEY: 'test-erp-key',
      ERP_NEXT_API_SECRET: 'test-erp-secret',
      CAL_API_KEY: 'test-cal-key',
      PRETIX_API_URL: 'https://pretix.auracafe.vn',
      PRETIX_API_TOKEN: 'test-pretix-token',
      PRETIX_ORGANIZER: 'auracafe',
      PRETIX_WEBHOOK_SECRET: 'test-pretix-secret',
      TASTYIGNITER_URL: 'https://orders.auracafe.vn',
      TASTYIGNITER_API_KEY: 'test-ti-key',
      TASTYIGNITER_SYNC_ENABLED: 'true',
      MAUTIC_BASE_URL: 'https://mautic.auracafe.vn',
      MAUTIC_PUBLIC_KEY: 'test-mautic-pub',
      MAUTIC_SECRET_KEY: 'test-mautic-sec',
      HA_URL: 'http://ha.internal:8123',
      HA_TOKEN: 'test-ha-token',
      HA_MOCK: 'false',
      FRIGATE_URL: 'http://frigate.internal:5000',
      FRIGATE_SYNC_ENABLED: 'true',
      PAYOS_CLIENT_ID: 'test-payos-client',
      PAYOS_API_KEY: 'test-payos-key',
      PAYOS_CHECKSUM_KEY: 'test-payos-checksum-32-chars-long!!',
      MIXPOST_API_URL: 'https://mixpost.auracafe.vn',
      MIXPOST_API_KEY: 'test-mixpost-key',
      SENDGRID_API_KEY: 'test-sg-key',
      EMAIL_FROM: 'hello@auracafe.vn'
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Pillar 1: ERPNext ──────────────────────────────────────────────────────
  describe('Pillar 1: ERPNext (POS/ERP/CRM)', () => {
    it('initializes clients with auth headers and handles POS sales order creation', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { name: 'SAL-ORD-2026-001', docstatus: 1 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const client = new ErpnextClient({
        url: env.ERP_NEXT_URL as string,
        apiKey: env.ERP_NEXT_API_KEY as string,
        apiSecret: env.ERP_NEXT_API_SECRET as string
      });

      const res = await client.create<{ name: string }>('Sales Order', {
        customer: 'Walk-in Diner',
        items: [{ item_code: 'CAFE_SUA_DA', qty: 2, rate: 35000 }]
      });

      expect(res.data.name).toBe('SAL-ORD-2026-001');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/resource/Sales'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'token test-erp-key:test-erp-secret'
          })
        })
      );
    });

    it('processes order to invoice with ERPNext accounting client', async () => {
      const fetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/Customer')) {
          return new Response(JSON.stringify({ data: [{ name: 'CUS-001', customer_name: 'Minh Tu' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ data: { name: 'ACC-SINV-2026-0089', grand_total: 70000 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const client = new ErpnextClient({
        url: env.ERP_NEXT_URL as string,
        apiKey: env.ERP_NEXT_API_KEY as string,
        apiSecret: env.ERP_NEXT_API_SECRET as string
      });

      const accounting = new ErpnextAccountingClient(client, db as any);
      const inv = await accounting.processOrderToInvoice(
        {
          id: 'ord-101',
          customer_name: 'Minh Tu',
          customer_phone: '0901234567',
          items: [{ item_code: 'ESPRESSO_SINGLE', qty: 1, rate: 45000 }]
        },
        env as any
      );

      expect(inv.success).toBe(true);
      expect(inv.erpnextInvoiceId).toBe('ACC-SINV-2026-0089');
    });

    it('creates lead in ERPNext CRM client', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { name: 'LEAD-2026-001' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const client = new ErpnextClient({
        url: env.ERP_NEXT_URL as string,
        apiKey: env.ERP_NEXT_API_KEY as string,
        apiSecret: env.ERP_NEXT_API_SECRET as string
      });

      const crm = new ErpnextCrmClient(client);
      const lead = await crm.createLead({
        id: 'CUS-001',
        name: 'Nguyen Van A',
        email: 'vana@example.com',
        phone: '0901234567',
        consent_marketing: true,
        consent_erpnext_sync: true
      });

      expect(lead).toBeDefined();
      expect(lead?.leadId).toBe('LEAD-2026-001');
    });
  });

  // ── Pillar 2: Cal.com ──────────────────────────────────────────────────────
  describe('Pillar 2: Cal.com (Table & Event Scheduling)', () => {
    it('manages private workshop bookings and verifies booking details', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 981,
            uid: 'cal-booking-uid-1',
            title: 'Barista Workshop Room',
            status: 'ACCEPTED'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      vi.stubGlobal('fetch', fetchMock);

      const cal = createCalBookingClient(env.CAL_API_KEY as string, 'https://api.cal.com/v2');
      const booking = await cal.getBooking('cal-booking-uid-1');
      expect(booking).toBeDefined();
      expect(booking.title).toBe('Barista Workshop Room');
    });
  });

  // ── Pillar 3: OpenWISP ─────────────────────────────────────────────────────
  describe('Pillar 3: OpenWISP (WiFi Captive Portal & CRM Tagging)', () => {
    it('authorizes guest connection, registers customer, and calculates remaining TTL', async () => {
      const mac = 'AA:BB:CC:11:22:33';
      const phone = '0901234567';

      // 1. Initial status check: unauthorized
      const preStatus = await checkWifiSessionStatus(env, mac);
      expect(preStatus.authorized).toBe(false);
      expect(preStatus.remaining_seconds).toBe(0);

      // 2. Guest submits phone on captive portal
      const loginRes = await loginWifiGuest(env, {
        mac,
        phone,
        name: 'Coffee Lover',
        ip_address: '192.168.1.105'
      });

      expect(loginRes.success).toBe(true);
      expect(loginRes.authorized).toBe(true);
      expect(loginRes.redirect_url).toContain('/menu');
      expect(loginRes.remaining_seconds).toBe(3600);

      // 3. Status check: authorized with active TTL
      const postStatus = await checkWifiSessionStatus(env, mac);
      expect(postStatus.authorized).toBe(true);
      expect(postStatus.remaining_seconds).toBeGreaterThan(3500);

      // 4. Staff manual revoke override
      const revokeRes = await authorizeWifiOverride(env, { mac, action: 'revoke' });
      expect(revokeRes.success).toBe(true);
      expect(revokeRes.action).toBe('revoked');

      // 5. Subsequent status check reflects revoked state
      const revokedStatus = await checkWifiSessionStatus(env, mac);
      expect(revokedStatus.authorized).toBe(false);
    });

    it('rejects invalid Vietnamese phone formats gracefully', async () => {
      await expect(
        loginWifiGuest(env, {
          mac: '11:22:33:44:55:66',
          phone: '12345'
        })
      ).rejects.toThrow('Invalid Vietnamese phone number format');
    });

    it('normalizes MAC and phone formats consistently', () => {
      expect(normalizeMac('aabbcc112233')).toBe('AA:BB:CC:11:22:33');
      expect(normalizeMac('AA-BB-CC-11-22-33')).toBe('AA:BB:CC:11:22:33');
      expect(normalizePhone('+84901234567')).toBe('0901234567');
      expect(normalizePhone('84901234567')).toBe('0901234567');
    });
  });

  // ── Pillar 4: pretix ───────────────────────────────────────────────────────
  describe('Pillar 4: pretix (Workshop Ticketing & HMAC)', () => {
    it('authenticates pretix webhook signatures and executes ticket check-in', async () => {
      const secret = env.PRETIX_WEBHOOK_SECRET as string;
      const body = JSON.stringify({
        notification_id: 42,
        organizer: 'auracafe',
        event: 'latte-art-101',
        code: 'ORDER-XYZ-9',
        action: 'pretix.event.order.placed'
      });

      // Compute HMAC-SHA256 signature in browser/web standard
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(body));
      const hexSig = Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const isValid = await validateWebhookSignature(body, hexSig, secret);
      expect(isValid).toBe(true);

      // Client check-in call
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );
      vi.stubGlobal('fetch', fetchMock);

      const pretix = createPretixClient(env.PRETIX_API_URL as string, env.PRETIX_API_TOKEN as string);
      const res = await pretix.redeemCheckin('auracafe', 'latte-art-101', 1234, 'secret-ticket-token');
      expect(res.status).toBe('ok');
    });
  });

  // ── Pillar 5: TastyIgniter ─────────────────────────────────────────────────
  describe('Pillar 5: TastyIgniter (Online Ordering POS Bridge)', () => {
    it('bridges local orders to TastyIgniter and processes inbound status webhook', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { id: 'TI-889', status: 'received' } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      // 1. Bridge order
      const bridgeRes = await bridgeOrderToTI(env as any, 'ord-local-501', {
        customer_name: 'Minh Tu',
        customer_phone: '0908889999',
        table_id: 'Table-04',
        items: [{ name: 'Bac Xiu', price: 39000, quantity: 1 }],
        total: 39000
      });

      expect(bridgeRes.ok).toBe('synced');

      // 2. Inbound webhook from TI updates status to delivered -> completed
      const webhookRes = await processTIWebhook(env, {
        event: 'order.status_updated',
        order_id: 'TI-889',
        status: 'delivered'
      });

      expect(webhookRes.success).toBe(true);
      expect(webhookRes.mapped_status).toBe('completed');
    });

    it('correctly maps all TastyIgniter order status transitions', () => {
      expect(mapTIStatusToLocal('received')).toBe('confirmed');
      expect(mapTIStatusToLocal('pending')).toBe('confirmed');
      expect(mapTIStatusToLocal('preparing')).toBe('preparing');
      expect(mapTIStatusToLocal('ready')).toBe('ready');
      expect(mapTIStatusToLocal('delivered')).toBe('completed');
      expect(mapTIStatusToLocal('completed')).toBe('completed');
      expect(mapTIStatusToLocal('cancelled')).toBe('cancelled');
    });
  });

  // ── Pillar 6: Xibo/Anthias ─────────────────────────────────────────────────
  describe('Pillar 6: Xibo/Anthias (Digital Signage Display Feeds)', () => {
    it('serves digital signage menu board feeds in display player compatible format', async () => {
      const app = new Hono<{ Bindings: Record<string, unknown> }>();
      app.route('/api/signage', signageRouter as any);

      const req = new Request('https://auracafe.vn/api/signage/menu', { method: 'GET' });
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = await res.json<{ success: boolean; data: unknown[] }>();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  // ── Pillar 7: Mautic ───────────────────────────────────────────────────────
  describe('Pillar 7: Mautic (Marketing Automation & Lead Sync)', () => {
    it('maps local customer profile to Mautic contact attributes and segments', () => {
      const customer = {
        id: 'CUS-VIP-01',
        name: 'Tran Hoang',
        email: 'hoang@aura.vn',
        phone: '0987654321',
        loyalty_tier: 'GOLD',
        total_spent: 1250000,
        visit_count: 14
      };

      const mapped = toMauticContact(customer as never);
      expect(mapped.email).toBe('hoang@aura.vn');
      expect(mapped.firstname).toBe('Tran Hoang');
      expect(mapped.phone).toBe('0987654321');
    });
  });

  // ── Pillar 8: Home Assistant ───────────────────────────────────────────────
  describe('Pillar 8: Home Assistant (IoT Ambiance & Presence Triggers)', () => {
    it('caches and toggles smart devices and logs automation triggers', async () => {
      // Toggle device
      const toggleRes = await toggleDevice(env, 'switch.dining_lamps', true);
      expect(toggleRes.status).toBe(200);
      const toggleJson = await toggleRes.json<{ result: { state: string } }>();
      expect(toggleJson.result.state).toBe('on');

      // Check device state
      const stateRes = await getDeviceState(env, 'switch.dining_lamps');
      expect(stateRes.status).toBe(200);
      const stateJson = await stateRes.json<{ device: { state: string } }>();
      expect(stateJson.device.state).toBe('on');
    });

    it('dispatches customer_arrived and table_occupied dining presence automations', async () => {
      const arrival = await dispatchDiningPresence(env, 'customer_arrived', {
        table_number: 'B-02',
        guest_count: 3
      });
      expect(arrival.success).toBe(true);
      expect(arrival.event).toBe('customer_arrived');

      const occupied = await dispatchDiningPresence(env, 'table_occupied', {
        table_number: 'B-02',
        order_id: 'ord-8891'
      });
      expect(occupied.success).toBe(true);
      expect(occupied.event).toBe('table_occupied');
    });

    it('processes inbound state update webhook from Home Assistant', async () => {
      const webhookRes = await handleHAWebhook(env, {
        entity_id: 'sensor.patio_temperature',
        state: '26.5',
        attributes: { unit_of_measurement: '°C' }
      });

      expect(webhookRes.success).toBe(true);
      expect(webhookRes.action_taken).toBe('device_updated:sensor.patio_temperature');
    });
  });

  // ── Pillar 9: Frigate ──────────────────────────────────────────────────────
  describe('Pillar 9: Frigate (CCTV AI Person Detection & Occupancy)', () => {
    it('persists AI detection events and calculates aggregated zone occupancy', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { id: '1727950000.1-abc', camera: 'dining', label: 'person', start_time: Math.floor(Date.now() / 1000) - 100, score: 0.89 },
            { id: '1727950000.2-def', camera: 'patio', label: 'person', start_time: Math.floor(Date.now() / 1000) - 50, score: 0.94 }
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      vi.stubGlobal('fetch', fetchMock);

      const syncResult = await syncFrigateEvents(env as any, { limit: 10 });
      expect(syncResult.ok).toBe(true);
      expect(syncResult.synced).toBe(2);

      // Occupancy analytics
      const analytics = await getOccupancyAnalytics(env);
      expect(analytics.current_occupancy).toBeGreaterThan(0);
      expect(Array.isArray(analytics.peak_hours)).toBe(true);
      expect(analytics.peak_hours).toHaveLength(24);
      expect(Array.isArray(analytics.camera_breakdown)).toBe(true);
    });

    it('returns synthetic realistic data in mock/fallback mode when unconfigured', async () => {
      const mockReport = await getOccupancyAnalytics({ AURA_DB: db, FRIGATE_SYNC_ENABLED: 'false' });
      expect(mockReport.mock).toBe(true);
      expect(mockReport.current_occupancy).toBe(13);
      expect(mockReport.camera_breakdown.length).toBeGreaterThan(0);
    });
  });

  // ── Pillar 10: Payment Gateways ────────────────────────────────────────────
  describe('Pillar 10: Payment Gateways (PayOS & Checkout)', () => {
    it('validates PayOS webhook signatures with HMAC-SHA256 constant-time check', async () => {
      const checksumKey = env.PAYOS_CHECKSUM_KEY as string;
      const data: Record<string, unknown> = {
        amount: 50000,
        description: 'Thanh toan cafe',
        orderCode: 123456
      };

      // Compute HMAC-SHA256
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(checksumKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sortedData = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('&');
      const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(sortedData));
      const validSig = Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const valid = await verifySignature(data, validSig, checksumKey);
      expect(valid).toBe(true);

      const invalid = await verifySignature(data, 'invalid_signature_hex_value', checksumKey);
      expect(invalid).toBe(false);
    });

    it('validates PayOS link creation and webhook schemas', () => {
      const linkParsed = payOSCreateLinkSchema.safeParse({
        order_id: 'ord-test-999',
        amount: 65000,
        customer_name: 'Diner Test',
        description: 'Payment for order #999',
        return_url: 'https://auracafe.vn/success',
        cancel_url: 'https://auracafe.vn/cancel'
      });
      expect(linkParsed.success).toBe(true);

      const webhookParsed = payosWebhookSchema.safeParse({
        success: true,
        data: {
          orderCode: 999,
          amount: 65000,
          description: 'Payment for order #999'
        }
      });
      expect(webhookParsed.success).toBe(true);
    });
  });

  // ── Pillar 11: Mixpost ─────────────────────────────────────────────────────
  describe('Pillar 11: Mixpost (Social Media Auto-Publishing)', () => {
    it('schedules promotional messages and menu specials for social platforms', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: 701, text: 'Special weekend offer: 20% off all cold brew!', status: 'SCHEDULED' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
      vi.stubGlobal('fetch', fetchMock);

      const mixpost = createMixpostClient(env.MIXPOST_API_URL as string, env.MIXPOST_API_KEY as string);
      const post = await mixpost.createPost({
        accounts: [1],
        content: 'Special weekend offer: 20% off all cold brew!',
        scheduledAt: '2026-10-04T08:00:00Z'
      });

      expect(post).toBeDefined();
    });
  });

  // ── Pillar 12: SMTP / Transactional Email ──────────────────────────────────
  describe('Pillar 12: SMTP / Transactional Email', () => {
    it('dispatches HTML order receipts and booking confirmations', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 202 }));
      vi.stubGlobal('fetch', fetchMock);

      const sent = await sendEmail(
        {
          SENDGRID_API_KEY: env.SENDGRID_API_KEY as string,
          EMAIL_FROM: env.EMAIL_FROM as string
        },
        {
          to: 'customer@auracafe.vn',
          subject: 'AURA CAFE — Hoa don dien tu #ORD-8812',
          html: '<h1>Cam on ban da den AURA CAFE!</h1><p>Tong tien: 125,000 VND</p>'
        }
      );

      expect(sent).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-sg-key'
          })
        })
      );
    });

    it('handles missing credentials or empty recipients without throwing', async () => {
      const unconfigured = await sendEmail({}, {
        to: 'customer@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      });
      expect(unconfigured).toBe(false);
    });
  });
});

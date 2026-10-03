/**
 * Integration Test: AI & Edge Automation (Q3 2027)
 *
 * Verifies:
 * 1. AI Menu Recommendations: Frequently bought together, cold-start fallback, and trending velocity.
 * 2. Affinity Mining: Pair association extraction from historical D1 orders.
 * 3. Predictive Inventory: Depletion run-rate (v_run), Days-of-Supply (DOS), and stock-out alerts.
 * 4. Demand Forecasting: Day-of-week seasonality, 7-day revenue projections, and peak rush windows.
 * 5. AI Barista Concierge: Dual-engine specialty coffee advisor with deterministic edge fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('AI & Edge Automation Integration', () => {
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
  });

  describe('1. AI Menu Recommendations', () => {
    it('returns 400 when item_id is missing', async () => {
      const req = await authRequest('GET', '/api/recommendations/frequently-bought-together');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.success).toBe(false);
      expect(data.error).toContain('item_id');
    });

    it('returns cold-start fallback recommendations when no affinities exist', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] })
        })
      });

      const req = await authRequest('GET', '/api/recommendations/frequently-bought-together?item_id=prod_cf_den');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0]).toHaveProperty('id');
      expect(json.data[0]).toHaveProperty('reason');
    });

    it('returns mined co-occurrence companions when affinity data is present', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { id: 'banh_mi_hoa_hong', co_occurrence_count: 42, affinity_score: 0.85 },
              { id: 'croissant_bo', co_occurrence_count: 28, affinity_score: 0.62 }
            ]
          })
        })
      });

      const req = await authRequest('GET', '/api/recommendations/frequently-bought-together?item_id=cafe_muoi_sadec');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(2);
      expect(json.data[0].id).toBe('banh_mi_hoa_hong');
      expect(json.data[0].reason).toContain('85%');
    });

    it('returns trending items based on recent order velocity', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { items: JSON.stringify([{ product_id: 'cafe_muoi_sadec', name: 'Cà phê muối Sa Đéc', quantity: 3 }]) },
              { items: JSON.stringify([{ product_id: 'cafe_muoi_sadec', name: 'Cà phê muối Sa Đéc', quantity: 2 }]) },
              { items: JSON.stringify([{ product_id: 'tra_sen', name: 'Trà sen', quantity: 1 }]) }
            ]
          })
        })
      });

      const req = await authRequest('GET', '/api/recommendations/trending?range=24h');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data[0].id).toBe('cafe_muoi_sadec');
      expect(json.data[0].orders_count).toBe(5);
    });

    it('mines order pairs and inserts affinities when called by staff', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { items: JSON.stringify([{ product_id: 'cafe_muoi', quantity: 1 }, { product_id: 'banh_mi', quantity: 1 }]) }
            ]
          }),
          run: vi.fn().mockResolvedValue({ success: true })
        })
      });
      mockEnv.AURA_DB.batch = vi.fn().mockResolvedValue([]);

      const req = await authRequest('POST', '/api/recommendations/mine-affinities', 'owner');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.mined_pairs).toBeGreaterThan(0);
    });
  });

  describe('2. Predictive Inventory & Stock-Out Forecasting', () => {
    it('requires authentication for inventory forecasting', async () => {
      const req = await authRequest('GET', '/api/inventory/forecasting/run-rate');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(401);
    });

    it('computes run-rate, days-of-supply, and flags CRITICAL stock-outs', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('FROM inventory_items')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  { id: 'item_1', sku: 'SKU-ROBUSTA', name: 'Hạt Robusta Sa Đéc', current_stock: 5, min_stock: 10, max_stock: 50, unit: 'kg' },
                  { id: 'item_2', sku: 'SKU-SUA-DAC', name: 'Sữa đặc Ông Thọ', current_stock: 40, min_stock: 10, max_stock: 50, unit: 'lon' }
                ]
              })
            })
          };
        }
        if (query.includes('FROM inventory_transactions')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  // 21 kg depleted over 7 days -> 3 kg/day. Stock = 5 kg -> DOS = 1.67 days -> CRITICAL!
                  { inventory_item_id: 'item_1', total_depleted: 21 },
                  // 7 lon depleted over 7 days -> 1 lon/day. Stock = 40 lon -> DOS = 40 days -> HEALTHY
                  { inventory_item_id: 'item_2', total_depleted: 7 }
                ]
              })
            })
          };
        }
        return { bind: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: [] }) }) };
      });

      const req = await authRequest('GET', '/api/inventory/forecasting/run-rate?days=7', 'manager');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);

      const robusta = json.data.find((d: any) => d.item_sku === 'SKU-ROBUSTA');
      expect(robusta).toBeDefined();
      expect(robusta.daily_run_rate).toBe(3);
      expect(robusta.days_of_supply).toBe(1.7);
      expect(robusta.risk_level).toBe('CRITICAL');
      expect(robusta.suggested_reorder_qty).toBeGreaterThan(0);

      const suaDac = json.data.find((d: any) => d.item_sku === 'SKU-SUA-DAC');
      expect(suaDac).toBeDefined();
      expect(suaDac.daily_run_rate).toBe(1);
      expect(suaDac.risk_level).toBe('HEALTHY');
    });

    it('persists inventory forecast snapshots into D1', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { id: 'item_1', sku: 'SKU-ROBUSTA', name: 'Hạt Robusta', current_stock: 5, min_stock: 10, max_stock: 50 }
            ]
          })
        })
      });
      mockEnv.AURA_DB.batch = vi.fn().mockResolvedValue([]);

      const req = await authRequest('POST', '/api/inventory/forecasting/snapshot', 'owner');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.message).toContain('Snapshot created');
    });
  });

  describe('3. Edge Demand & Sales Forecasting', () => {
    it('requires owner or manager role for demand forecasting', async () => {
      const req = await authRequest('GET', '/api/admin/metrics/forecast', 'staff');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(403);
    });

    it('computes 7-day projection with day-of-week seasonality and peak windows', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { total: 50000, created_at: '2026-09-15 08:30:00', dow: '2', hour: '08' },
              { total: 65000, created_at: '2026-09-15 18:00:00', dow: '2', hour: '18' },
              { total: 120000, created_at: '2026-09-19 09:00:00', dow: '6', hour: '09' }
            ]
          })
        })
      });

      const req = await authRequest('GET', '/api/admin/metrics/forecast?days=7', 'owner');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.forecast_horizon_days).toBe(7);
      expect(json.data.daily_projections.length).toBe(7);
      expect(json.data.peak_windows).toHaveProperty('morning_rush');
      expect(json.data.peak_windows).toHaveProperty('evening_social');
      expect(json.data).toHaveProperty('staffing_advice');
    });

    it('returns 24-hour distribution of orders', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { hour: '08', orders_count: 15 },
              { hour: '18', orders_count: 25 }
            ]
          })
        })
      });

      const req = await authRequest('GET', '/api/admin/metrics/forecast/hourly', 'owner');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.hourly_distribution['08']).toBe(15);
      expect(json.data.hourly_distribution['18']).toBe(25);
    });
  });

  describe('4. AI Barista Concierge', () => {
    it('returns Sa Đéc specialty drinks catalog', async () => {
      const req = await authRequest('GET', '/api/ai/barista/specials');
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0]).toHaveProperty('id');
      expect(json.data[0]).toHaveProperty('pairing');
    });

    it('recommends Cà phê muối Sa Đéc for alert/strong preference in deterministic mode', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true })
        })
      });

      const req = await authRequest('POST', '/api/ai/barista/recommend', undefined, 'default', {
        prompt: 'Tôi muốn ly cà phê thật đậm đà để tỉnh táo làm việc',
        preferences: {
          mood: 'tỉnh táo',
          intensity: 'strong',
          sweetness: 'medium'
        }
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.product_id).toBe('cafe_muoi_sadec');
      expect(json.data.engine).toBe('deterministic');
      expect(json.data.pairing_suggestion).toBe('Bánh mì hoa hồng Sa Đéc');
    });

    it('recommends Trà sen Tháp Mười for relaxed low-caffeine preference', async () => {
      mockEnv.AURA_DB.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true })
        })
      });

      const req = await authRequest('POST', '/api/ai/barista/recommend', undefined, 'default', {
        prompt: 'Buổi chiều muốn uống gì đó thanh mát thư giãn',
        preferences: {
          mood: 'thư giãn',
          intensity: 'mild',
          flavor_notes: ['sen', 'thanh mát']
        }
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.product_id).toBe('tra_sen_dong_thap');
      expect(json.data.engine).toBe('deterministic');
    });
  });
});

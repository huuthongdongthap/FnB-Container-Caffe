/**
 * AI Barista Concierge Router
 * Dual-engine specialty coffee advisor (Workers AI with deterministic edge fallback).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { getTenantId } from '../middleware/tenant';

export const aiBaristaRouter = new Hono<{ Bindings: Env }>();

interface SpecialtyItem {
  id: string;
  name: string;
  temp: 'iced' | 'hot' | 'both';
  intensity: 'mild' | 'strong';
  sweetness: 'low' | 'medium' | 'high';
  keywords: string[];
  reason: string;
  pairing: string;
  note: string;
}

const SPECIALTY_CATALOG: SpecialtyItem[] = [
  {
    id: 'cafe_muoi_sadec',
    name: 'Cà phê muối Sa Đéc',
    temp: 'both',
    intensity: 'strong',
    sweetness: 'medium',
    keywords: ['muối', 'tỉnh táo', 'đậm đà', 'béo', 'signature', 'mặn'],
    reason: 'Vị mặn nhẹ từ kem béo hòa cùng Robusta rang mộc đậm chất miền Tây giúp bạn sảng khoái.',
    pairing: 'Bánh mì hoa hồng Sa Đéc',
    note: 'Khuấy nhẹ lớp kem muối phía trên trước khi nhấp ngụm đầu tiên.'
  },
  {
    id: 'cafe_cot_dua',
    name: 'Cà phê cốt dừa Bến Tre',
    temp: 'iced',
    intensity: 'mild',
    sweetness: 'high',
    keywords: ['dừa', 'ngọt', 'béo', 'nắng nóng', 'mát lạnh', 'giải nhiệt'],
    reason: 'Cốt dừa béo ngậy xay mịn cùng đá tuyết, thơm thoang thoảng vị cà phê nhẹ nhàng.',
    pairing: 'Bánh sừng bò bơ Pháp',
    note: 'Nên dùng kèm muỗng để thưởng thức trọn vẹn lớp cốt dừa đá tuyết.'
  },
  {
    id: 'bac_xiu_sadec',
    name: 'Bạc xỉu ba tầng Sa Đéc',
    temp: 'both',
    intensity: 'mild',
    sweetness: 'high',
    keywords: ['ngọt ngào', 'sữa', 'nhẹ nhàng', 'buổi chiều', 'thư giãn'],
    reason: 'Sữa đặc ngọt dịu hòa quyện sữa tươi thanh trùng, điểm xuyết một chút cà phê cho ngày thêm êm đềm.',
    pairing: 'Bánh quy bơ hạnh nhân',
    note: 'Chụp hình 3 tầng màu tuyệt đẹp trước khi khuấy đều thưởng thức.'
  },
  {
    id: 'espresso_dam_da',
    name: 'Cà phê đen phin Robusta Sa Đéc',
    temp: 'both',
    intensity: 'strong',
    sweetness: 'low',
    keywords: ['đen', 'đậm', 'không đường', 'tập trung', 'sáng sớm', 'robusta'],
    reason: 'Hạt Robusta cao nguyên chọn lọc rang đậm truyền thống, đắng thanh không gắt, hậu vị ngọt sâu.',
    pairing: 'Bánh chuối nướng Đồng Tháp',
    note: 'Nhấp từng ngụm nhỏ để cảm nhận trọn vẹn tinh dầu cà phê nguyên chất.'
  },
  {
    id: 'tra_sen_dong_thap',
    name: 'Trà sen Tháp Mười',
    temp: 'both',
    intensity: 'mild',
    sweetness: 'low',
    keywords: ['trà', 'sen', 'thanh mát', 'thư giãn', 'detox', 'không say'],
    reason: 'Hương sen tự nhiên ướp cùng trà xanh vùng Đồng Tháp, vị chát nhẹ hậu ngọt thanh dịu mát.',
    pairing: 'Hạt sen sấy giòn',
    note: 'Lựa chọn lý tưởng cho buổi chiều thanh tịnh hoặc người nhạy cảm với cafein.'
  }
];

const recommendSchema = z.object({
  prompt: z.string().max(500).optional(),
  preferences: z.object({
    mood: z.string().optional(),
    sweetness: z.enum(['low', 'medium', 'high']).optional(),
    temperature: z.enum(['iced', 'hot']).optional(),
    intensity: z.enum(['mild', 'strong']).optional(),
    flavor_notes: z.array(z.string()).optional()
  }).optional()
});

// POST /api/ai/barista/recommend
aiBaristaRouter.post('/recommend', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = recommendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid input' }, 400);
  }

  const { prompt, preferences } = parsed.data;
  const tenantId = getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  // Semantic rule-based matching
  let bestItem = SPECIALTY_CATALOG[0];
  let maxScore = -1;
  const textQuery = `${prompt || ''} ${preferences?.mood || ''} ${(preferences?.flavor_notes || []).join(' ')}`.toLowerCase();

  for (const item of SPECIALTY_CATALOG) {
    let score = 0;
    if (preferences?.temperature && (item.temp === preferences.temperature || item.temp === 'both')) score += 3;
    if (preferences?.intensity && item.intensity === preferences.intensity) score += 3;
    if (preferences?.sweetness && item.sweetness === preferences.sweetness) score += 3;
    for (const kw of item.keywords) {
      if (textQuery.includes(kw)) score += 4;
    }
    if (score > maxScore) {
      maxScore = score;
      bestItem = item;
    }
  }

  // Attempt Workers AI if available
  let engineUsed = 'deterministic';
  let baristaReason = bestItem.reason;
  const aiBinding = (c.env as Record<string, unknown>).AI as { run: (_model: string, _opts: unknown) => Promise<unknown> } | undefined;

  if (aiBinding && typeof aiBinding.run === 'function') {
    try {
      const response = await aiBinding.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          { role: 'system', content: 'You are an authentic Sa Đéc Vietnamese coffee barista. Keep answers brief (max 2 sentences).' },
          { role: 'user', content: `Suggest drink: ${bestItem.name}. Customer preference: ${textQuery}` }
        ]
      }) as { response?: string };
      if (response?.response) {
        baristaReason = response.response.trim();
        engineUsed = 'workers_ai';
      }
    } catch {
      engineUsed = 'deterministic';
    }
  }

  // Log interaction non-blocking
  try {
    const interactionId = `barista_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    await db.prepare(`
      INSERT INTO ai_barista_interactions (
        id, tenant_id, query_prompt, preferences_json,
        recommended_product_id, recommended_product_name, engine_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      interactionId, tenantId, prompt || null, JSON.stringify(preferences || {}),
      bestItem.id, bestItem.name, engineUsed
    ).run();
  } catch { /* non-blocking log error */ }

  return c.json({
    success: true,
    data: {
      product_id: bestItem.id,
      name: bestItem.name,
      reason: baristaReason,
      temperature: preferences?.temperature || (bestItem.temp === 'both' ? 'iced' : bestItem.temp),
      pairing_suggestion: bestItem.pairing,
      barista_note: bestItem.note,
      engine: engineUsed
    }
  });
});

// GET /api/ai/barista/specials
aiBaristaRouter.get('/specials', (c) => {
  return c.json({ success: true, data: SPECIALTY_CATALOG });
});

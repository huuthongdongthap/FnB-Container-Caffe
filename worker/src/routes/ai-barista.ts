/**
 * AI Barista Concierge Router
 * Dual-engine specialty coffee advisor (Workers AI with deterministic edge fallback).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { optionalAuth } from '../middleware/auth';
import { isHQSuperAdmin, resolvePublicTenantId } from '../middleware/tenant';
import { matchesTenantRow } from '../lib/db';

export const aiBaristaRouter = new Hono<{ Bindings: Env }>();

function hasBaristaCrossTenantOverride(c: Parameters<typeof resolvePublicTenantId>[0]): boolean {
  const authUser = c.get?.('user' as never) as {
    id?: string;
    role?: string;
    tenant_id?: string;
    tenantId?: string;
  } | undefined;
  const queryCandidates = [
    c.req?.query?.('tenant_id'),
    c.req?.query?.('tenantId'),
    c.req?.query?.('store_id'),
    c.req?.query?.('storeId'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const headerCandidates = [
    c.req?.header?.('X-Tenant-ID'),
    c.req?.header?.('x-tenant-id'),
    c.req?.header?.('X-Store-ID'),
    c.req?.header?.('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set([...queryCandidates, ...headerCandidates]).size > 1) {
    return true;
  }
  if (!authUser || isHQSuperAdmin(authUser)) {
    return false;
  }
  const userTenant = (authUser.tenant_id || authUser.tenantId || '').trim() || 'default';
  const overrideTenant = queryCandidates[0] || headerCandidates[0] || '';
  if (
    userTenant === '*' ||
    userTenant.toLowerCase() === 'hq' ||
    (overrideTenant && (overrideTenant === '*' || overrideTenant.toLowerCase() === 'hq' || overrideTenant !== userTenant))
  ) {
    return true;
  }
  return false;
}

aiBaristaRouter.use('/*', async (c, next) => {
  if (!c.get('user' as never) && (c.req.header('Authorization') || c.req.header('authorization'))) {
    await optionalAuth()(c, async () => {});
  }
  if (hasBaristaCrossTenantOverride(c)) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }
  return next();
});

function resolveBaristaTenantId(c: Parameters<typeof resolvePublicTenantId>[0]): string {
  const user = c.get?.('user' as never) as { role?: string; tenant_id?: string; tenantId?: string } | undefined;
  const raw = (resolvePublicTenantId(c) || 'default').trim();
  const resolved = raw.toLowerCase() === 'hq' ? '*' : (raw || 'default');
  if (resolved === '*' && (!user || !isHQSuperAdmin(user))) {
    return 'default';
  }
  return resolved;
}

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

const BARISTA_RATE_LIMIT_WINDOW_MS = 60_000;
const BARISTA_RATE_LIMIT_MAX_REQUESTS = 30;
const baristaRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function resetBaristaRateLimitForTests(): void {
  baristaRateLimitBuckets.clear();
}

function sanitizeBaristaText(value: string, maxLen: number): string {
  return Array.from(value)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
        return ' ';
      }
      return ch;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

const recommendSchema = z.object({
  prompt: z.string().max(200).optional(),
  mood: z.string().max(50).optional(),
  weather: z.string().max(50).optional(),
  time_of_day: z.string().max(50).optional(),
  flavor_notes: z.array(z.string().max(30)).max(10).optional(),
  customer_id: z.string().max(128).optional(),
  preferences: z.object({
    mood: z.string().max(50).optional(),
    weather: z.string().max(50).optional(),
    time_of_day: z.string().max(50).optional(),
    sweetness: z.enum(['low', 'medium', 'high']).optional(),
    temperature: z.enum(['iced', 'hot']).optional(),
    intensity: z.enum(['mild', 'strong']).optional(),
    flavor_notes: z.array(z.string().max(30)).max(10).optional()
  }).optional()
});

function makeBaristaInteractionId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return `barista_${Date.now().toString(36)}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

// POST /api/ai/barista/recommend
aiBaristaRouter.post('/recommend', async (c) => {
  const tenantId = resolveBaristaTenantId(c);
  const clientIp = (
    c.req.header('cf-connecting-ip') ||
    c.req.header('CF-Connecting-IP') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'anonymous'
  ).slice(0, 64);
  const now = Date.now();
  if (baristaRateLimitBuckets.size > 1000) {
    for (const [k, v] of baristaRateLimitBuckets.entries()) {
      if (now >= v.resetAt) baristaRateLimitBuckets.delete(k);
    }
  }
  const bucketKey = `${tenantId === '*' ? 'default' : tenantId}:${clientIp}`;
  const existingBucket = baristaRateLimitBuckets.get(bucketKey);
  if (!existingBucket || now >= existingBucket.resetAt) {
    baristaRateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + BARISTA_RATE_LIMIT_WINDOW_MS });
  } else {
    existingBucket.count += 1;
    if (existingBucket.count > BARISTA_RATE_LIMIT_MAX_REQUESTS) {
      return c.json({ success: false, error: 'Too many recommendation requests. Please try again later.' }, 429);
    }
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = recommendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid input' }, 400);
  }

  const sanitizedPrompt = parsed.data.prompt ? sanitizeBaristaText(parsed.data.prompt, 200) : undefined;
  const rawMood = parsed.data.preferences?.mood ?? parsed.data.mood;
  const rawWeather = parsed.data.preferences?.weather ?? parsed.data.weather;
  const rawTimeOfDay = parsed.data.preferences?.time_of_day ?? parsed.data.time_of_day;
  const rawFlavorNotes = parsed.data.preferences?.flavor_notes ?? parsed.data.flavor_notes;

  const sanitizedMood = rawMood ? sanitizeBaristaText(rawMood, 50) : undefined;
  const sanitizedWeather = rawWeather ? sanitizeBaristaText(rawWeather, 50) : undefined;
  const sanitizedTimeOfDay = rawTimeOfDay ? sanitizeBaristaText(rawTimeOfDay, 50) : undefined;
  const sanitizedFlavorNotes = rawFlavorNotes
    ? rawFlavorNotes.slice(0, 10).map((note) => sanitizeBaristaText(note, 30)).filter(Boolean)
    : undefined;

  const preferences = {
    ...(parsed.data.preferences || {}),
    ...(sanitizedMood !== undefined ? { mood: sanitizedMood } : {}),
    ...(sanitizedWeather !== undefined ? { weather: sanitizedWeather } : {}),
    ...(sanitizedTimeOfDay !== undefined ? { time_of_day: sanitizedTimeOfDay } : {}),
    ...(sanitizedFlavorNotes !== undefined ? { flavor_notes: sanitizedFlavorNotes } : {}),
  };

  const authUser = c.get('user' as never) as {
    id?: string;
    role?: string;
    tenant_id?: string;
    tenantId?: string;
  } | undefined;
  if (hasBaristaCrossTenantOverride(c)) {
    return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
  }

  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const isStaffCaller = Boolean(authUser?.role && authUser.role !== 'customer');
  const requestedCustomerId = parsed.data.customer_id ? sanitizeBaristaText(parsed.data.customer_id, 128) : null;
  let trustedCustomerId: string | null = null;
  let custRow: Record<string, unknown> | null = null;
  if (isStaffCaller) {
    if (requestedCustomerId && requestedCustomerId !== authUser?.id) {
      if (db) {
        try {
          custRow = await db
            .prepare('SELECT id, tenant_id FROM customers WHERE id = ? LIMIT 1')
            .bind(requestedCustomerId)
            .first<Record<string, unknown>>();
        } catch {
          custRow = (tenantId === 'default' || tenantId === '*')
            ? await db
                .prepare('SELECT id FROM customers WHERE id = ? LIMIT 1')
                .bind(requestedCustomerId)
                .first<Record<string, unknown>>()
                .catch(() => null)
            : null;
        }
      }
      if (!custRow || !matchesTenantRow(custRow, tenantId)) {
        return c.json({ success: false, error: 'Customer does not belong to current tenant' }, 403);
      }
      trustedCustomerId = requestedCustomerId;
    } else {
      trustedCustomerId = requestedCustomerId || authUser?.id || null;
      if (trustedCustomerId && tenantId === '*' && db) {
        custRow = await db
          .prepare('SELECT id, tenant_id FROM customers WHERE id = ? LIMIT 1')
          .bind(trustedCustomerId)
          .first<Record<string, unknown>>()
          .catch(() => null);
      }
    }
  } else {
    trustedCustomerId = authUser?.id ? authUser.id : null;
    if (trustedCustomerId && tenantId === '*' && db) {
      custRow = await db
        .prepare('SELECT id, tenant_id FROM customers WHERE id = ? LIMIT 1')
        .bind(trustedCustomerId)
        .first<Record<string, unknown>>()
        .catch(() => null);
    }
  }
  const resolvedCustTenant =
    custRow &&
    typeof custRow.tenant_id === 'string' &&
    custRow.tenant_id.trim() &&
    custRow.tenant_id.trim() !== '*' &&
    custRow.tenant_id.trim().toLowerCase() !== 'hq'
      ? custRow.tenant_id.trim()
      : '';
  const interactionTenant =
    tenantId === '*'
      ? (resolvedCustTenant || 'default')
      : (resolvedCustTenant || tenantId || 'default');

  let bestItem = SPECIALTY_CATALOG[0];
  let maxScore = -1;
  const textQuery = [
    sanitizedPrompt || '',
    sanitizedMood || '',
    sanitizedWeather || '',
    sanitizedTimeOfDay || '',
    (sanitizedFlavorNotes || []).join(' ')
  ].filter(Boolean).join(' ').toLowerCase();

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
    const interactionId = makeBaristaInteractionId();
    await db.prepare(`
      INSERT INTO ai_barista_interactions (
        id, tenant_id, customer_id, query_prompt, preferences_json,
        recommended_product_id, recommended_product_name, engine_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      interactionId, interactionTenant, trustedCustomerId, sanitizedPrompt || null, JSON.stringify(preferences || {}),
      bestItem.id, bestItem.name, engineUsed
    ).run().catch(async (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (/no such column:\s*tenant_id|no column named\s*tenant_id/i.test(msg)) {
        if (interactionTenant !== 'default' && interactionTenant !== '*') return;
        await db.prepare(`
          INSERT INTO ai_barista_interactions (
            id, customer_id, query_prompt, preferences_json,
            recommended_product_id, recommended_product_name, engine_used
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          interactionId, trustedCustomerId, sanitizedPrompt || null, JSON.stringify(preferences || {}),
          bestItem.id, bestItem.name, engineUsed
        ).run().catch(() =>
          db.prepare(`
            INSERT INTO ai_barista_interactions (
              id, query_prompt, preferences_json,
              recommended_product_id, recommended_product_name, engine_used
            ) VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            interactionId, sanitizedPrompt || null, JSON.stringify(preferences || {}),
            bestItem.id, bestItem.name, engineUsed
          ).run()
        );
        return;
      }
      await db.prepare(`
        INSERT INTO ai_barista_interactions (
          id, tenant_id, query_prompt, preferences_json,
          recommended_product_id, recommended_product_name, engine_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        interactionId, interactionTenant, sanitizedPrompt || null, JSON.stringify(preferences || {}),
        bestItem.id, bestItem.name, engineUsed
      ).run().catch(() => {
        if (interactionTenant !== 'default' && interactionTenant !== '*') return;
        return db.prepare(`
          INSERT INTO ai_barista_interactions (
            id, query_prompt, preferences_json,
            recommended_product_id, recommended_product_name, engine_used
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          interactionId, sanitizedPrompt || null, JSON.stringify(preferences || {}),
          bestItem.id, bestItem.name, engineUsed
        ).run();
      });
    });
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

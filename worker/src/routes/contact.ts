/**
 * Contact Routes
 * Converted from routes/contact.js with TypeScript.
 * POST /api/contact - submit a contact message
 */

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { contactSchema } from '../lib/validators';
import { contactMessageRepository, ContactSchemaUnavailable } from '../lib/contact-message-repository';
import { resolvePilotStore } from '../lib/pilot-store';
import { privacyError } from '../lib/pilot-privacy-access';
import type { Env } from '../types/env';

const log = createLogger({ route: 'contact' });

async function throttle(
  request: Request,
  env: Record<string, unknown>,
  key: string,
  max: number,
  windowSec: number,
  tenantId = 'default'
): Promise<boolean> {
  const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
  if (!kv) {
    return true;
  }
  const rawIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const ip = rawIp.split(',')[0].trim() || 'unknown';
  const legacyKey = `rl:${key}:${ip}`;
  const fullKey = tenantId && tenantId !== 'default' ? `rl:${key}:${tenantId}:${ip}` : legacyKey;
  const scopedCount = parseInt((await kv.get(fullKey)) || '0', 10) || 0;
  const legacyCount = fullKey !== legacyKey ? parseInt((await kv.get(legacyKey)) || '0', 10) || 0 : 0;
  const cur = Math.max(scopedCount, legacyCount);
  if (cur >= max) {
    return false;
  }
  await kv.put(fullKey, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

export async function submitContact(request: Request, env: Record<string, unknown>) {
  try {
    const tenantId = resolvePilotStore(env as unknown as Env);

    const body = await request.json() as Record<string, unknown>;
    const parsed = contactSchema.safeParse({
      name: body.name,
      phone: body.phone,
      email: body.email || undefined,
      category: body.category || undefined,
      content: body.content
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }

    if (!(await throttle(request, env, 'ct', 3, 3600, tenantId))) {
      return errorResponse('Quá nhiều tin nhắn, vui lòng thử lại sau', 429);
    }

    const { name, phone, email, category, content } = parsed.data;
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const messages = await contactMessageRepository(db);
    const id = await messages.insert({ tenantId, classification: 'contact',
      name: name.trim(), phone: phone.trim(), email: email?.trim(), category: category || 'other',
      content: content.trim(), direction: 'customer' });

    return jsonResponse({
      success: true,
      message: 'Tin nhắn đã được gửi. Chúng tôi sẽ phản hồi trong 24h.',
      id
    }, 201);
  } catch (error) {
    const expected = privacyError(error);
    if (expected) return expected;
    if (error instanceof ContactSchemaUnavailable) return errorResponse('Contact unavailable', 503);
    log.error('Contact submit error');
    return errorResponse('Failed to submit contact message', 500);
  }
}

export const contactRouter = {
  async fetch(request: Request, env: Record<string, unknown>) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === '/api/contact' && method === 'POST') {
      return submitContact(request, env);
    }
    return errorResponse('Not Found', 404);
  }
};

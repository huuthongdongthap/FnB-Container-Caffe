/**
 * Contact Routes
 * Converted from routes/contact.js with TypeScript.
 * POST /api/contact - submit a contact message
 */

import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { contactSchema } from '../lib/validators';

const log = createLogger({ route: 'contact' });

async function throttle(request: Request, env: Record<string, unknown>, key: string, max: number, windowSec: number): Promise<boolean> {
  const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
  if (!kv) { return true; }
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const fullKey = `rl:${key}:${ip}`;
  const cur = parseInt(await kv.get(fullKey) || '0', 10);
  if (cur >= max) { return false; }
  await kv.put(fullKey, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

export async function submitContact(request: Request, env: Record<string, unknown>) {
  try {
    if (!(await throttle(request, env, 'ct', 3, 3600))) {
      return errorResponse('Quá nhiều tin nhắn, vui lòng thử lại sau', 429);
    }

    const body = await request.json() as Record<string, unknown>;
    const parsed = contactSchema.safeParse({
      name: body.name,
      phone: body.phone,
      email: body.email || undefined,
      category: body.category || undefined,
      content: body.content,
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }

    const { name, phone, email, category, content } = parsed.data;

    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
    const result = await db.prepare(
      'INSERT INTO contact_messages (name, phone, email, category, content, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(name.trim().slice(0, 100), phone.trim(), email?.trim().slice(0, 100) || null, category || 'other', content.trim().slice(0, 2000), 'unread').run();

    return jsonResponse({
      success: true,
      message: 'Tin nhắn đã được gửi. Chúng tôi sẽ phản hồi trong 24h.',
      id: (result as unknown as { lastRowId?: number }).lastRowId,
    }, 201);
  } catch (error) {
    log.error('Contact submit error:', { message: (error as Error).message });
    return errorResponse('Failed to submit contact message: ' + (error as Error).message, 500);
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
  },
};

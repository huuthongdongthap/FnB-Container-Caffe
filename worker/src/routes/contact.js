/**
 * Contact Routes
 * POST /api/contact — submit a contact message
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';

const VALID_CATEGORIES = ['service', 'food', 'space', 'booking', 'complaint', 'other'];

async function throttle(request, env, key, max, windowSec) {
  const kv = env.AUTH_KV;
  if (!kv) {return true;}
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const fullKey = `rl:${key}:${ip}`;
  const cur = parseInt(await kv.get(fullKey) || '0', 10);
  if (cur >= max) {return false;}
  await kv.put(fullKey, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

/**
 * POST /api/contact
 * Body: { name, phone, email?, category?, content }
 */
export async function submitContact(request, env) {
  try {
    // Throttle: 3 contact messages / hour / IP
    if (!(await throttle(request, env, 'ct', 3, 3600))) {
      return errorResponse('Quá nhiều tin nhắn, vui lòng thử lại sau', 429);
    }

    const body = await request.json();
    const { name, phone, email, category, content } = body;

    if (!name || !name.trim() || name.length > 100) {
      return errorResponse('name is required (max 100 chars)', 400);
    }
    if (!phone || !phone.trim() || !/^[0-9+\-\s]{8,15}$/.test(phone.trim())) {
      return errorResponse('phone is required (8-15 digits)', 400);
    }
    if (!content || !content.trim() || content.length > 2000) {
      return errorResponse('content is required (max 2000 chars)', 400);
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return errorResponse('email không hợp lệ', 400);
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return errorResponse(`category must be one of: ${VALID_CATEGORIES.join(', ')}`, 400);
    }

    const result = await env.AURA_DB.prepare(
      'INSERT INTO contact_messages (name, phone, email, category, content, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(name.trim().slice(0, 100), phone.trim(), email?.trim().slice(0, 100) || null, category || 'other', content.trim().slice(0, 2000), 'unread').run();

    return jsonResponse({
      success: true,
      message: 'Tin nhắn đã được gửi. Chúng tôi sẽ phản hồi trong 24h.',
      id: result.lastRowId,
    }, 201);
  } catch (error) {
    return errorResponse('Failed to submit contact message: ' + error.message, 500);
  }
}

/**
 * Router dispatcher for /api/contact*
 */
export const contactRouter = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === '/api/contact' && method === 'POST') {
      return submitContact(request, env);
    }
    return errorResponse('Not Found', 404);
  },
};

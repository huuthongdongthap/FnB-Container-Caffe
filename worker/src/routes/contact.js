/**
 * Contact Routes
 * POST /api/contact — submit a contact message
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';

const VALID_CATEGORIES = ['service', 'food', 'space', 'booking', 'complaint', 'other'];

/**
 * POST /api/contact
 * Body: { name, phone, email?, category?, content }
 */
export async function submitContact(request, env) {
  try {
    const body = await request.json();
    const { name, phone, email, category, content } = body;

    if (!name || !name.trim()) {
      return errorResponse('name is required', 400);
    }
    if (!phone || !phone.trim()) {
      return errorResponse('phone is required', 400);
    }
    if (!content || !content.trim()) {
      return errorResponse('content is required', 400);
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return errorResponse(`category must be one of: ${VALID_CATEGORIES.join(', ')}`, 400);
    }

    const result = await env.AURA_DB.prepare(
      'INSERT INTO contact_messages (name, phone, email, category, content, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(name.trim(), phone.trim(), email?.trim() || null, category || 'other', content.trim(), 'unread').run();

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

/**
 * Chat Routes
 * Live chat support widget API.
 * POST /api/chat/messages — save message from customer
 * GET  /api/chat/conversations — list unique conversations (auth required)
 * GET  /api/chat/messages/:phone — get message history for a phone (auth required)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types/env';

const log = createLogger({ route: 'chat' });

// ── Zod schemas ──

const sendMessageSchema = z.object({
  name: z.string().min(1, 'Ten khong duoc de trong').max(100),
  phone: z.string().min(8, 'So dien thoai khong hop le').max(15),
  message: z.string().min(1, 'Tin nhan khong duoc de trong').max(2000),
});

// ── Rate limit helper ──

async function checkRateLimit(env: Env, key: string, max: number, windowSec: number): Promise<boolean> {
  const ip = 'unknown'; // rate limit by phone instead
  const fullKey = `rl:chat:${key}`;
  const cur = parseInt((await env.AUTH_KV.get(fullKey)) || '0', 10);
  if (cur >= max) return false;
  await env.AUTH_KV.put(fullKey, String(cur + 1), { expirationTtl: windowSec });
  return true;
}

// ── Handlers ──

async function sendMessage(c: { env: Env; req: { json: () => Promise<unknown>; header: (k: string) => string | undefined }; json: (data: unknown, status?: number) => Response; }) {
  try {
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = sendMessageSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }

    const { name, phone, message } = parsed.data;

    const ok = await checkRateLimit(c.env, `msg:${phone}`, 10, 60);
    if (!ok) {
      return errorResponse('Qua nhieu tin nhan, vui long thu lai sau', 429);
    }

    const db = c.env.AURA_DB;
    const now = new Date().toISOString();
    const result = await db.prepare(
      'INSERT INTO contact_messages (name, phone, message, direction, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(name.trim(), phone.trim(), message.trim(), 'customer', now).run();

    return jsonResponse({
      success: true,
      message: 'Tin nhan da duoc gui',
      id: result.meta?.last_row_id,
    }, 201);
  } catch (error) {
    log.error('Chat send message error:', { message: (error as Error).message });
    return errorResponse('Failed to send message: ' + (error as Error).message, 500);
  }
}

async function getConversations(c: { env: Env; json: (data: unknown, status?: number) => Response }) {
  try {
    const db = c.env.AURA_DB;
    const { results } = await db.prepare(
      `SELECT
        cm.phone,
        cm.name,
        cm.message AS last_message,
        cm.direction AS last_direction,
        cm.created_at AS last_message_at,
        (SELECT COUNT(*) FROM contact_messages WHERE phone = cm.phone) AS message_count,
        (SELECT COUNT(*) FROM contact_messages WHERE phone = cm.phone AND direction = 'customer' AND read_at IS NULL) AS unread_count
      FROM contact_messages cm
      WHERE cm.id IN (
        SELECT MAX(id) FROM contact_messages GROUP BY phone
      )
      ORDER BY cm.created_at DESC`
    ).all();

    const conversations = (results as Array<Record<string, unknown>>).map((row) => ({
      phone: row.phone,
      name: row.name,
      last_message: row.last_message,
      last_direction: row.last_direction,
      last_message_at: row.last_message_at,
      message_count: row.message_count,
      unread_count: row.unread_count,
    }));

    return jsonResponse({ success: true, data: conversations });
  } catch (error) {
    log.error('Chat get conversations error:', { message: (error as Error).message });
    return errorResponse('Failed to get conversations: ' + (error as Error).message, 500);
  }
}

async function getMessageHistory(c: { env: Env; req: { param: (k: string) => string }; json: (data: unknown, status?: number) => Response }) {
  try {
    const phone = c.req.param('phone');
    if (!phone || phone.length < 8) {
      return errorResponse('So dien thoai khong hop le', 400);
    }

    const db = c.env.AURA_DB;
    const { results } = await db.prepare(
      'SELECT id, name, phone, message, direction, created_at, read_at FROM contact_messages WHERE phone = ? ORDER BY created_at ASC'
    ).bind(phone).all();

    return jsonResponse({ success: true, data: results });
  } catch (error) {
    log.error('Chat get message history error:', { message: (error as Error).message });
    return errorResponse('Failed to get message history: ' + (error as Error).message, 500);
  }
}

// ── Router ──

export const chatRouter = new Hono<{ Bindings: Env }>();

// Public: customer sends a message
chatRouter.post('/messages', (c) => sendMessage(c));

// Protected: get all conversations
chatRouter.get('/conversations', requireAuth(['owner', 'staff']), (c) => getConversations(c));

// Protected: get message history for a phone
chatRouter.get('/messages/:phone', requireAuth(['owner', 'staff']), (c) => getMessageHistory(c));

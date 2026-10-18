/**
 * Chat Routes
 * Live chat support widget API.
 * POST /api/chat/messages — save message from customer
 * GET  /api/chat/conversations — list unique conversations (auth required)
 * GET  /api/chat/messages/:phone — get message history for a phone (auth required)
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import { requireAuth } from '../middleware/auth';
import { getAuthToken, verifyJWT } from '../lib/jwt';
import type { Env } from '../types/env';

const log = createLogger({ route: 'chat' });

// ── Zod schemas ──

const sendMessageSchema = z.object({
  name: z.string().min(1, 'Ten khong duoc de trong').max(100),
  phone: z.string().min(8, 'So dien thoai khong hop le').max(15),
  message: z.string().min(1, 'Tin nhan khong duoc de trong').max(2000),
  direction: z.enum(['customer', 'admin']).optional(),
});

// ── Rate limit helper ──

async function checkRateLimit(env: Env, key: string, max: number, windowSec: number): Promise<boolean> {
  if (!env?.AUTH_KV) return true;
  try {
    const fullKey = `rl:chat:${key}`;
    const cur = parseInt((await env.AUTH_KV.get(fullKey)) || '0', 10);
    if (cur >= max) {
      return false;
    }
    await env.AUTH_KV.put(fullKey, String(cur + 1), { expirationTtl: windowSec });
    return true;
  } catch {
    return true;
  }
}

// ── Handlers ──

async function sendMessage(c: Context<{ Bindings: Env }>) {
  try {
    const body = await c.req.json() as Record<string, unknown>;
    const parsed = sendMessageSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }

    const { name, phone, message } = parsed.data;
    const clientIp =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
      'unknown';

    if (clientIp !== 'unknown') {
      const ipOk = await checkRateLimit(c.env, `ip:${clientIp}`, 20, 60);
      if (!ipOk) {
        return errorResponse('Qua nhieu tin nhan, vui long thu lai sau', 429);
      }
    }

    const ok = await checkRateLimit(c.env, `msg:${phone}`, 10, 60);
    if (!ok) {
      return errorResponse('Qua nhieu tin nhan, vui long thu lai sau', 429);
    }

    const db = c.env.AURA_DB;
    const now = new Date().toISOString();
    let resolvedDirection: 'customer' | 'admin' = 'customer';
    if (parsed.data.direction === 'admin') {
      const token = getAuthToken(c.req.raw);
      if (token && c.env.JWT_SECRET) {
        let isRevoked = false;
        if (c.env.AUTH_KV) {
          try {
            isRevoked = Boolean(await c.env.AUTH_KV.get(`revoked:${token}`));
          } catch {
            isRevoked = false;
          }
        }
        if (!isRevoked) {
          const payload = await verifyJWT(token, c.env.JWT_SECRET).catch(() => null);
          if (payload && ['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin'].includes(String(payload.role || ''))) {
            resolvedDirection = 'admin';
          }
        }
      }
    }
    let lastRowId: unknown = undefined;
    try {
      const result = await db.prepare(
        'INSERT INTO contact_messages (name, phone, message, direction, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(name.trim(), phone.trim(), message.trim(), resolvedDirection, now).run();
      lastRowId = result.meta?.last_row_id;
    } catch {
      const msgId = `MSG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const category = resolvedDirection === 'admin' ? 'chat_admin' : 'chat';
      await db.prepare(
        'INSERT INTO contact_messages (id, name, phone, email, category, content, status, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)'
      ).bind(msgId, name.trim(), phone.trim(), category, message.trim(), resolvedDirection === 'admin' ? 'read' : 'unread', now).run();
      lastRowId = msgId;
    }

    return jsonResponse({
      success: true,
      message: 'Tin nhan da duoc gui',
      id: lastRowId
    }, 201);
  } catch (error) {
    log.error('Chat send message error:', { message: (error as Error).message });
    return errorResponse('Failed to send message', 500);
  }
}

async function getConversations(c: Context<{ Bindings: Env }>) {
  try {
    const db = c.env.AURA_DB;
    let results: unknown[] = [];
    try {
      const res = await db.prepare(
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
      results = res.results || [];
    } catch {
      const res = await db.prepare(
        `SELECT
          cm.phone,
          cm.name,
          cm.content AS last_message,
          CASE WHEN cm.category = 'chat_admin' THEN 'admin' ELSE 'customer' END AS last_direction,
          cm.created_at AS last_message_at,
          (SELECT COUNT(*) FROM contact_messages WHERE phone = cm.phone) AS message_count,
          (SELECT COUNT(*) FROM contact_messages WHERE phone = cm.phone AND status = 'unread') AS unread_count
        FROM contact_messages cm
        WHERE cm.rowid IN (
          SELECT MAX(rowid) FROM contact_messages GROUP BY phone
        )
        ORDER BY cm.created_at DESC`
      ).all();
      results = res.results || [];
    }

    const conversations = (results as Array<Record<string, unknown>>).map((row) => ({
      phone: row.phone,
      name: row.name,
      last_message: row.last_message,
      last_direction: row.last_direction,
      last_message_at: row.last_message_at,
      message_count: row.message_count,
      unread_count: row.unread_count
    }));

    return jsonResponse({ success: true, data: conversations });
  } catch (error) {
    log.error('Chat get conversations error:', { message: (error as Error).message });
    return errorResponse('Failed to get conversations', 500);
  }
}

async function getMessageHistory(c: Context<{ Bindings: Env }>) {
  try {
    const phone = c.req.param('phone') || c.req.param('id');
    if (!phone || phone.length < 8) {
      return errorResponse('So dien thoai khong hop le', 400);
    }

    const db = c.env.AURA_DB;
    const now = new Date().toISOString();

    // Mark customer messages as read when staff views the conversation
    try {
      await db.prepare(
        "UPDATE contact_messages SET read_at = ? WHERE phone = ? AND direction = 'customer' AND read_at IS NULL"
      ).bind(now, phone).run();
    } catch {
      try {
        await db.prepare(
          "UPDATE contact_messages SET status = 'read' WHERE phone = ? AND status = 'unread'"
        ).bind(phone).run();
      } catch {
        // Non-blocking if table or column varies
      }
    }
    try {
      await db.prepare(
        "UPDATE chat_messages SET read_at = ? WHERE (conversation_id = ? OR phone = ?) AND sender_type = 'customer' AND read_at IS NULL"
      ).bind(now, phone, phone).run();
    } catch {
      // Non-blocking
    }

    let results: unknown[] = [];
    try {
      const res = await db.prepare(
        'SELECT id, name, phone, message, direction, created_at, read_at FROM contact_messages WHERE phone = ? ORDER BY created_at ASC'
      ).bind(phone).all();
      results = res.results || [];
    } catch {
      const res = await db.prepare(
        `SELECT id, name, phone, content AS message,
                CASE WHEN category = 'chat_admin' THEN 'admin' ELSE 'customer' END AS direction,
                created_at,
                CASE WHEN status = 'read' THEN created_at ELSE NULL END AS read_at
           FROM contact_messages WHERE phone = ? ORDER BY created_at ASC`
      ).bind(phone).all();
      results = res.results || [];
    }

    return jsonResponse({ success: true, data: results });
  } catch (error) {
    log.error('Chat get message history error:', { message: (error as Error).message });
    return errorResponse('Failed to get message history', 500);
  }
}

// ── Router ──

export const chatRouter = new Hono<{ Bindings: Env }>();

// Public: customer sends a message
chatRouter.post('/messages', (c) => sendMessage(c));

// Protected: get all conversations
chatRouter.get('/conversations', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']), (c) => getConversations(c));

// Protected: get message history for a phone or conversation ID
chatRouter.get('/conversations/:id/messages', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']), (c) => getMessageHistory(c));
chatRouter.get('/messages/:phone', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']), (c) => getMessageHistory(c));

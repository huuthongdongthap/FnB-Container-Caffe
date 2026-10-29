/** Support chat reads only explicitly classified rows owned by the pilot store. */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { requireAuth } from '../middleware/auth';
import { authenticateRequest } from '../lib/staff-session-auth';
import { staffSessionErrorResponse } from '../lib/staff-session';
import { contactMessageRepository, ContactSchemaUnavailable } from '../lib/contact-message-repository';
import { privacyError, privacyStore } from '../lib/pilot-privacy-access';
import { resolvePilotStore } from '../lib/pilot-store';
import type { Env } from '../types/env';

const roles = ['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin'];
const sendMessageSchema = z.object({
  name: z.string().trim().min(1, 'Ten khong duoc de trong').max(100),
  phone: z.string().trim().min(8, 'So dien thoai khong hop le').max(15),
  message: z.string().trim().min(1, 'Tin nhan khong duoc de trong').max(2000),
  direction: z.enum(['customer', 'admin']).optional(),
});
async function checkRateLimit(env: Env, key: string, max: number): Promise<boolean> {
  if (!env.AUTH_KV) return true;
  try {
    const fullKey = `rl:chat:${key}`;
    const count = parseInt((await env.AUTH_KV.get(fullKey)) || '0', 10);
    if (count >= max) return false;
    await env.AUTH_KV.put(fullKey, String(count + 1), { expirationTtl: 60 });
    return true;
  } catch { return true; }
}
function chatError(error: unknown, message: string) {
  return privacyError(error) || staffSessionErrorResponse(error)
    || errorResponse(error instanceof ContactSchemaUnavailable ? 'Chat unavailable' : message,
      error instanceof ContactSchemaUnavailable ? 503 : 500);
}
async function sendMessage(c: Context<{ Bindings: Env }>) {
  try {
    const parsed = sendMessageSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return errorResponse(`${first.path.join('.')}: ${first.message}`, 400);
    }
    const { name, phone, message } = parsed.data;
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
    if ((ip && !(await checkRateLimit(c.env, `ip:${ip}`, 20)))
      || !(await checkRateLimit(c.env, `msg:${phone}`, 10)))
      return errorResponse('Qua nhieu tin nhan, vui long thu lai sau', 429);
    const tenantId = resolvePilotStore(c.env);
    let direction: 'customer' | 'admin' = 'customer';
    if (parsed.data.direction === 'admin') {
      const session = await authenticateRequest(c.req.raw, c.env);
      if (!session) return errorResponse('Unauthorized', 401);
      if ('blocked' in session) return errorResponse(session.blocked, 403);
      // Authority comes from the verified D1 account, never an incidental JWT claim.
      if (!session.account || !roles.includes(session.account.role) || session.account.tenant_id !== tenantId)
        return errorResponse('Không đủ quyền truy cập cửa hàng', 403);
      direction = 'admin';
    }
    const repository = await contactMessageRepository(c.env.AURA_DB);
    const id = await repository.insert({ tenantId, classification: 'chat', name, phone, content: message,
      direction, category: direction === 'admin' ? 'chat_admin' : 'chat' });
    return jsonResponse({ success: true, message: 'Tin nhan da duoc gui', id }, 201);
  } catch (error) { return chatError(error, 'Failed to send message'); }
}
async function getConversations(c: Context<{ Bindings: Env }>) {
  try {
    const tenantId = privacyStore(c, roles);
    if (tenantId instanceof Response) return tenantId;
    const repository = await contactMessageRepository(c.env.AURA_DB);
    return jsonResponse({ success: true, data: await repository.conversations(tenantId) });
  } catch (error) { return chatError(error, 'Failed to get conversations'); }
}
async function getMessageHistory(c: Context<{ Bindings: Env }>) {
  try {
    const tenantId = privacyStore(c, roles);
    if (tenantId instanceof Response) return tenantId;
    const phone = c.req.param('phone') || c.req.param('id');
    if (!phone || phone.length < 8) return errorResponse('So dien thoai khong hop le', 400);
    const repository = await contactMessageRepository(c.env.AURA_DB);
    return jsonResponse({ success: true, data: await repository.history(tenantId, phone) });
  } catch (error) { return chatError(error, 'Failed to get message history'); }
}
export const chatRouter = new Hono<{ Bindings: Env }>();
chatRouter.post('/messages', sendMessage);
chatRouter.get('/conversations', requireAuth(roles), getConversations);
chatRouter.get('/conversations/:id/messages', requireAuth(roles), getMessageHistory);
chatRouter.get('/messages/:phone', requireAuth(roles), getMessageHistory);

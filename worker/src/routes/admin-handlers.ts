/**
 * Admin handlers extracted from src/index.ts.
 * Keeps the router table thin; these handlers need DB + KV access.
 */

export async function getAdminCustomers(request: Request, env: Record<string, unknown>) {
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const search = url.searchParams.get('search') || '';
  const offset = (page - 1) * limit;

  let query = 'SELECT id, name, phone, email, tier, cashback_balance, total_spent, visit_count, created_at FROM customers';
  let countQuery = 'SELECT COUNT(*) as total FROM customers';
  const params: unknown[] = [];

  if (search) {
    const where = ' WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?';
    const like = `%${search}%`;
    query += where;
    countQuery += where;
    params.push(like, like, like);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const { results } = await db.prepare(query).bind(...params, limit, offset).all();
  const totalRow = await db.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = totalRow?.total ?? 0;
  return Response.json({ success: true, data: results, pagination: { page, limit, total } });
}

export async function getStuckPayments(request: Request, env: Record<string, unknown>) {
  const kv = env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
  if (!kv) {
    return Response.json({ stuck: [], dlq: [], total: 0 });
  }

  const stuckList = await kv.list({ prefix: 'payment:stuck:' });
  const dlqList = await kv.list({ prefix: 'webhook:dlq:' });

  const stuck = await Promise.all(
    stuckList.keys.slice(0, 20).map(async(k) => {
      const raw = await kv.get(k.name);
      return raw ? JSON.parse(raw) : null;
    })
  );

  const dlq = await Promise.all(
    dlqList.keys.slice(0, 20).map(async(k) => {
      const raw = await kv.get(k.name);
      return raw ? { key: k.name, ...JSON.parse(raw) } : null;
    })
  );

  return Response.json({
    stuck: stuck.filter(Boolean).map((s: Record<string, unknown>) => ({ ...s, amount: '***' })),
    dlq: dlq.filter(Boolean),
    total: stuckList.keys.length + dlqList.keys.length
  });
}
